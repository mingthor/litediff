// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DiffPanel } from './DiffPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "litediff" is now active!');

    context.subscriptions.push(
        vscode.commands.registerCommand('litediff.openDiffPanel', () => {
            DiffPanel.createOrShow(context.extensionUri);
        })
    );
}

export function deactivate() {}
