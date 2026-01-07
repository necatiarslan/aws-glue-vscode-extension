"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewType = exports.LambdaTreeDataProvider = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const StepTreeItem_1 = require("./StepTreeItem");
const StepTreeView_1 = require("./StepTreeView");
class LambdaTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    LambdaNodeList = [];
    constructor() {
    }
    Refresh() {
        if (this.LambdaNodeList.length === 0) {
            this.LoadLambdaNodeList();
        }
        this._onDidChangeTreeData.fire();
    }
    AddLambda(Region, Lambda) {
        for (var item of StepTreeView_1.LambdaTreeView.Current.LambdaList) {
            if (item.Region === Region && item.Lambda === Lambda) {
                return;
            }
        }
        StepTreeView_1.LambdaTreeView.Current.LambdaList.push({ Region: Region, Lambda: Lambda });
        this.AddNewLambdaNode(Region, Lambda);
        this.Refresh();
    }
    RemoveLambda(Region, Lambda) {
        for (var i = 0; i < StepTreeView_1.LambdaTreeView.Current.LambdaList.length; i++) {
            if (StepTreeView_1.LambdaTreeView.Current.LambdaList[i].Region === Region && StepTreeView_1.LambdaTreeView.Current.LambdaList[i].Lambda === Lambda) {
                StepTreeView_1.LambdaTreeView.Current.LambdaList.splice(i, 1);
                break;
            }
        }
        this.RemoveLambdaNode(Region, Lambda);
        this.Refresh();
    }
    AddResponsePayload(node, payloadString) {
        let now = new Date();
        let currentTime = now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0') + ':' +
            now.getSeconds().toString().padStart(2, '0');
        let treeItem = new StepTreeItem_1.LambdaTreeItem("Response - " + currentTime, StepTreeItem_1.TreeItemType.ResponsePayload);
        treeItem.Region = node.Region;
        treeItem.Lambda = node.Lambda;
        treeItem.ResponsePayload = payloadString;
        treeItem.Parent = node;
        node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        node.Children.push(treeItem);
        this.Refresh();
    }
    AddLogStreams(node, LogStreams) {
        for (var streamName of LogStreams) {
            if (node.Children.find((item) => item.LogStreamName === streamName)) {
                continue;
            }
            let treeItem = new StepTreeItem_1.LambdaTreeItem(streamName, StepTreeItem_1.TreeItemType.LogStream);
            treeItem.Region = node.Region;
            treeItem.Lambda = node.Lambda;
            treeItem.LogStreamName = streamName;
            treeItem.Parent = node;
            node.Children.push(treeItem);
        }
        this.Refresh();
    }
    LoadLambdaNodeList() {
        this.LambdaNodeList = [];
        for (var item of StepTreeView_1.LambdaTreeView.Current.LambdaList) {
            let treeItem = this.NewLambdaNode(item.Region, item.Lambda);
            this.LambdaNodeList.push(treeItem);
        }
    }
    AddNewLambdaNode(Region, Lambda) {
        if (this.LambdaNodeList.some(item => item.Region === Region && item.Lambda === Lambda)) {
            return;
        }
        let treeItem = this.NewLambdaNode(Region, Lambda);
        this.LambdaNodeList.push(treeItem);
    }
    RemoveLambdaNode(Region, Lambda) {
        for (var i = 0; i < this.LambdaNodeList.length; i++) {
            if (this.LambdaNodeList[i].Region === Region && this.LambdaNodeList[i].Lambda === Lambda) {
                this.LambdaNodeList.splice(i, 1);
                break;
            }
        }
    }
    NewLambdaNode(Region, Lambda) {
        let treeItem = new StepTreeItem_1.LambdaTreeItem(Lambda, StepTreeItem_1.TreeItemType.Lambda);
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        treeItem.Region = Region;
        treeItem.Lambda = Lambda;
        let codeItem = new StepTreeItem_1.LambdaTreeItem("Code", StepTreeItem_1.TreeItemType.Code);
        codeItem.Lambda = treeItem.Lambda;
        codeItem.Region = treeItem.Region;
        codeItem.Parent = treeItem;
        codeItem.CodePath = this.GetCodePath(treeItem.Region, treeItem.Lambda);
        treeItem.Children.push(codeItem);
        let triggerItem = new StepTreeItem_1.LambdaTreeItem("Trigger", StepTreeItem_1.TreeItemType.TriggerGroup);
        triggerItem.Lambda = treeItem.Lambda;
        triggerItem.Region = treeItem.Region;
        triggerItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        triggerItem.Parent = treeItem;
        treeItem.Children.push(triggerItem);
        let triggerWithPayload = new StepTreeItem_1.LambdaTreeItem("With Paylod", StepTreeItem_1.TreeItemType.TriggerWithPayload);
        triggerWithPayload.Lambda = treeItem.Lambda;
        triggerWithPayload.Region = treeItem.Region;
        triggerWithPayload.Parent = triggerItem;
        triggerItem.Children.push(triggerWithPayload);
        let triggerWithoutPayload = new StepTreeItem_1.LambdaTreeItem("Without Paylod", StepTreeItem_1.TreeItemType.TriggerNoPayload);
        triggerWithoutPayload.Lambda = treeItem.Lambda;
        triggerWithoutPayload.Region = treeItem.Region;
        triggerWithoutPayload.Parent = triggerItem;
        triggerItem.Children.push(triggerWithoutPayload);
        for (var i = 0; i < StepTreeView_1.LambdaTreeView.Current.PayloadPathList.length; i++) {
            if (StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].Region === Region
                && StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].Lambda === Lambda) {
                this.AddNewPayloadPathNode(triggerItem, StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].PayloadPath);
            }
        }
        let logsItem = new StepTreeItem_1.LambdaTreeItem("Logs", StepTreeItem_1.TreeItemType.LogGroup);
        logsItem.Lambda = treeItem.Lambda;
        logsItem.Region = treeItem.Region;
        logsItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        logsItem.Parent = treeItem;
        treeItem.Children.push(logsItem);
        return treeItem;
    }
    AddPayloadPath(node, PayloadPath) {
        for (var i = 0; i < StepTreeView_1.LambdaTreeView.Current.PayloadPathList.length; i++) {
            if (StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].Region === node.Region
                && StepTreeView_1.LambdaTreeView.Current.CodePathList[i].Lambda === node.Lambda
                && StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].PayloadPath === PayloadPath) {
                return;
            }
        }
        this.AddNewPayloadPathNode(node, PayloadPath);
        StepTreeView_1.LambdaTreeView.Current.PayloadPathList.push({ Region: node.Region, Lambda: node.Lambda, PayloadPath: PayloadPath });
        this.Refresh();
    }
    AddNewPayloadPathNode(node, PayloadPath) {
        let fileName = PayloadPath.split("/").pop();
        if (!fileName) {
            fileName = PayloadPath;
        }
        let treeItem = new StepTreeItem_1.LambdaTreeItem(fileName, StepTreeItem_1.TreeItemType.TriggerFilePayload);
        treeItem.Region = node.Region;
        treeItem.Lambda = node.Lambda;
        treeItem.PayloadPath = PayloadPath;
        treeItem.Parent = node;
        node.Children.push(treeItem);
    }
    RemovePayloadPath(node) {
        if (!node.Parent) {
            return;
        }
        for (var i = 0; i < StepTreeView_1.LambdaTreeView.Current.PayloadPathList.length; i++) {
            if (StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].Region === node.Region
                && StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].Lambda === node.Lambda
                && StepTreeView_1.LambdaTreeView.Current.PayloadPathList[i].PayloadPath === node.PayloadPath) {
                StepTreeView_1.LambdaTreeView.Current.PayloadPathList.splice(i, 1);
            }
        }
        let parentNode = node.Parent;
        for (var i = 0; i < parentNode.Children.length; i++) {
            if (parentNode.Children[i].Region === node.Region
                && parentNode.Children[i].Lambda === node.Lambda
                && parentNode.Children[i].PayloadPath === node.PayloadPath) {
                parentNode.Children.splice(i, 1);
            }
        }
        this.Refresh();
    }
    AddCodePath(Region, Lambda, CodePath) {
        //remove old
        for (var i = 0; i < StepTreeView_1.LambdaTreeView.Current.CodePathList.length; i++) {
            if (StepTreeView_1.LambdaTreeView.Current.CodePathList[i].Region === Region && StepTreeView_1.LambdaTreeView.Current.CodePathList[i].Lambda === Lambda) {
                StepTreeView_1.LambdaTreeView.Current.CodePathList.splice(i, 1);
            }
        }
        StepTreeView_1.LambdaTreeView.Current.CodePathList.push({ Region: Region, Lambda: Lambda, CodePath: CodePath });
        this.Refresh();
    }
    RemoveCodePath(Region, Lambda) {
        for (var i = 0; i < StepTreeView_1.LambdaTreeView.Current.CodePathList.length; i++) {
            if (StepTreeView_1.LambdaTreeView.Current.CodePathList[i].Region === Region && StepTreeView_1.LambdaTreeView.Current.CodePathList[i].Lambda === Lambda) {
                StepTreeView_1.LambdaTreeView.Current.CodePathList.splice(i, 1);
            }
        }
        this.Refresh();
    }
    GetCodePath(Region, Lambda) {
        for (var item of StepTreeView_1.LambdaTreeView.Current.CodePathList) {
            if (item.Region === Region && item.Lambda === Lambda) {
                return item.CodePath;
            }
        }
        return "";
    }
    getChildren(node) {
        let result = [];
        if (!node) {
            result.push(...this.GetLambdaNodes());
        }
        else if (node.Children.length > 0) {
            result.push(...node.Children);
        }
        return Promise.resolve(result);
    }
    GetLambdaNodes() {
        var result = [];
        for (var node of this.LambdaNodeList) {
            if (StepTreeView_1.LambdaTreeView.Current && StepTreeView_1.LambdaTreeView.Current.FilterString && !node.IsFilterStringMatch(StepTreeView_1.LambdaTreeView.Current.FilterString)) {
                continue;
            }
            if (StepTreeView_1.LambdaTreeView.Current && StepTreeView_1.LambdaTreeView.Current.isShowOnlyFavorite && !(node.IsFav || node.IsAnyChidrenFav())) {
                continue;
            }
            if (StepTreeView_1.LambdaTreeView.Current && !StepTreeView_1.LambdaTreeView.Current.isShowHiddenNodes && (node.IsHidden)) {
                continue;
            }
            result.push(node);
        }
        return result;
    }
    getTreeItem(element) {
        return element;
    }
}
exports.LambdaTreeDataProvider = LambdaTreeDataProvider;
var ViewType;
(function (ViewType) {
    ViewType[ViewType["Lambda"] = 1] = "Lambda";
})(ViewType || (exports.ViewType = ViewType = {}));
//# sourceMappingURL=LambdaTreeDataProvider.js.map