# Lite Diff VS Code Extension

Lite Diff is a VS Code extension designed to provide a lightweight and efficient way to compare files and folders directly within your editor. It helps developers quickly identify changes, additions, and deletions between two selected directories or files.

## Features

*   **File and Folder Comparison:** Easily compare the contents of two directories or individual files.
*   **Configurable Settings:** Customize comparison behavior, including file exclusion patterns, maximum file size for content comparison, and options to ignore line endings or whitespace.
*   **Intuitive User Interface:** A dedicated Webview panel allows you to select paths and view comparison results clearly.
*   **Status Indicators:** Clearly see which files are `unchanged`, `modified`, `added`, `deleted`, or in `conflict`.

## Requirements

*   Visual Studio Code 1.x.x or higher

## Extension Settings

This extension contributes the following settings under `litediff`:

*   `litediff.exclude`: An array of glob patterns to exclude files/folders from comparison.
*   `litediff.maxFileSize`: Maximum file size (in bytes) for content comparison. Files larger than this will only be compared by size.
*   `litediff.ignoreContents`: If true, only compare files by size and existence, not content.
*   `litediff.ignoreEndOfLine`: If true, normalize line endings (`\r\n` to `\n`) before content comparison.
*   `litediff.ignoreTrimWhitespace`: If true, trim leading/trailing whitespace per line before content comparison.

## Usage

1.  Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2.  Type `Lite Diff: Open Lite Diff Panel` and select the command.
3.  In the panel, enter the paths for the two files or folders you wish to compare.
4.  Click the "Compare" button to see the differences.

## Known Issues

No known issues at this time.

## Release Notes

### 0.0.1

Initial preview release of the Lite Diff extension. Includes basic file and folder comparison functionality with configurable settings and a preliminary Webview UI.

---

**Enjoy using Lite Diff!**