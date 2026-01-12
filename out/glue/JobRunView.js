"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRunView = void 0;
/* eslint-disable @typescript-eslint/naming-convention */
const vscode = require("vscode");
const ui = require("../common/UI");
const api = require("../common/API");
const CloudWatchLogView_1 = require("../cloudwatch/CloudWatchLogView");
class JobRunView {
    static Current;
    panel;
    disposables = [];
    extensionUri;
    state;
    triggerFilePath;
    constructor(panel, extensionUri, region, jobName, triggerFilePath) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.triggerFilePath = triggerFilePath;
        this.state = {
            region,
            jobName,
            args: [],
            isRunning: false,
        };
        this.panel.onDidDispose(this.dispose, null, this.disposables);
        this.panel.webview.onDidReceiveMessage(this.handleMessage, this, this.disposables);
        this.loadDefaultArgs();
        this.render();
    }
    static Render(extensionUri, region, jobName, triggerFilePath) {
        ui.logToOutput(`JobRunView.Render ${jobName} @ ${region}` + (triggerFilePath ? ` with file: ${triggerFilePath}` : ''));
        if (JobRunView.Current) {
            JobRunView.Current.state.region = region;
            JobRunView.Current.state.jobName = jobName;
            JobRunView.Current.triggerFilePath = triggerFilePath;
            JobRunView.Current.loadDefaultArgs();
            JobRunView.Current.render();
            return;
        }
        const panel = vscode.window.createWebviewPanel("JobRunView", `Job: ${jobName}`, vscode.ViewColumn.One, {
            enableScripts: true,
        });
        JobRunView.Current = new JobRunView(panel, extensionUri, region, jobName, triggerFilePath);
    }
    async loadDefaultArgs() {
        try {
            const res = await api.GetGlueJobDescription(this.state.region, this.state.jobName);
            if (!res.isSuccessful || !res.result) {
                this.state.args = [];
                if (this.triggerFilePath) {
                    await this.loadTriggerFileArgs();
                }
                this.render();
                return;
            }
            const defaults = res.result.Command?.DefaultArguments || {};
            let args = Object.keys(defaults).map(k => ({ key: k, value: String(defaults[k]), enabled: false, isDefault: true }));
            // If trigger file is provided, load args from file
            if (this.triggerFilePath) {
                args = await this.loadArgsFromTriggerFile(this.triggerFilePath) || args;
            }
            this.state.args = args;
            this.render();
        }
        catch (err) {
            ui.logToOutput("JobRunView.loadDefaultArgs error", err);
            this.state.args = [];
            this.render();
        }
    }
    async loadTriggerFileArgs() {
        if (!this.triggerFilePath) {
            return;
        }
        this.state.args = await this.loadArgsFromTriggerFile(this.triggerFilePath) || [];
    }
    async loadArgsFromTriggerFile(filePath) {
        try {
            const fileUri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(fileUri);
            const text = new TextDecoder().decode(content);
            const json = JSON.parse(text);
            if (typeof json === 'object' && json !== null) {
                return Object.keys(json).map(k => ({ key: k, value: String(json[k]), enabled: true }));
            }
        }
        catch (err) {
            ui.logToOutput("JobRunView.loadArgsFromTriggerFile error", err);
        }
        return undefined;
    }
    render() {
        this.panel.webview.html = this.getHtml(this.panel.webview, this.extensionUri);
    }
    sendState() {
        this.panel.webview.postMessage({ type: "state", state: this.state });
    }
    async handleMessage(message) {
        switch (message.command) {
            case "ready":
                this.sendState();
                return;
            case "start":
                await this.startRun(message.args);
                return;
            case "stop":
                await this.stopRun();
                return;
            case "openLogs":
                await this.openLogs(message.kind);
                return;
            default:
                return;
        }
    }
    async startRun(argsInput) {
        const argsList = argsInput ?? this.state.args;
        const activeArgs = (argsList || []).filter(a => a.enabled).reduce((acc, cur) => {
            if (cur.key) {
                acc[cur.key] = cur.value;
            }
            return acc;
        }, {});
        try {
            ui.logToOutput(`Starting Glue job ${this.state.jobName}`);
            const res = await api.StartGlueJobRun(this.state.region, this.state.jobName, Object.keys(activeArgs).length ? activeArgs : undefined);
            if (!res.isSuccessful) {
                ui.showErrorMessage("Start job run failed", res.error);
                return;
            }
            const runId = res.result;
            this.state.isRunning = true;
            this.state.currentRunId = runId;
            await this.updateRunDetails();
            this.sendState();
            ui.showInfoMessage(`Job run started. Run id: ${runId}`);
        }
        catch (err) {
            ui.showErrorMessage("Start job run error", err);
        }
    }
    async stopRun() {
        if (!this.state.currentRunId) {
            ui.showInfoMessage("No active run to stop");
            return;
        }
        try {
            const res = await api.StopGlueJobRun(this.state.region, this.state.jobName, this.state.currentRunId);
            if (!res.isSuccessful) {
                ui.showErrorMessage("Stop job run failed", res.error);
                return;
            }
            this.state.isRunning = false;
            this.sendState();
            ui.showInfoMessage(`Stop requested for run ${this.state.currentRunId}`);
        }
        catch (err) {
            ui.showErrorMessage("Stop job run error", err);
        }
    }
    async updateRunDetails() {
        if (!this.state.currentRunId) {
            return;
        }
        try {
            const res = await api.GetGlueJobRun(this.state.region, this.state.jobName, this.state.currentRunId);
            if (res.isSuccessful && res.result) {
                const run = res.result;
                const outputGroup = run.LogGroupName ? `${run.LogGroupName}/output` : undefined;
                const errorGroup = run.ErrorLogGroupName ? `${run.ErrorLogGroupName}/error` : undefined;
                this.state.outputLogGroup = outputGroup;
                this.state.errorLogGroup = errorGroup;
            }
        }
        catch (err) {
            ui.logToOutput("JobRunView.updateRunDetails error", err);
        }
    }
    async openLogs(kind) {
        const group = kind === "output" ? this.state.outputLogGroup : this.state.errorLogGroup;
        if (!group) {
            ui.showInfoMessage("Log group not available yet. Start a run first.");
            return;
        }
        const stream = this.state.currentRunId;
        if (!stream) {
            ui.showInfoMessage("Run id not set yet.");
            return;
        }
        CloudWatchLogView_1.CloudWatchLogView.Render(this.extensionUri, this.state.region, group, stream);
    }
    getHtml(webview, extensionUri) {
        const codiconsUri = ui.getUri(webview, extensionUri, ["node_modules", "@vscode", "codicons", "dist", "codicon.css"]);
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource} https:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${codiconsUri}" rel="stylesheet" />
  <style>
    body { font-family: var(--vscode-font-family); margin: 0; padding: 12px; }
    h2 { margin-top: 0; }
    .row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .arg-row { display: grid; grid-template-columns: 120px 1fr 1fr 80px; gap: 6px; align-items: center; margin-bottom: 4px; }
    input[type="text"] { width: 100%; }
    .muted { opacity: 0.7; }
    .spinner { display: inline-flex; align-items: center; gap: 6px; }
    .spinner .codicon { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .btn-row { display: flex; gap: 8px; margin-top: 12px; }
    .badge { padding: 2px 6px; border-radius: 4px; background: var(--vscode-editor-inactiveSelectionBackground); }
  </style>
</head>
<body>
  <h2 id="title">Job</h2>
  <div class="row">
    <span class="badge" id="region"></span>
    <span class="badge" id="runId"></span>
    <span class="spinner" id="spinner" style="display:none;"><span class="codicon codicon-sync"></span>Running...</span>
  </div>

  <h3>Arguments</h3>
  <div id="args"></div>
  <div class="row">
    <button id="addArg">Add Argument</button>
  </div>

  <div class="btn-row">
    <button id="start">Trigger</button>
    <button id="stop">Stop</button>
    <button id="logsOut">Output Logs</button>
    <button id="logsErr">Error Logs</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const stateEl = { title: document.getElementById('title'), region: document.getElementById('region'), runId: document.getElementById('runId'), spinner: document.getElementById('spinner'), args: document.getElementById('args') };

    function renderArgs(args) {
      stateEl.args.innerHTML = '';
      (args || []).forEach((arg, idx) => {
        const row = document.createElement('div');
        row.className = 'arg-row';

        const enable = document.createElement('input');
        enable.type = 'checkbox';
        enable.checked = !!arg.enabled;
        enable.addEventListener('change', () => {
          arg.enabled = enable.checked;
          keyInput.disabled = !arg.enabled;
          valInput.disabled = !arg.enabled;
          removeBtn.disabled = !arg.enabled;
        });

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.value = arg.key || '';
        keyInput.disabled = !arg.enabled;
        keyInput.addEventListener('input', () => arg.key = keyInput.value);

        const valInput = document.createElement('input');
        valInput.type = 'text';
        valInput.value = arg.value || '';
        valInput.disabled = !arg.enabled;
        valInput.addEventListener('input', () => arg.value = valInput.value);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.disabled = !arg.enabled;
        removeBtn.addEventListener('click', () => {
          args.splice(idx, 1);
          renderArgs(args);
        });

        row.appendChild(enable);
        row.appendChild(keyInput);
        row.appendChild(valInput);
        row.appendChild(removeBtn);
        stateEl.args.appendChild(row);
      });
    }

    function render(state) {
      stateEl.title.textContent = 'Job: ' + state.jobName;
      stateEl.region.textContent = 'Region: ' + state.region;
      stateEl.runId.textContent = state.currentRunId ? ('Run: ' + state.currentRunId) : '';
      stateEl.spinner.style.display = state.isRunning ? 'inline-flex' : 'none';
      renderArgs(state.args || []);
    }

    document.getElementById('addArg').addEventListener('click', () => {
      const st = currentState || { args: [] };
      st.args.push({ key: '', value: '', enabled: true });
      renderArgs(st.args);
    });

    document.getElementById('start').addEventListener('click', () => {
      vscode.postMessage({ command: 'start', args: (currentState?.args || []) });
    });

    document.getElementById('stop').addEventListener('click', () => {
      vscode.postMessage({ command: 'stop' });
    });

    document.getElementById('logsOut').addEventListener('click', () => {
      vscode.postMessage({ command: 'openLogs', kind: 'output' });
    });

    document.getElementById('logsErr').addEventListener('click', () => {
      vscode.postMessage({ command: 'openLogs', kind: 'error' });
    });

    let currentState = undefined;
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'state') {
        currentState = message.state;
        render(currentState);
      }
    });

    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
    }
    getNonce() {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    dispose() {
        JobRunView.Current = undefined;
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
exports.JobRunView = JobRunView;
//# sourceMappingURL=JobRunView.js.map