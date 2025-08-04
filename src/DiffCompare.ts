import * as fs from 'fs';
import * as path from 'path';
import { SettingsService, DiffSettings } from './settings';
import { walkTree } from './fse';

export interface DiffResult {
    relativePath: string;
    pathA: string | null; // Full path on the left, or null if added
    pathB: string | null; // Full path on the right, or null if deleted
    status: 'unchanged' | 'modified' | 'added' | 'deleted' | 'conflict';
    isDirectory: boolean;
}

export class DiffCompare {
    private settingsService: SettingsService;

    constructor() {
        this.settingsService = SettingsService.getInstance();
    }

    public async compare(pathA: string, pathB: string): Promise<DiffResult[]> {
        const settings = this.settingsService.settings;
        const results: DiffResult[] = [];

        const mapA = await walkTree(pathA, settings);
        const mapB = await walkTree(pathB, settings);

        // Handle files/directories in A
        for (const [relativePath, statsA] of mapA.entries()) {
            const fullPathA = path.join(pathA, relativePath);
            const statsB = mapB.get(relativePath);

            if (statsB) {
                // Exists in both
                if (statsA.isDirectory() && statsB.isDirectory()) {
                    results.push({
                        relativePath,
                        pathA: fullPathA,
                        pathB: path.join(pathB, relativePath),
                        status: 'unchanged', // Directories are considered unchanged if they exist in both
                        isDirectory: true,
                    });
                } else if (statsA.isFile() && statsB.isFile()) {
                    const isModified = await this.isFileModified(fullPathA, path.join(pathB, relativePath), statsA, statsB, settings);
                    results.push({
                        relativePath,
                        pathA: fullPathA,
                        pathB: path.join(pathB, relativePath),
                        status: isModified ? 'modified' : 'unchanged',
                        isDirectory: false,
                    });
                } else {
                    // Type conflict (file vs directory)
                    results.push({
                        relativePath,
                        pathA: fullPathA,
                        pathB: path.join(pathB, relativePath),
                        status: 'conflict',
                        isDirectory: statsA.isDirectory() || statsB.isDirectory(), // At least one is a directory
                    });
                }
                mapB.delete(relativePath); // Mark as processed
            } else {
                // Only in A (deleted from B's perspective)
                results.push({
                    relativePath,
                    pathA: fullPathA,
                    pathB: null,
                    status: 'deleted',
                    isDirectory: statsA.isDirectory(),
                });
            }
        }

        // Handle files/directories only in B (added from A's perspective)
        for (const [relativePath, statsB] of mapB.entries()) {
            results.push({
                relativePath,
                pathA: null,
                pathB: path.join(pathB, relativePath),
                status: 'added',
                isDirectory: statsB.isDirectory(),
            });
        }

        // Sort results for consistent output
        results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

        return results;
    }

    private async isFileModified(
        pathA: string,
        pathB: string,
        statsA: fs.Stats,
        statsB: fs.Stats,
        settings: DiffSettings
    ): Promise<boolean> {
        if (settings.ignoreContents) {
            return statsA.size !== statsB.size;
        }

        if (statsA.size !== statsB.size) {
            return true; // Sizes differ, definitely modified
        }

        if (statsA.size > settings.maxFileSize) {
            // Too large for content comparison, rely on size only
            return false; // Sizes are the same, so consider unchanged based on this setting
        }

        // Read file contents
        const bufferA = await fs.promises.readFile(pathA);
        const bufferB = await fs.promises.readFile(pathB);

        if (!bufferA.equals(bufferB)) {
            // If buffers are not equal, it might be due to line endings or whitespace if settings apply
            if (settings.ignoreEndOfLine || settings.ignoreTrimWhitespace) {
                let contentA = bufferA.toString('utf8');
                let contentB = bufferB.toString('utf8');

                if (settings.ignoreEndOfLine) {
                    contentA = contentA.replace(/\r\n/g, '\n');
                    contentB = contentB.replace(/\r\n/g, '\n');
                }
                if (settings.ignoreTrimWhitespace) {
                    contentA = contentA.split('\n').map(line => line.trim()).join('\n');
                    contentB = contentB.split('\n').map(line => line.trim()).join('\n');
                }
                return contentA !== contentB;
            } else {
                return true; // Buffers are different and no special handling, so modified
            }
        }

        return false; // Contents are identical
    }
}
