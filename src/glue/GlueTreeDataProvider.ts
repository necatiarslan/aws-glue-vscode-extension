/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { GlueTreeItem, TreeItemType } from './GlueTreeItem';
import { GlueTreeView } from './GlueTreeView';
import * as api from '../common/API';

export class GlueTreeDataProvider implements vscode.TreeDataProvider<GlueTreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<GlueTreeItem | undefined | void> = new vscode.EventEmitter<GlueTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<GlueTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	constructor() { }

	Refresh(): void {
		this._onDidChangeTreeData.fire();
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
			if (element.TreeItemType === TreeItemType.LogGroup) {
				// Log streams will be added dynamically by RefreshLogStreams
				return element.ResourceName.split('|').map(s => new GlueTreeItem(s, TreeItemType.LogStream, element.Region, s, vscode.TreeItemCollapsibleState.None, undefined, element)).filter(node => node.label !== element.ResourceName);
			}
			if (element.TreeItemType === TreeItemType.RunGroup) {
				// Runs will be added dynamically by RefreshRuns
				return element.ResourceName.split('|').map(s => new GlueTreeItem(s, TreeItemType.Run, element.Region, s, vscode.TreeItemCollapsibleState.None, undefined, element)).filter(node => node.label !== element.ResourceName);
			}
			return [];
		} else {
			let items: GlueTreeItem[] = [];
			let resourceList = GlueTreeView.Current.ResourceList;

			for (let res of resourceList) {
				if (GlueTreeView.Current.FilterString && !res.Name.includes(GlueTreeView.Current.FilterString)) continue;
				
				let type = res.Type as TreeItemType;
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

	AddLogStreams(node: GlueTreeItem, streams: string[]) {
		node.ResourceName = streams.join('|'); // Hacky way to store children in ResourceName for demo
		this.Refresh();
	}

	AddRuns(node: GlueTreeItem, runs: any[]) {
		node.ResourceName = runs.map(r => `${r.Id} (${r.JobRunState})`).join('|');
		this.Refresh();
	}
}