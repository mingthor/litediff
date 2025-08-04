import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiffCompare } from './DiffCompare';

export class DiffPanel {
    public static currentPanel: DiffPanel | undefined;
    public static readonly viewType = 'liteDiff';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (DiffPanel.currentPanel) {
            DiffPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            DiffPanel.viewType,
            'Lite Diff',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-ui')],
            }
        );

        DiffPanel.currentPanel = new DiffPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the extension is deactivated
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'compare':
                        const { pathA, pathB } = message;
                        if (pathA && pathB) {
                            const differ = new DiffCompare();
                            const results = await differ.compare(pathA, pathB);
                            this._panel.webview.postMessage({
                                command: 'displayResults',
                                results: results
                            });
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        DiffPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Lite Diff';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Local path to main script run in the webview
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'main.js')
        );
        // Local path to css for the webview
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'main.css')
        );

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>Lite Diff</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
