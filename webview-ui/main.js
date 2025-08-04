const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', () => {
    const pathAInput = document.getElementById('pathA');
    const pathBInput = document.getElementById('pathB');
    const compareButton = document.getElementById('compare-button');

    if (compareButton && pathAInput && pathBInput) {
        compareButton.addEventListener('click', () => {
            const pathA = (pathAInput as HTMLInputElement).value;
            const pathB = (pathBInput as HTMLInputElement).value;

            vscode.postMessage({
                command: 'compare',
                pathA: pathA,
                pathB: pathB
            });
        });
    }

    // Handle messages from the extension
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data our extension sent
        switch (message.command) {
            case 'displayResults':
                // For now, we just log to console. Will display properly later.
                console.log('Received comparison results:', message.results);
                const resultsContainer = document.getElementById('results-container');
                if (resultsContainer) {
                    resultsContainer.innerHTML = ''; // Clear previous results
                    if (message.results && message.results.length > 0) {
                        message.results.forEach((result: any) => {
                            const div = document.createElement('div');
                            div.className = `diff-result-item status-${result.status}`;
                            div.textContent = `${result.status.toUpperCase()}: ${result.relativePath} (${result.isDirectory ? 'Directory' : 'File'})`;
                            resultsContainer.appendChild(div);
                        });
                    } else {
                        resultsContainer.textContent = 'No differences found or paths are identical.';
                    }
                }
                break;
        }
    });
});
