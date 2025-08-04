import * as vscode from 'vscode';

export interface DiffSettings {
    exclude: string[];
    maxFileSize: number; // in bytes
    ignoreContents: boolean;
    ignoreEndOfLine: boolean;
    ignoreTrimWhitespace: boolean;
}

export class SettingsService {
    private static _instance: SettingsService;
    private _settings: DiffSettings;

    private constructor() {
        this._settings = this.loadSettings();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('litediff')) {
                this._settings = this.loadSettings();
            }
        });
    }

    public static getInstance(): SettingsService {
        if (!SettingsService._instance) {
            SettingsService._instance = new SettingsService();
        }
        return SettingsService._instance;
    }

    private loadSettings(): DiffSettings {
        const config = vscode.workspace.getConfiguration('litediff');
        return {
            exclude: config.get<string[]>('exclude', []),
            maxFileSize: config.get<number>('maxFileSize', 10 * 1024 * 1024), // Default to 10MB
            ignoreContents: config.get<boolean>('ignoreContents', false),
            ignoreEndOfLine: config.get<boolean>('ignoreEndOfLine', false),
            ignoreTrimWhitespace: config.get<boolean>('ignoreTrimWhitespace', false),
        };
    }

    public get settings(): DiffSettings {
        return this._settings;
    }
}
