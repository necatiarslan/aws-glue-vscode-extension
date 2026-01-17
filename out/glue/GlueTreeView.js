"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlueTreeView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const GlueTreeItem_1 = require("./GlueTreeItem");
const GlueTreeDataProvider_1 = require("./GlueTreeDataProvider");
const ui = require("../common/UI");
const api = require("../common/API");
const CloudWatchLogView_1 = require("../cloudwatch/CloudWatchLogView");
const JobRunView_1 = require("./JobRunView");
const JobRunsReportView_1 = require("./JobRunsReportView");
const path_1 = require("path");
class GlueTreeView {
    static Current;
    view;
    treeDataProvider;
    context;
    FilterString = "";
    isShowOnlyFavorite = false;
    isShowHiddenNodes = false;
    AwsProfile = "default";
    AwsEndPoint;
    ResourceList = [];
    JobRunsCache = {};
    LogStreamsCache = {};
    JobInfoCache = {};
    JobCodePaths = {};
    JobTriggerFiles = {};
    constructor(context) {
        GlueTreeView.Current = this;
        this.context = context;
        this.LoadState();
        this.treeDataProvider = new GlueTreeDataProvider_1.GlueTreeDataProvider();
        this.view = vscode.window.createTreeView('GlueTreeView', { treeDataProvider: this.treeDataProvider, showCollapseAll: true });
        this.Refresh();
        context.subscriptions.push(this.view);
        this.SetFilterMessage();
    }
    async TestAwsConnection() {
        let response = await api.TestAwsCredentials();
        if (response.isSuccessful && response.result) {
            ui.showInfoMessage('Aws Credentials Test Successfull');
        }
        else {
            ui.showErrorMessage('Aws Credentials Test Error !!!', response.error);
        }
        let selectedRegion = await vscode.window.showInputBox({ placeHolder: 'Enter Region Eg: us-east-1', value: 'us-east-1' });
        if (selectedRegion === undefined) {
            return;
        }
        let response_conn = await api.TestAwsConnection(selectedRegion);
        if (response_conn.isSuccessful && response_conn.result) {
            ui.showInfoMessage('Aws Connection Test Successfull');
            ui.logToOutput(`Aws AccountId: ${response_conn.result.Account}, UserId: ${response_conn.result.UserId}, Arn: ${response_conn.result.Arn}`);
        }
        else {
            ui.showErrorMessage('Aws Connection Test Error !!!', response_conn.error);
        }
    }
    BugAndNewFeature() {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/necatiarslan/aws-glue-vscode-extension/issues/new'));
    }
    Donate() {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/necatiarslan'));
    }
    Refresh() {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: "Aws Glue: Loading...",
        }, (progress, token) => {
            progress.report({ increment: 0 });
            this.treeDataProvider.Refresh();
            return new Promise(resolve => { resolve(); });
        });
    }
    async AddToFav(node) {
        const resource = this.ResourceList.find(r => r.Region === node.Region && r.Name === node.ResourceName);
        if (resource) {
            resource.IsFav = true;
        }
        this.treeDataProvider.Refresh();
        this.SaveState();
    }
    async HideNode(node) {
        const resource = this.ResourceList.find(r => r.Region === node.Region && r.Name === node.ResourceName);
        if (resource) {
            resource.IsHidden = true;
        }
        this.treeDataProvider.Refresh();
        this.SaveState();
    }
    async UnHideNode(node) {
        const resource = this.ResourceList.find(r => r.Region === node.Region && r.Name === node.ResourceName);
        if (resource) {
            resource.IsHidden = false;
        }
        this.treeDataProvider.Refresh();
        this.SaveState();
    }
    async DeleteFromFav(node) {
        const resource = this.ResourceList.find(r => r.Region === node.Region && r.Name === node.ResourceName);
        if (resource) {
            resource.IsFav = false;
        }
        this.treeDataProvider.Refresh();
        this.SaveState();
    }
    async Filter() {
        let filterStringTemp = await vscode.window.showInputBox({ value: this.FilterString, placeHolder: 'Enter Your Filter Text' });
        if (filterStringTemp === undefined) {
            return;
        }
        this.FilterString = filterStringTemp;
        this.treeDataProvider.Refresh();
        this.SaveState();
        this.SetFilterMessage();
    }
    async ShowOnlyFavorite() {
        this.isShowOnlyFavorite = !this.isShowOnlyFavorite;
        this.treeDataProvider.Refresh();
        this.SaveState();
        this.SetFilterMessage();
    }
    async ShowHiddenNodes() {
        this.isShowHiddenNodes = !this.isShowHiddenNodes;
        this.treeDataProvider.Refresh();
        this.SaveState();
        this.SetFilterMessage();
    }
    async ShowOnlyInThisProfile(node) {
        const resource = this.ResourceList.find(r => r.Region === node.Region && r.Name === node.ResourceName);
        if (resource) {
            resource.Profile = this.AwsProfile;
        }
        this.treeDataProvider.Refresh();
        this.SaveState();
    }
    async ShowInAnyProfile(node) {
        const resource = this.ResourceList.find(r => r.Region === node.Region && r.Name === node.ResourceName);
        if (resource) {
            resource.Profile = undefined;
        }
        this.treeDataProvider.Refresh();
        this.SaveState();
    }
    GetBoolenSign(value) {
        return value ? "✓ " : "✗ ";
    }
    async SetFilterMessage() {
        if (this.ResourceList.length > 0) {
            this.view.message =
                await this.GetFilterProfilePrompt()
                    + this.GetBoolenSign(this.isShowOnlyFavorite) + "Fav, "
                    + this.GetBoolenSign(this.isShowHiddenNodes) + "Hidden, "
                    + (this.FilterString ? `Filter: ${this.FilterString}` : "");
        }
    }
    async GetFilterProfilePrompt() {
        return "Profile:" + this.AwsProfile + " ";
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
            this.context.globalState.update('JobTriggerFiles', this.JobTriggerFiles);
        }
        catch (error) { }
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
            this.JobTriggerFiles = this.context.globalState.get('JobTriggerFiles') || {};
        }
        catch (error) { }
    }
    async AddGlueJob() {
        let selectedRegion = await vscode.window.showInputBox({ placeHolder: 'Enter Region Eg: us-east-1', value: 'us-east-1' });
        if (selectedRegion === undefined) {
            return;
        }
        let selectedName = await vscode.window.showInputBox({ placeHolder: 'Enter Job Name / Search Text' });
        if (selectedName === undefined) {
            return;
        }
        let result = await api.GetGlueJobList(selectedRegion, selectedName);
        if (!result.isSuccessful) {
            return;
        }
        let selectedResourceList = await vscode.window.showQuickPick(result.result, { canPickMany: true, placeHolder: `Select Glue Job(s)` });
        if (!selectedResourceList || selectedResourceList.length === 0) {
            return;
        }
        for (var name of selectedResourceList) {
            this.treeDataProvider.AddResource(selectedRegion, name, 'Job', this.AwsProfile);
        }
        this.SaveState();
    }
    async RemoveGlueJob(node) {
        this.treeDataProvider.RemoveResource(node.Region, node.ResourceName, node.TreeItemType);
        this.SaveState();
    }
    async Goto(node) {
        ui.showInfoMessage("Work In Progress");
    }
    async RunJob(node) {
        JobRunView_1.JobRunView.Render(this.context.extensionUri, node.Region, node.ResourceName);
    }
    async ShowJobRunsReport(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.JobRunsReport) {
            return;
        }
        JobRunsReportView_1.JobRunsReportView.Render(this.context.extensionUri, node.Region, node.ResourceName);
    }
    async SelectAwsProfile(node) {
        var result = await api.GetAwsProfileList();
        if (!result.isSuccessful) {
            return;
        }
        let selectedAwsProfile = await vscode.window.showQuickPick(result.result, { canPickMany: false, placeHolder: 'Select Aws Profile' });
        if (!selectedAwsProfile) {
            return;
        }
        this.AwsProfile = selectedAwsProfile;
        this.SaveState();
        this.SetFilterMessage();
        this.treeDataProvider.Refresh();
    }
    async UpdateAwsEndPoint() {
        let awsEndPointUrl = await vscode.window.showInputBox({ placeHolder: 'Enter Aws End Point URL (Leave Empty To Return To Default)' });
        if (awsEndPointUrl === undefined) {
            return;
        }
        this.AwsEndPoint = awsEndPointUrl || undefined;
        this.SaveState();
        this.Refresh();
    }
    async PrintResource(node) {
        let result = await api.GetGlueJobDescription(node.Region, node.ResourceName);
        if (!result.isSuccessful) {
            ui.showErrorMessage('Get Resource Description Error !!!', result.error);
            return;
        }
        let jsonString = JSON.stringify(result.result, null, 2);
        ui.ShowTextDocument(jsonString, "json");
    }
    async ViewLog(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.LogStream)
            return;
        let logGroupName = "";
        if (node.Payload && node.Payload.LogGroupName) {
            logGroupName = node.Payload.LogGroupName;
        }
        else if (node.Parent) {
            logGroupName = node.Parent.label;
        }
        if (!logGroupName)
            return;
        CloudWatchLogView_1.CloudWatchLogView.Render(this.context.extensionUri, node.Region, logGroupName, node.ResourceName);
    }
    async RefreshLogStreams(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.LogGroup)
            return;
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Aws Glue: Loading Log Streams for ${node.label}...`,
        }, async (progress, token) => {
            let resultLogs = await api.GetLatestLogGroupLogStreamList(node.Region, node.label);
            if (!resultLogs.isSuccessful) {
                ui.showErrorMessage('Get Logs Error!', resultLogs.error);
                return;
            }
            this.LogStreamsCache[node.label] = resultLogs.result;
            this.treeDataProvider.Refresh();
        });
    }
    async RefreshRuns(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.RunGroup || !node.Parent)
            return;
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Aws Glue: Loading Runs for ${node.Parent.ResourceName}...`,
        }, async (progress, token) => {
            let resultRuns = await api.GetGlueJobRuns(node.Region, node.Parent.ResourceName);
            if (!resultRuns.isSuccessful) {
                ui.showErrorMessage('Get Runs Error!', resultRuns.error);
                return;
            }
            this.JobRunsCache[node.Parent.ResourceName] = resultRuns.result;
            ui.logToOutput(`Fetched ${resultRuns.result.length} runs for ${node.Parent.ResourceName}`);
            this.treeDataProvider.Refresh();
        });
    }
    async RefreshJobInfo(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Info || !node.Parent)
            return;
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Aws Glue: Loading Info for ${node.Parent.ResourceName}...`,
        }, async (progress, token) => {
            let result = await api.GetGlueJobDescription(node.Region, node.Parent.ResourceName);
            if (!result.isSuccessful) {
                ui.showErrorMessage('Get Job Info Error!', result.error);
                return;
            }
            this.JobInfoCache[node.Parent.ResourceName] = result.result;
            this.treeDataProvider.Refresh(node);
        });
    }
    parseS3Location(location) {
        const match = location.match(/^s3:\/\/([^\/]+)\/(.+)$/i);
        if (!match) {
            throw new Error(`Invalid S3 location: ${location}`);
        }
        return { bucket: match[1], key: match[2] };
    }
    async getJobInfo(jobName, region) {
        if (!this.JobInfoCache[jobName]) {
            const result = await api.GetGlueJobDescription(region, jobName);
            if (!result.isSuccessful) {
                throw result.error || new Error("Failed to load job info");
            }
            this.JobInfoCache[jobName] = result.result;
        }
        return this.JobInfoCache[jobName];
    }
    async DownloadJobCode(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Code)
            return;
        try {
            const jobName = node.ResourceName;
            const jobInfo = await this.getJobInfo(jobName, node.Region);
            const scriptLocation = jobInfo?.Command?.ScriptLocation;
            if (!scriptLocation) {
                ui.showInfoMessage('Script location not found in job');
                return;
            }
            const { bucket, key } = this.parseS3Location(scriptLocation);
            const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || this.context.globalStorageUri.fsPath;
            const defaultPath = (0, path_1.join)(defaultFolder, (0, path_1.basename)(key || jobName));
            const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(defaultPath), saveLabel: 'Download Job Code' });
            if (!target) {
                return;
            }
            ui.logToOutput(`Downloading Glue job code from ${scriptLocation}`);
            const result = await api.DownloadS3Object(node.Region, bucket, key);
            if (!result.isSuccessful) {
                ui.showErrorMessage('Download job code failed', result.error);
                return;
            }
            await vscode.workspace.fs.writeFile(target, Buffer.from(result.result));
            ui.showInfoMessage(`Glue job code downloaded to ${target.fsPath}`);
        }
        catch (error) {
            ui.showErrorMessage('Download job code error', error);
        }
    }
    async UploadJobCode(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Code)
            return;
        try {
            const jobName = node.ResourceName;
            const codePath = this.JobCodePaths[jobName];
            if (!codePath) {
                ui.showInfoMessage('No code path set. Please use "Set Code" first to select a file.');
                return;
            }
            const jobInfo = await this.getJobInfo(jobName, node.Region);
            const scriptLocation = jobInfo?.Command?.ScriptLocation;
            if (!scriptLocation) {
                ui.showInfoMessage('Script location not found in job');
                return;
            }
            const { bucket, key } = this.parseS3Location(scriptLocation);
            const fileUri = vscode.Uri.file(codePath);
            const content = await vscode.workspace.fs.readFile(fileUri);
            ui.logToOutput(`Uploading Glue job code to ${scriptLocation}`);
            const result = await api.UploadS3Object(node.Region, bucket, key, content);
            if (!result.isSuccessful) {
                ui.showErrorMessage('Upload job code failed', result.error);
                return;
            }
            ui.showInfoMessage(`Glue job code uploaded from ${codePath}`);
        }
        catch (error) {
            ui.showErrorMessage('Upload job code error', error);
        }
    }
    async TriggerRun(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Run) {
            return;
        }
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
        }
        catch (error) {
            ui.showErrorMessage('Restart job run error', error);
        }
    }
    async ShowRunInfo(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Run || !node.Payload)
            return;
        let run = node.Payload;
        let jsonString = JSON.stringify(run, null, 2);
        ui.ShowTextDocument(jsonString, "json");
    }
    async SetJobCode(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Code)
            return;
        try {
            const jobName = node.ResourceName;
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Select Job Code File'
            });
            if (!fileUris || fileUris.length === 0) {
                return;
            }
            const fileUri = fileUris[0];
            this.JobCodePaths[jobName] = fileUri.fsPath;
            this.SaveState();
            this.treeDataProvider.Refresh();
            ui.showInfoMessage(`Code path set for ${jobName}`);
        }
        catch (error) {
            ui.showErrorMessage('Set job code error', error);
        }
    }
    async UnsetJobCode(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Code)
            return;
        try {
            const jobName = node.ResourceName;
            delete this.JobCodePaths[jobName];
            this.SaveState();
            this.treeDataProvider.Refresh();
            ui.showInfoMessage(`Code path unset for ${jobName}`);
        }
        catch (error) {
            ui.showErrorMessage('Unset job code error', error);
        }
    }
    async TriggerWithPayload(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.TriggerWithPayload) {
            return;
        }
        JobRunView_1.JobRunView.Render(this.context.extensionUri, node.Region, node.ResourceName);
    }
    async TriggerWithoutPayload(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.TriggerWithoutPayload) {
            return;
        }
        const jobName = node.Parent?.ResourceName;
        if (!jobName) {
            ui.showErrorMessage('Unable to start run: missing job name', new Error('missing job name'));
            return;
        }
        try {
            ui.logToOutput(`Starting Glue job ${jobName} without payload`);
            const result = await api.StartGlueJobRun(node.Region, jobName);
            if (!result.isSuccessful) {
                ui.showErrorMessage('Start job run failed', result.error);
                return;
            }
            ui.showInfoMessage(`Job run started. Run id: ${result.result}`);
        }
        catch (error) {
            ui.showErrorMessage('Start job run error', error);
        }
    }
    async AddTriggerFile(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Trigger) {
            return;
        }
        try {
            const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Select Trigger File',
                filters: { 'JSON': ['json'] }
            });
            if (!fileUris || fileUris.length === 0) {
                return;
            }
            const filePath = fileUris[0].fsPath;
            const jobName = node.ResourceName;
            if (!this.JobTriggerFiles[jobName]) {
                this.JobTriggerFiles[jobName] = [];
            }
            if (!this.JobTriggerFiles[jobName].includes(filePath)) {
                this.JobTriggerFiles[jobName].push(filePath);
                this.SaveState();
                this.treeDataProvider.Refresh();
                ui.showInfoMessage(`Trigger file added: ${filePath}`);
            }
            else {
                ui.showInfoMessage('Trigger file already added');
            }
        }
        catch (error) {
            ui.showErrorMessage('Add trigger file error', error);
        }
    }
    async RemoveTriggerFile(jobName, filePath) {
        if (this.JobTriggerFiles[jobName]) {
            this.JobTriggerFiles[jobName] = this.JobTriggerFiles[jobName].filter(f => f !== filePath);
            if (this.JobTriggerFiles[jobName].length === 0) {
                delete this.JobTriggerFiles[jobName];
            }
            this.SaveState();
            this.treeDataProvider.Refresh();
        }
    }
    async TriggerFromFile(node) {
        JobRunView_1.JobRunView.Render(this.context.extensionUri, node.Region, node.ResourceName, node.Payload?.filePath);
    }
    async OpenJobCode(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Code)
            return;
        try {
            const jobName = node.ResourceName;
            const codePath = this.JobCodePaths[jobName];
            if (!codePath) {
                ui.showInfoMessage('No code path set. Please use "Set Code" first to select a file.');
                return;
            }
            const fileUri = vscode.Uri.file(codePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            ui.showErrorMessage('Open job code error', error);
        }
    }
    async DiffJobCode(node) {
        if (node.TreeItemType !== GlueTreeItem_1.TreeItemType.Code)
            return;
        try {
            const jobName = node.ResourceName;
            const codePath = this.JobCodePaths[jobName];
            if (!codePath) {
                ui.showInfoMessage('No code path set. Please use "Set Code" first to select a file.');
                return;
            }
            const jobInfo = await this.getJobInfo(jobName, node.Region);
            const scriptLocation = jobInfo?.Command?.ScriptLocation;
            if (!scriptLocation) {
                ui.showInfoMessage('Script location not found in job');
                return;
            }
            const { bucket, key } = this.parseS3Location(scriptLocation);
            ui.logToOutput(`Downloading Glue job code from ${scriptLocation} for diff`);
            const result = await api.DownloadS3Object(node.Region, bucket, key);
            if (!result.isSuccessful) {
                ui.showErrorMessage('Download job code failed', result.error);
                return;
            }
            const tempDir = this.context.globalStorageUri.fsPath;
            const tempFileName = `${jobName}_s3.${key.split('.').pop() || 'txt'}`;
            const tempPath = (0, path_1.join)(tempDir, tempFileName);
            const tempUri = vscode.Uri.file(tempPath);
            await vscode.workspace.fs.writeFile(tempUri, Buffer.from(result.result));
            const localUri = vscode.Uri.file(codePath);
            const title = `${(0, path_1.basename)(codePath)} (local) ↔ ${(0, path_1.basename)(key)} (S3)`;
            await vscode.commands.executeCommand('vscode.diff', localUri, tempUri, title);
        }
        catch (error) {
            ui.showErrorMessage('Diff job code error', error);
        }
    }
}
exports.GlueTreeView = GlueTreeView;
//# sourceMappingURL=GlueTreeView.js.map