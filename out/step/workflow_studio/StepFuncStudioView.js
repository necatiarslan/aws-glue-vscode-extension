"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * AWS Workflow Studio View for visualizing Step Functions
 * Based on AWS Toolkit for VS Code implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepFuncStudioView = void 0;
const vscode = require("vscode");
const ui = require("../../common/UI");
const types_1 = require("./types");
const handleMessage_1 = require("./handleMessage");
/**
 * Displays AWS Workflow Studio for visualizing and editing Step Function definitions
 */
class StepFuncStudioView {
    static Current;
    _panel;
    _disposables = [];
    extensionUri;
    aslDefinition;
    stepFuncName;
    constructor(panel, extensionUri, stepFuncName, aslDefinition) {
        ui.logToOutput('StepFuncStudioView.constructor Started');
        this.stepFuncName = stepFuncName;
        this.aslDefinition = aslDefinition;
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        // Set up message handler
        this._disposables.push(this._panel.webview.onDidReceiveMessage(async (message) => {
            const context = {
                stepFuncName: this.stepFuncName,
                mode: types_1.WorkflowMode.Readonly,
                panel: this._panel,
                aslDefinition: this.aslDefinition,
                extensionUri: this.extensionUri,
            };
            await (0, handleMessage_1.handleMessage)(message, context);
        }));
        this.RenderHtml();
        ui.logToOutput('StepFuncStudioView.constructor Completed');
    }
    /**
     * Renders the webview HTML content
     */
    async RenderHtml() {
        ui.logToOutput('StepFuncStudioView.RenderHtml Started');
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, this.extensionUri);
        ui.logToOutput('StepFuncStudioView.RenderHtml Completed');
    }
    /**
     * Main entry point to render the Workflow Studio
     */
    static async Render(extensionUri, stepFuncName, aslDefinition) {
        ui.logToOutput('StepFuncStudioView.Render Started');
        try {
            if (StepFuncStudioView.Current) {
                StepFuncStudioView.Current.stepFuncName = stepFuncName;
                StepFuncStudioView.Current.aslDefinition = aslDefinition;
                StepFuncStudioView.Current.RenderHtml();
                StepFuncStudioView.Current._panel.reveal(vscode.ViewColumn.One);
            }
            else {
                const panel = vscode.window.createWebviewPanel('StepFuncStudioView', `Workflow Studio: ${stepFuncName}`, vscode.ViewColumn.One, {
                    enableScripts: true,
                    enableFindWidget: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [extensionUri],
                });
                StepFuncStudioView.Current = new StepFuncStudioView(panel, extensionUri, stepFuncName, aslDefinition);
            }
        }
        catch (error) {
            ui.logToOutput('StepFuncStudioView.Render Error !!!', error);
            ui.showErrorMessage('Failed to open Workflow Studio', error);
        }
    }
    /**
     * Generates the webview HTML content with Workflow Studio
     */
    _getWebviewContent(webview, extensionUri) {
        ui.logToOutput('StepFuncStudioView._getWebviewContent Started');
        const aslDataJson = JSON.stringify(this.aslDefinition);
        // Use AWS CDN for Workflow Studio
        const workflowStudioCdn = 'https://d5t62uwepi9lu.cloudfront.net';
        const html = /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Workflow Studio - ${this.stepFuncName}</title>
    <base href='${workflowStudioCdn}'/>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            width: 100%;
            height: 100vh;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }
        #root {
            width: 100%;
            height: 100%;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">Loading Workflow Studio...</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const aslDefinition = ${aslDataJson};
        
        // Initialize Workflow Studio with the ASL definition
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'ASL_DEFINITION') {
                console.log('Received ASL Definition:', message.definition);
                // Workflow Studio will be initialized by the CDN content
            }
        });

        // Notify the extension that the webview is ready
        vscode.postMessage({
            command: 'INIT',
            messageType: 'REQUEST'
        });
    </script>
</body>
</html>
        `;
        ui.logToOutput('StepFuncStudioView._getWebviewContent Completed');
        return html;
    }
    /**
     * Cleanup and dispose resources
     */
    dispose() {
        ui.logToOutput('StepFuncStudioView.dispose Started');
        StepFuncStudioView.Current = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        ui.logToOutput('StepFuncStudioView.dispose Completed');
    }
}
exports.StepFuncStudioView = StepFuncStudioView;
//# sourceMappingURL=StepFuncStudioView.js.map