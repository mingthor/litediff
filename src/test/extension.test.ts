import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { SettingsService, DiffSettings } from '../settings';
import { walkTree } from '../fse';
import { DiffCompare, DiffResult } from '../DiffCompare';

// Helper to create a temporary directory and files
async function createTestDir(dirPath: string, files: { [key: string]: string | null }): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
    for (const fileName in files) {
        const filePath = path.join(dirPath, fileName);
        if (files[fileName] === null) { // Indicate a directory
            await fs.promises.mkdir(filePath, { recursive: true });
        } else {
            await fs.promises.writeFile(filePath, files[fileName] as string);
        }
    }
}

// Helper to clean up a directory
async function cleanTestDir(dirPath: string): Promise<void> {
    if (fs.existsSync(dirPath)) {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
    }
}

suite('Lite Diff Extension Tests', () => {
    const testWorkspacePath = path.join(__dirname, '..', '..', 'test-workspace');

    setup(async () => {
        await cleanTestDir(testWorkspacePath);
    });

    teardown(async () => {
        await cleanTestDir(testWorkspacePath);
    });

    test('SettingsService should load default settings', () => {
        const settingsService = SettingsService.getInstance();
        const settings = settingsService.settings;

        assert.deepStrictEqual(settings.exclude, []);
        assert.strictEqual(settings.maxFileSize, 10 * 1024 * 1024);
        assert.strictEqual(settings.ignoreContents, false);
        assert.strictEqual(settings.ignoreEndOfLine, false);
        assert.strictEqual(settings.ignoreTrimWhitespace, false);
    });

    test('walkTree should correctly scan files and directories', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA');
        await createTestDir(dirA, {
            'file1.txt': 'content1',
            'subdir/file2.txt': 'content2',
            'empty_subdir': null,
        });

        const settings: DiffSettings = {
            exclude: [],
            maxFileSize: 10 * 1024 * 1024,
            ignoreContents: false,
            ignoreEndOfLine: false,
            ignoreTrimWhitespace: false,
        };

        const fileMap = await walkTree(dirA, settings);

        assert.strictEqual(fileMap.size, 4); // dirA (root), file1.txt, subdir, subdir/file2.txt
        assert.ok(fileMap.has(''));
        assert.ok(fileMap.has('file1.txt'));
        assert.ok(fileMap.has('subdir'));
        assert.ok(fileMap.has('subdir/file2.txt'));
        assert.ok(fileMap.has('empty_subdir'));

        assert.strictEqual(fileMap.get('file1.txt')?.isFile(), true);
        assert.strictEqual(fileMap.get('subdir')?.isDirectory(), true);
    });

    test('walkTree should respect exclude patterns', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_exclude');
        await createTestDir(dirA, {
            'file1.txt': 'content1',
            'ignore_me.txt': 'ignored content',
            'temp/log.txt': 'log content',
            'temp/keep.txt': 'keep content',
        });

        const settings: DiffSettings = {
            exclude: ['ignore_me.txt', 'temp/**'],
            maxFileSize: 10 * 1024 * 1024,
            ignoreContents: false,
            ignoreEndOfLine: false,
            ignoreTrimWhitespace: false,
        };

        const fileMap = await walkTree(dirA, settings);

        assert.strictEqual(fileMap.size, 2); // dirA (root), file1.txt
        assert.ok(fileMap.has(''));
        assert.ok(fileMap.has('file1.txt'));
        assert.ok(!fileMap.has('ignore_me.txt'));
        assert.ok(!fileMap.has('temp'));
        assert.ok(!fileMap.has('temp/log.txt'));
        assert.ok(!fileMap.has('temp/keep.txt'));
    });

    test('DiffCompare should identify unchanged files', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_unchanged');
        const dirB = path.join(testWorkspacePath, 'dirB_unchanged');
        await createTestDir(dirA, { 'file.txt': 'same content' });
        await createTestDir(dirB, { 'file.txt': 'same content' });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        assert.strictEqual(results.length, 2); // Root dirs + file
        const fileResult = results.find(r => r.relativePath === 'file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'unchanged');
    });

    test('DiffCompare should identify modified files', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_modified');
        const dirB = path.join(testWorkspacePath, 'dirB_modified');
        await createTestDir(dirA, { 'file.txt': 'original content' });
        await createTestDir(dirB, { 'file.txt': 'modified content' });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        assert.strictEqual(results.length, 2);
        const fileResult = results.find(r => r.relativePath === 'file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'modified');
    });

    test('DiffCompare should identify added files', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_added');
        const dirB = path.join(testWorkspacePath, 'dirB_added');
        await createTestDir(dirA, {});
        await createTestDir(dirB, { 'new_file.txt': 'new content' });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        assert.strictEqual(results.length, 2);
        const fileResult = results.find(r => r.relativePath === 'new_file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'added');
    });

    test('DiffCompare should identify deleted files', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_deleted');
        const dirB = path.join(testWorkspacePath, 'dirB_deleted');
        await createTestDir(dirA, { 'deleted_file.txt': 'content' });
        await createTestDir(dirB, {});

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        assert.strictEqual(results.length, 2);
        const fileResult = results.find(r => r.relativePath === 'deleted_file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'deleted');
    });

    test('DiffCompare should handle ignoreEndOfLine setting', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_eol');
        const dirB = path.join(testWorkspacePath, 'dirB_eol');
        await createTestDir(dirA, { 'file.txt': 'line1\r\nline2' });
        await createTestDir(dirB, { 'file.txt': 'line1\nline2' });

        // Temporarily modify settings for this test
        const originalSettings = SettingsService.getInstance().settings;
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: { ...originalSettings, ignoreEndOfLine: true },
            configurable: true
        });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        const fileResult = results.find(r => r.relativePath === 'file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'unchanged');

        // Restore original settings
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: originalSettings,
            configurable: true
        });
    });

    test('DiffCompare should handle ignoreTrimWhitespace setting', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_whitespace');
        const dirB = path.join(testWorkspacePath, 'dirB_whitespace');
        await createTestDir(dirA, { 'file.txt': '  line1  \nline2\t' });
        await createTestDir(dirB, { 'file.txt': 'line1\nline2' });

        // Temporarily modify settings for this test
        const originalSettings = SettingsService.getInstance().settings;
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: { ...originalSettings, ignoreTrimWhitespace: true },
            configurable: true
        });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        const fileResult = results.find(r => r.relativePath === 'file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'unchanged');

        // Restore original settings
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: originalSettings,
            configurable: true
        });
    });

    test('DiffCompare should handle ignoreContents setting', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_ignore_content');
        const dirB = path.join(testWorkspacePath, 'dirB_ignore_content');
        await createTestDir(dirA, { 'file.txt': 'content1' });
        await createTestDir(dirB, { 'file.txt': 'content2' }); // Different content, same size

        // Temporarily modify settings for this test
        const originalSettings = SettingsService.getInstance().settings;
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: { ...originalSettings, ignoreContents: true },
            configurable: true
        });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        const fileResult = results.find(r => r.relativePath === 'file.txt');
        assert.ok(fileResult);
        assert.strictEqual(fileResult?.status, 'unchanged'); // Should be unchanged because content is ignored and size is same

        // Restore original settings
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: originalSettings,
            configurable: true
        });
    });

    test('DiffCompare should handle maxFileSize for content comparison', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_maxsize');
        const dirB = path.join(testWorkspacePath, 'dirB_maxsize');
        const largeContentA = 'a'.repeat(1000);
        const largeContentB = 'b'.repeat(1000);
        const smallContentA = 'small';
        const smallContentB = 'tiny';

        await createTestDir(dirA, {
            'large_file.txt': largeContentA,
            'small_file.txt': smallContentA,
        });
        await createTestDir(dirB, {
            'large_file.txt': largeContentB,
            'small_file.txt': smallContentB,
        });

        // Temporarily modify settings for this test: maxFileSize = 500 bytes
        const originalSettings = SettingsService.getInstance().settings;
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: { ...originalSettings, maxFileSize: 500 },
            configurable: true
        });

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        const largeFileResult = results.find(r => r.relativePath === 'large_file.txt');
        assert.ok(largeFileResult);
        assert.strictEqual(largeFileResult?.status, 'unchanged'); // Should be unchanged because content is not compared due to size, and sizes are same

        const smallFileResult = results.find(r => r.relativePath === 'small_file.txt');
        assert.ok(smallFileResult);
        assert.strictEqual(smallFileResult?.status, 'modified'); // Should be modified because content is compared and different

        // Restore original settings
        Object.defineProperty(SettingsService.getInstance(), '_settings', {
            value: originalSettings,
            configurable: true
        });
    });

    test('DiffCompare should identify conflict (file vs directory)', async () => {
        const dirA = path.join(testWorkspacePath, 'dirA_conflict');
        const dirB = path.join(testWorkspacePath, 'dirB_conflict');
        await createTestDir(dirA, { 'item': 'file content' });
        await createTestDir(dirB, { 'item': null }); // 'item' is a directory in B

        const differ = new DiffCompare();
        const results = await differ.compare(dirA, dirB);

        assert.strictEqual(results.length, 2);
        const conflictResult = results.find(r => r.relativePath === 'item');
        assert.ok(conflictResult);
        assert.strictEqual(conflictResult?.status, 'conflict');
    });
});