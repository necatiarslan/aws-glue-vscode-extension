/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { GlueTreeItem, TreeItemType } from './GlueTreeItem';
import { GlueTreeView } from './GlueTreeView';
import * as api from '../common/API';

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
					new GlueTreeItem("Runs", TreeItemType.RunGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
					new GlueTreeItem("/aws-glue/jobs/output", TreeItemType.LogGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
					new GlueTreeItem("/aws-glue/jobs/error", TreeItemType.LogGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element)
				];
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
					let runLabel = `${run.Id} (${run.JobRunState})`;
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
				let details = [
					`Id: ${run.Id}`,
					`Status: ${run.JobRunState}`,
					`Started: ${run.StartedOn ? new Date(run.StartedOn).toLocaleString() : 'N/A'}`,
					`Completed: ${run.CompletedOn ? new Date(run.CompletedOn).toLocaleString() : 'N/A'}`,
					`ExecutionTime: ${run.ExecutionTime}s`,
					`ErrorMessage: ${run.ErrorMessage || 'None'}`
				];
				return details.map(d => new GlueTreeItem(d, TreeItemType.Detail, element.Region, "", vscode.TreeItemCollapsibleState.None, undefined, element));
			}
			return [];
		} else {
			let items: GlueTreeItem[] = [];
			let resourceList = GlueTreeView.Current.ResourceList;

			for (let res of resourceList) {
				if (GlueTreeView.Current.FilterString && !res.Name.includes(GlueTreeView.Current.FilterString)) continue;
				
				let type = res.Type as TreeItemType;
				if (type !== TreeItemType.Job) {
					type = TreeItemType.Job; // Migration: default to Job
				}
				items.push(new GlueTreeItem(res.Name, type, res.Region, res.Name, vscode.TreeItemCollapsibleState.Collapsed));
			}

			return items;
		}
	}

	AddResource(region: string, name: string, type: string) {
		if (!GlueTreeView.Current.ResourceList.find(r => r.Region === region && r.Name === name && r.Type === type)) {
			GlueTreeView.Current.ResourceList.push({ Region: region, Name: name, Type: type });
			this.Refresh();
		}
	}

	RemoveResource(region: string, name: string, type: string) {
		GlueTreeView.Current.ResourceList = GlueTreeView.Current.ResourceList.filter(r => !(r.Region === region && r.Name === name && r.Type === type));
		this.Refresh();
	}


}