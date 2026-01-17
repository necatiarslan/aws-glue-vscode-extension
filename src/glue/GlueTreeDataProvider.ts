/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { GlueTreeItem, TreeItemType } from './GlueTreeItem';
import { GlueTreeView } from './GlueTreeView';

export class GlueTreeDataProvider implements vscode.TreeDataProvider<GlueTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<GlueTreeItem | undefined | void> = new vscode.EventEmitter<GlueTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<GlueTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	constructor() { }

	Refresh(node?: GlueTreeItem): void {
		this._onDidChangeTreeData.fire(node);
	}

	getTreeItem(element: GlueTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: GlueTreeItem): Promise<GlueTreeItem[]> {
		if (element) {
			if (element.TreeItemType === TreeItemType.Job) {
				return [
					new GlueTreeItem("Code", TreeItemType.Code, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
					new GlueTreeItem("Trigger", TreeItemType.Trigger, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
					new GlueTreeItem("Info", TreeItemType.Info, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
					new GlueTreeItem("Reports", TreeItemType.Reports, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
					new GlueTreeItem("Runs", TreeItemType.RunGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
				];
			}
			if (element.TreeItemType === TreeItemType.Reports) {
				return [
					new GlueTreeItem("Job Runs", TreeItemType.JobRunsReport, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.None, { command: 'GlueTreeView.ShowJobRunsReport', title: 'Show Job Runs Report', arguments: [element] }, element),
				];
			}
			if (element.TreeItemType === TreeItemType.Code) {
			let result: GlueTreeItem[] = [];
			const codePath = GlueTreeView.Current.JobCodePaths[element.ResourceName];
			if (codePath) {
				result.push(new GlueTreeItem(codePath, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
			}
			const jobInfo = await GlueTreeView.Current.getJobInfo(element.ResourceName, element.Region);
			const scriptLocation = jobInfo?.Command?.ScriptLocation as string | undefined;
			if (scriptLocation) {
				result.push(new GlueTreeItem(scriptLocation, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
			}
			return result;
		}
		if (element.TreeItemType === TreeItemType.Trigger) {
			const triggerFiles = GlueTreeView.Current.JobTriggerFiles[element.ResourceName] || [];
			const children: GlueTreeItem[] = [
				new GlueTreeItem("With Payload", TreeItemType.TriggerWithPayload, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.None, { command: 'GlueTreeView.TriggerWithPayload', title: 'Trigger With Payload', arguments: [element] }, element),
				new GlueTreeItem("Without Payload", TreeItemType.TriggerWithoutPayload, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.None, { command: 'GlueTreeView.TriggerWithoutPayload', title: 'Trigger Without Payload', arguments: [element] }, element),
			];
			for (const filePath of triggerFiles) {
				const fileName = filePath.split('/').pop() || filePath;
				children.push(new GlueTreeItem(fileName, TreeItemType.TriggerFile, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.None, { command: 'GlueTreeView.TriggerFromFile', title: 'Trigger From File', arguments: [{ jobName: element.ResourceName, region: element.Region, filePath }] }, element, { filePath }));
			}
			return children;
		}
			if (element.TreeItemType === TreeItemType.Info) {
				let jobInfo = element.Payload || GlueTreeView.Current.JobInfoCache[element.ResourceName];
				if (!jobInfo) return [new GlueTreeItem("No Data (Refresh to Load)", TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element)];
				
				let nodes: GlueTreeItem[] = [];
				for (let key in jobInfo) {
					let val = jobInfo[key];
					if (typeof val === 'object' && val !== null) {
						nodes.push(new GlueTreeItem(`${key}: ...`, TreeItemType.Info, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element, val));
					} else {
						nodes.push(new GlueTreeItem(`${key}: ${val}`, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
					}
				}
				return nodes;
			}
			if (element.TreeItemType === TreeItemType.RunGroup) {
				// Runs will be added dynamically by RefreshRuns
				let runs = element.Payload;
				if (element.Parent && GlueTreeView.Current.JobRunsCache[element.Parent.ResourceName]) {
					runs = GlueTreeView.Current.JobRunsCache[element.Parent.ResourceName];
				}

				if (!runs) return [];
				if (runs.length === 0) return [new GlueTreeItem("No Runs Found", TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element)];
				
				return (runs as any[]).map(run => {
					let runLabel = `${run.Id.substring(0, 10)} (${run.JobRunState})`;
					if (run.StartedOn) {
						runLabel += ` - ${new Date(run.StartedOn).toLocaleString()}`;
					}
					if (run.ExecutionTime) {
						runLabel += ` (${run.ExecutionTime}s)`;
					}
					return new GlueTreeItem(runLabel, TreeItemType.Run, element.Region, run.Id, vscode.TreeItemCollapsibleState.Collapsed, undefined, element, run);
				});
			}
			if (element.TreeItemType === TreeItemType.LogGroup) {
				// Log streams will be added dynamically by RefreshLogStreams
				let streams = GlueTreeView.Current.LogStreamsCache[element.label!];
				if (!streams) return [];
				if (streams.length === 0) return [new GlueTreeItem("No Logs Found", TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element)];
				
				return streams.map(s => new GlueTreeItem(s, TreeItemType.LogStream, element.Region, s, vscode.TreeItemCollapsibleState.None, undefined, element));
			}
			if (element.TreeItemType === TreeItemType.Run) {
				if (!element.Payload) return [];
				let run = element.Payload;
				let children: GlueTreeItem[] = [];

				// Log nodes
				let outLog = new GlueTreeItem("View Output Logs", TreeItemType.LogStream, element.Region, run.Id, vscode.TreeItemCollapsibleState.None, undefined, element, { LogGroupName: run.LogGroupName + "/output" });
				outLog.command = { command: 'GlueTreeView.ViewLog', title: 'View Log', arguments: [outLog] };
				children.push(outLog);

				let errLog = new GlueTreeItem("View Error Logs", TreeItemType.LogStream, element.Region, run.Id, vscode.TreeItemCollapsibleState.None, undefined, element, { LogGroupName: run.ErrorLogGroupName + "/error" });
				errLog.command = { command: 'GlueTreeView.ViewLog', title: 'View Log', arguments: [errLog] };
				children.push(errLog);

				// Arguments node
				if (run.Arguments) {
					children.push(new GlueTreeItem("Input Arguments", TreeItemType.Arguments, element.Region, "", vscode.TreeItemCollapsibleState.Collapsed, undefined, element, run.Arguments));
				}

				// Status details
				children.push(new GlueTreeItem(`Status: ${run.JobRunState}`, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
				children.push(new GlueTreeItem(`Started: ${run.StartedOn ? new Date(run.StartedOn).toLocaleString() : 'N/A'}`, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
				children.push(new GlueTreeItem(`ExecutionTime: ${run.ExecutionTime}s`, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
				children.push(new GlueTreeItem(`ErrorMessage: ${run.ErrorMessage || 'N/A'}`, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
				
				return children;
			}
			if (element.TreeItemType === TreeItemType.Arguments) {
				if (!element.Payload) return [];
				let args = element.Payload;
				return Object.keys(args).map(key => {
					return new GlueTreeItem(`${key}: ${args[key]}`, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element);
				});
			}
			return [];
		} else {
			let items: GlueTreeItem[] = [];
			let resourceList = GlueTreeView.Current.ResourceList;

			for (let res of resourceList) {
				if (GlueTreeView.Current.FilterString && !res.Name.includes(GlueTreeView.Current.FilterString)) continue;
				
				// Apply profile filter
				if (!GlueTreeView.Current.isShowHiddenNodes) {
					if (res.Profile && res.Profile !== GlueTreeView.Current.AwsProfile) continue;
				}
				
				let type = res.Type as TreeItemType;
				if (type !== TreeItemType.Job) {
					type = TreeItemType.Job; // Migration: default to Job
				}
				let item = new GlueTreeItem(res.Name, type, res.Region, res.Name, vscode.TreeItemCollapsibleState.Collapsed);
				
				// Set IsFav and IsHidden from resource list
				item.IsFav = res.IsFav || false;
				item.IsHidden = res.IsHidden || false;
				
				// Set contextValue based on profile, favorite, and hidden states
				let contextValue = "Job";
				if (res.Profile) {
					contextValue += "WithProfile";
				}
				if (item.IsFav) {
					contextValue += "Fav";
				}
				if (item.IsHidden) {
					contextValue += "Hidden";
				}
				item.contextValue = contextValue;
				
				// Apply favorite and hidden filters
				if (GlueTreeView.Current.isShowOnlyFavorite && !item.IsFav) continue;
				if (!GlueTreeView.Current.isShowHiddenNodes && item.IsHidden) continue;
				
				items.push(item);
			}

			return items;
		}
	}

	AddResource(region: string, name: string, type: string, profile?: string) {
		if (!GlueTreeView.Current.ResourceList.find(r => r.Region === region && r.Name === name && r.Type === type)) {
			GlueTreeView.Current.ResourceList.push({ Region: region, Name: name, Type: type, Profile: profile || GlueTreeView.Current.AwsProfile });
			this.Refresh();
		}
	}

	RemoveResource(region: string, name: string, type: string) {
		GlueTreeView.Current.ResourceList = GlueTreeView.Current.ResourceList.filter(r => !(r.Region === region && r.Name === name && r.Type === type));
		this.Refresh();
	}
}