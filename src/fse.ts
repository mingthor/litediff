import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiffSettings } from './settings';
import { minimatch } from 'minimatch';

export async function walkTree(directory: string, settings: DiffSettings): Promise<Map<string, fs.Stats>> {
    const fileMap = new Map<string, fs.Stats>();

    async function recurse(currentPath: string, relativePath: string) {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const entryRelativePath = path.join(relativePath, entry.name);

            // Check against exclude patterns
            if (settings.exclude.some(pattern => minimatch(entryRelativePath, pattern, { dot: true }))) {
                continue;
            }

            if (entry.isDirectory()) {
                fileMap.set(entryRelativePath, await fs.promises.stat(fullPath));
                await recurse(fullPath, entryRelativePath);
            } else if (entry.isFile()) {
                const stats = await fs.promises.stat(fullPath);
                // Enforce maxFileSize for content comparison, but still include in map
                if (stats.size <= settings.maxFileSize || settings.ignoreContents) {
                    fileMap.set(entryRelativePath, stats);
                } else {
                    // If file is too large, we still add it, but its content won't be compared later
                    fileMap.set(entryRelativePath, stats);
                }
            }
        }
    }

    if (fs.existsSync(directory)) {
        const stats = await fs.promises.stat(directory);
        if (stats.isDirectory()) {
            fileMap.set('', stats); // Add the root directory itself
            await recurse(directory, '');
        } else if (stats.isFile()) {
            fileMap.set(path.basename(directory), stats);
        }
    }

    return fileMap;
}
