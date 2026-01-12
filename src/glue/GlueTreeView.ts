/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { GlueTreeItem, TreeItemType } from './GlueTreeItem';
import { GlueTreeDataProvider } from './GlueTreeDataProvider';
import * as ui from '../common/UI';
import * as api from '../common/API';
import { CloudWatchLogView } from '../cloudwatch/CloudWatchLogView';
import { basename, join } from 'path';

export class GlueTreeView {

	public static Current: GlueTreeView;
	public view: vscode.TreeView<GlueTreeItem>;
	public treeDataProvider: GlueTreeDataProvider;
	public context: vscode.ExtensionContext;
	public FilterString: string = "";
	public isShowOnlyFavorite: boolean = false;
	public isShowHiddenNodes: boolean = false;
	public AwsProfile: string = "default";	
	public AwsEndPoint: string | undefined;
	public ResourceList: {Region: string, Name: string, Type: string}[] = [];
	public JobRunsCache: {[key: string]: any[]} = {};
	public LogStreamsCache: {[key: string]: string[]} = {};
	public JobInfoCache: {[key: string]: any} = {};
	public JobCodePaths: {[key: string]: string} = {};

	constructor(context: vscode.ExtensionContext) {
		GlueTreeView.Current = this;
		this.context = context;
		this.LoadState();
		this.treeDataProvider = new GlueTreeDataProvider();
		this.view = vscode.window.createTreeView('GlueTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
		this.Refresh();
		context.subscriptions.push(this.view);
	}

	async TestAwsConnection(){
		let response = await api.TestAwsCredentials()
		if(response.isSuccessful && response.result){
			ui.showInfoMessage('Aws Credentials Test Successfull');
		} else {
			ui.showErrorMessage('Aws Credentials Test Error !!!', response.error);
		}
		
		let selectedRegion = await vscode.window.showInputBox({ placeHolder: 'Enter Region Eg: us-east-1', value: 'us-east-1' });
		if(selectedRegion===undefined){ return; }

		response = await api.TestAwsConnection(selectedRegion)
		if(response.isSuccessful && response.result){
			ui.showInfoMessage('Aws Connection Test Successfull');
		} else {
			ui.showErrorMessage('Aws Connection Test Error !!!', response.error);
		}
	}

	BugAndNewFeature() {
		vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/aws-glue-vscode-extension/issues/new'));
	}
	Donate() {
		vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
	}

	Refresh(): void {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: "Aws Glue: Loading...",
		}, (progress, token) => {
			progress.report({ increment: 0 });
			this.treeDataProvider.Refresh();
			return new Promise<void>(resolve => { resolve(); });
		});
	}

	async AddToFav(node: GlueTreeItem) {
		node.IsFav = true;
		this.treeDataProvider.Refresh();
	}

	async HideNode(node: GlueTreeItem) {
		node.IsHidden = true;
		this.treeDataProvider.Refresh();
	}

	async UnHideNode(node: GlueTreeItem) {
		node.IsHidden = false;
		this.treeDataProvider.Refresh();
	}

	async DeleteFromFav(node: GlueTreeItem) {
		node.IsFav = false;
		this.treeDataProvider.Refresh();
	}

	async Filter() {
		let filterStringTemp = await vscode.window.showInputBox({ value: this.FilterString, placeHolder: 'Enter Your Filter Text' });
		if (filterStringTemp === undefined) { return; }
		this.FilterString = filterStringTemp;
		this.treeDataProvider.Refresh();
		this.SaveState();
	}

	async ShowOnlyFavorite() {
		this.isShowOnlyFavorite = !this.isShowOnlyFavorite;
		this.treeDataProvider.Refresh();
		this.SaveState();
	}

	async ShowHiddenNodes() {
		this.isShowHiddenNodes = !this.isShowHiddenNodes;
		this.treeDataProvider.Refresh();
		this.SaveState();
	}

	SaveState() {
		try {
			this.context.globalState.update('AwsProfile', this.AwsProfile);
			this.context.globalState.update('FilterString', this.FilterString);
			this.context.globalState.update('ShowOnlyFavorite', this.isShowOnlyFavorite);
			this.context.globalState.update('ShowHiddenNodes', this.isShowHiddenNodes);
			this.context.globalState.update('ResourceList', this.ResourceList);
			this.context.globalState.update('AwsEndPoint', this.AwsEndPoint);
			this.context.globalState.update('JobCodePaths', this.JobCodePaths);
		} catch (error) {}
	}

	LoadState() {
		try {
			this.AwsEndPoint = this.context.globalState.get('AwsEndPoint');
			this.AwsProfile = this.context.globalState.get('AwsProfile') || "default";
			this.FilterString = this.context.globalState.get('FilterString') || "";
			this.isShowOnlyFavorite = this.context.globalState.get('ShowOnlyFavorite') || false;
			this.isShowHiddenNodes = this.context.globalState.get('ShowHiddenNodes') || false;
			this.ResourceList = this.context.globalState.get('ResourceList') || [];
			this.JobCodePaths = this.context.globalState.get('JobCodePaths') || {};
		} catch (error) {}
	}

	async AddGlueJob(){
		let selectedRegion = await vscode.window.showInputBox({ placeHolder: 'Enter Region Eg: us-east-1', value: 'us-east-1' });
		if(selectedRegion===undefined){ return; }

		let selectedName = await vscode.window.showInputBox({ placeHolder: 'Enter Job Name / Search Text' });
		if(selectedName===undefined){ return; }

		let result = await api.GetGlueJobList(selectedRegion, selectedName);

		if(!result.isSuccessful){ return; }

		let selectedResourceList = await vscode.window.showQuickPick(result.result, {canPickMany:true, placeHolder: `Select Glue Job(s)`});
		if(!selectedResourceList || selectedResourceList.length===0){ return; }

		for(var name of selectedResourceList)
		{
			this.treeDataProvider.AddResource(selectedRegion, name, 'Job');
		}
		this.SaveState();
	}

	async RemoveGlueJob(node: GlueTreeItem) {
		this.treeDataProvider.RemoveResource(node.Region, node.ResourceName, node.TreeItemType);
		this.SaveState();
	}

	async Goto(node: GlueTreeItem) {
		ui.showInfoMessage("Work In Progress");
	}

	async RunJob(node: GlueTreeItem) {
		if(node.IsRunning) { return;}
		node.IsRunning = true;
		this.treeDataProvider.Refresh();
		
		let result = await api.StartGlueJobRun(node.Region, node.ResourceName);
		if(!result.isSuccessful)
		{
			ui.showErrorMessage('Run Job Error !!!', result.error);
			node.IsRunning = false;
			this.treeDataProvider.Refresh();
			return;
		}
		ui.showInfoMessage('Job Run Started Successfully');
		node.IsRunning = false;
		this.treeDataProvider.Refresh();
	}

	async SelectAwsProfile(node: GlueTreeItem) {
		var result = await api.GetAwsProfileList();
		if(!result.isSuccessful){ return; }

		let selectedAwsProfile = await vscode.window.showQuickPick(result.result, {canPickMany:false, placeHolder: 'Select Aws Profile'});
		if(!selectedAwsProfile){ return; }

		this.AwsProfile = selectedAwsProfile;
		this.SaveState();
	}

	async UpdateAwsEndPoint() {
		let awsEndPointUrl = await vscode.window.showInputBox({ placeHolder: 'Enter Aws End Point URL (Leave Empty To Return To Default)' });
		if(awsEndPointUrl===undefined){ return; }
		this.AwsEndPoint = awsEndPointUrl || undefined;
		this.SaveState();
		this.Refresh();
	}

	async PrintResource(node: GlueTreeItem) {
		let result = await api.GetGlueJobDescription(node.Region, node.ResourceName);
		if(!result.isSuccessful)
		{
			ui.showErrorMessage('Get Resource Description Error !!!', result.error);
			return;
		}
		let jsonString = JSON.stringify(result.result, null, 2);
		ui.ShowTextDocument(jsonString, "json");
	}

	async ViewLog(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.LogStream) return;
		
		let logGroupName = "";
		if (node.Payload && node.Payload.LogGroupName) {
			logGroupName = node.Payload.LogGroupName;
		} else if (node.Parent) {
			logGroupName = node.Parent.label!;
		}

		if (!logGroupName) return;
		
		CloudWatchLogView.Render(this.context.extensionUri, node.Region, logGroupName, node.ResourceName);
	}

	async RefreshLogStreams(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.LogGroup) return;

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: `Aws Glue: Loading Log Streams for ${node.label}...`,
		}, async (progress, token) => {
			let resultLogs = await api.GetLatestLogGroupLogStreamList(node.Region, node.label!);
			if(!resultLogs.isSuccessful) {
				ui.showErrorMessage('Get Logs Error!', resultLogs.error);
				return;
			}
			this.LogStreamsCache[node.label!] = resultLogs.result;
			this.treeDataProvider.Refresh();
		});
	}

	async RefreshRuns(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.RunGroup || !node.Parent) return;

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: `Aws Glue: Loading Runs for ${node.Parent.ResourceName}...`,
		}, async (progress, token) => {
			let resultRuns = await api.GetGlueJobRuns(node.Region, node.Parent!.ResourceName);
			if(!resultRuns.isSuccessful) {
				ui.showErrorMessage('Get Runs Error!', resultRuns.error);
				return;
			}
			this.JobRunsCache[node.Parent!.ResourceName] = resultRuns.result;
			ui.logToOutput(`Fetched ${resultRuns.result.length} runs for ${node.Parent!.ResourceName}`);
			this.treeDataProvider.Refresh();
		});
	}

	async RefreshJobInfo(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.Info || !node.Parent) return;

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: `Aws Glue: Loading Info for ${node.Parent.ResourceName}...`,
		}, async (progress, token) => {
			let result = await api.GetGlueJobDescription(node.Region, node.Parent!.ResourceName);
			if(!result.isSuccessful) {
				ui.showErrorMessage('Get Job Info Error!', result.error);
				return;
			}
			this.JobInfoCache[node.Parent!.ResourceName] = result.result;
			this.treeDataProvider.Refresh(node);
		});
	}

	private parseS3Location(location: string): { bucket: string, key: string } {
		const match = location.match(/^s3:\/\/([^\/]+)\/(.+)$/i);
		if(!match) {
			throw new Error(`Invalid S3 location: ${location}`);
		}
		return { bucket: match[1], key: match[2] };
	}

	private async getJobInfo(jobName: string, region: string) {
		if(!this.JobInfoCache[jobName]) {
			const result = await api.GetGlueJobDescription(region, jobName);
			if(!result.isSuccessful) {
				throw result.error || new Error("Failed to load job info");
			}
			this.JobInfoCache[jobName] = result.result;
		}
		return this.JobInfoCache[jobName];
	}

	async DownloadJobCode(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.Code) return;

		try {
			const jobName = node.ResourceName;
			const jobInfo = await this.getJobInfo(jobName, node.Region);
			const scriptLocation = jobInfo?.Command?.ScriptLocation as string | undefined;
			if(!scriptLocation) {
				ui.showInfoMessage('Script location not found in job');
				return;
			}

			const { bucket, key } = this.parseS3Location(scriptLocation);
			const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || this.context.globalStorageUri.fsPath;
			const defaultPath = join(defaultFolder, basename(key || jobName));
			const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath), saveLabel: 'Download Job Code' });
			if(!target) { return; }

			ui.logToOutput(`Downloading Glue job code from ${scriptLocation}`);
			const result = await api.DownloadS3Object(node.Region, bucket, key);
			if(!result.isSuccessful) {
				ui.showErrorMessage('Download job code failed', result.error);
				return;
			}

			await vscode.workspace.fs.writeFile(target, Buffer.from(result.result));
			ui.showInfoMessage(`Glue job code downloaded to ${target.fsPath}`);
		} catch (error: any) {
			ui.showErrorMessage('Download job code error', error);
		}
	}

	async UploadJobCode(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.Code) return;

		try {
			const jobName = node.ResourceName;
			const codePath = this.JobCodePaths[jobName];
			
			if(!codePath) {
				ui.showInfoMessage('No code path set. Please use "Set Code" first to select a file.');
				return;
			}

			const jobInfo = await this.getJobInfo(jobName, node.Region);
			const scriptLocation = jobInfo?.Command?.ScriptLocation as string | undefined;
			if(!scriptLocation) {
				ui.showInfoMessage('Script location not found in job');
				return;
			}

			const { bucket, key } = this.parseS3Location(scriptLocation);
			const fileUri = vscode.Uri.file(codePath);
			const content = await vscode.workspace.fs.readFile(fileUri);
			ui.logToOutput(`Uploading Glue job code to ${scriptLocation}`);
			const result = await api.UploadS3Object(node.Region, bucket, key, content);
			if(!result.isSuccessful) {
				ui.showErrorMessage('Upload job code failed', result.error);
				return;
			}

			ui.showInfoMessage(`Glue job code uploaded from ${codePath}`);
		} catch (error: any) {
			ui.showErrorMessage('Upload job code error', error);
		}
	}

	async TriggerRun(node: GlueTreeItem) {
		if (node.TreeItemType !== TreeItemType.Run) { return; }

		const jobName = node.Parent?.Parent?.ResourceName;
		const jobRunId = node.ResourceName;
		if (!jobName || !jobRunId) {
			ui.showInfoMessage('Unable to restart run: missing job or run id');
			return;
		}

		try {
			ui.logToOutput(`Restarting Glue job run ${jobRunId} for job ${jobName}`);
			const result = await api.RestartGlueJobRun(node.Region, jobName, jobRunId);
			if (!result.isSuccessful) {
				ui.showErrorMessage('Restart job run failed', result.error);
				return;
			}
			ui.showInfoMessage(`Restarted job run. New run id: ${result.result}`);
		} catch (error: any) {
			ui.showErrorMessage('Restart job run error', error);
		}
	}

	async ShowRunInfo(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.Run || !node.Payload) return;

		let run = node.Payload;
		let jsonString = JSON.stringify(run, null, 2);
		ui.ShowTextDocument(jsonString, "json");
	}

	async SetJobCode(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.Code) return;

		try {
			const jobName = node.ResourceName;
			const fileUris = await vscode.window.showOpenDialog({ 
				canSelectMany: false, 
				openLabel: 'Select Job Code File' 
			});
			if(!fileUris || fileUris.length === 0) { return; }

			const fileUri = fileUris[0];
			this.JobCodePaths[jobName] = fileUri.fsPath;
			this.SaveState();
			this.treeDataProvider.Refresh();
			ui.showInfoMessage(`Code path set for ${jobName}`);
		} catch (error: any) {
			ui.showErrorMessage('Set job code error', error);
		}
	}

	async UnsetJobCode(node: GlueTreeItem) {
		if(node.TreeItemType !== TreeItemType.Code) return;

		try {
			const jobName = node.ResourceName;
			delete this.JobCodePaths[jobName];
			this.SaveState();
			this.treeDataProvider.Refresh();
			ui.showInfoMessage(`Code path unset for ${jobName}`);
		} catch (error: any) {
			ui.showErrorMessage('Unset job code error', error);
		}
	}
}
