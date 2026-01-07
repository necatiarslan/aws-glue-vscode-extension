"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlueTreeDataProvider = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const GlueTreeItem_1 = require("./GlueTreeItem");
const GlueTreeView_1 = require("./GlueTreeView");
class GlueTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor() { }
    Refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            if (element.TreeItemType === GlueTreeItem_1.TreeItemType.Job) {
                return [
                    new GlueTreeItem_1.GlueTreeItem("Runs", GlueTreeItem_1.TreeItemType.RunGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
                    new GlueTreeItem_1.GlueTreeItem("/aws-glue/jobs/output", GlueTreeItem_1.TreeItemType.LogGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element),
                    new GlueTreeItem_1.GlueTreeItem("/aws-glue/jobs/error", GlueTreeItem_1.TreeItemType.LogGroup, element.Region, element.ResourceName, vscode.TreeItemCollapsibleState.Collapsed, undefined, element)
                ];
            }
            if (element.TreeItemType === GlueTreeItem_1.TreeItemType.LogGroup) {
                // Log streams will be added dynamically by RefreshLogStreams
                return element.ResourceName.split('|').map(s => new GlueTreeItem_1.GlueTreeItem(s, GlueTreeItem_1.TreeItemType.LogStream, element.Region, s, vscode.TreeItemCollapsibleState.None, undefined, element)).filter(node => node.label !== element.ResourceName);
            }
            if (element.TreeItemType === GlueTreeItem_1.TreeItemType.RunGroup) {
                // Runs will be added dynamically by RefreshRuns
                return element.ResourceName.split('|').map(s => new GlueTreeItem_1.GlueTreeItem(s, GlueTreeItem_1.TreeItemType.Run, element.Region, s, vscode.TreeItemCollapsibleState.None, undefined, element)).filter(node => node.label !== element.ResourceName);
            }
            return [];
        }
        else {
            let items = [];
            let resourceList = GlueTreeView_1.GlueTreeView.Current.ResourceList;
            for (let res of resourceList) {
                if (GlueTreeView_1.GlueTreeView.Current.FilterString && !res.Name.includes(GlueTreeView_1.GlueTreeView.Current.FilterString))
                    continue;
                let type = res.Type;
                items.push(new GlueTreeItem_1.GlueTreeItem(res.Name, type, res.Region, res.Name, vscode.TreeItemCollapsibleState.Collapsed));
            }
            return items;
        }
    }
    AddResource(region, name, type) {
        if (!GlueTreeView_1.GlueTreeView.Current.ResourceList.find(r => r.Region === region && r.Name === name && r.Type === type)) {
            GlueTreeView_1.GlueTreeView.Current.ResourceList.push({ Region: region, Name: name, Type: type });
            this.Refresh();
        }
    }
    RemoveResource(region, name, type) {
        GlueTreeView_1.GlueTreeView.Current.ResourceList = GlueTreeView_1.GlueTreeView.Current.ResourceList.filter(r => !(r.Region === region && r.Name === name && r.Type === type));
        this.Refresh();
    }
    AddLogStreams(node, streams) {
        node.ResourceName = streams.join('|'); // Hacky way to store children in ResourceName for demo
        this.Refresh();
    }
    AddRuns(node, runs) {
        node.ResourceName = runs.map(r => `${r.Id} (${r.JobRunState})`).join('|');
        this.Refresh();
    }
}
exports.GlueTreeDataProvider = GlueTreeDataProvider;
//# sourceMappingURL=GlueTreeDataProvider.js.map