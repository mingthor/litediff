import os
from flask import Flask, render_template, request, jsonify
import difflib

app = Flask(__name__)

def get_files_from_directory(directory):
    """
    Recursively gets all file paths from a directory.
    """
    file_paths = []
    for root, _, files in os.walk(directory):
        for file in files:
            # Create a relative path from the base directory
            relative_path = os.path.relpath(os.path.join(root, file), directory)
            file_paths.append(relative_path)
    return set(file_paths)

@app.route('/')
def index():
    """
    Renders the main HTML page.
    """
    return render_template('index.html')

def diff_directories(dir1, dir2, mode, include_unique=False):
    """
    Compares files in two directories and returns the differences.
    If include_unique is False, only diffs files with the same names for directories. This option does not apply to diffing files.
    """
    try:
        files1 = get_files_from_directory(dir1)
        files2 = get_files_from_directory(dir2)

        common_files = sorted(list(files1.intersection(files2)))
        unique_to_dir1 = sorted(list(files1 - files2))
        unique_to_dir2 = sorted(list(files2 - files1))
        
        diffs = []

        # Generate diffs for common files
        for file in common_files:
            file_path1 = os.path.join(dir1, file)
            file_path2 = os.path.join(dir2, file)

            try:
                with open(file_path1, 'r', encoding='utf-8', errors='ignore') as f1:
                    lines1 = f1.readlines()
                with open(file_path2, 'r', encoding='utf-8', errors='ignore') as f2:
                    lines2 = f2.readlines()

                if mode == 'html':
                    differ = difflib.HtmlDiff(wrapcolumn=80)
                    diff_output = differ.make_table(lines1, lines2, fromdesc=f'File in {dir1}', todesc=f'File in {dir2}')
                elif mode == 'unified':
                    diff_output = ''.join(difflib.unified_diff(
                        lines1, lines2, fromfile=f'File in {dir1}/{file}', tofile=f'File in {dir2}/{file}'
                    ))

                diffs.append({
                    'file': file,
                    'diff': diff_output,
                    'status': 'modified'
                })
            except Exception as e:
                diffs.append({
                    'file': file,
                    'error': f'Could not compare file: {e}',
                    'status': 'error'
                })
        
        if include_unique:
            for file in unique_to_dir1:
                handle_unique_file(file, dir1, mode, 'unique_to_dir1', diffs, is_dir1=True)
            for file in unique_to_dir2:
                handle_unique_file(file, dir2, mode, 'unique_to_dir2', diffs, is_dir1=False)

        return jsonify({'diffs': diffs})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def handle_unique_file(file, dir_path, mode, status, diffs, is_dir1):
    file_path = os.path.join(dir_path, file)
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        if mode == 'unified':
            if is_dir1:
                diff_output = ''.join(difflib.unified_diff(
                    lines, [], fromfile=f'File in {dir_path}/{file}', tofile=f'/dev/null'
                ))
            else:
                diff_output = ''.join(difflib.unified_diff(
                    [], lines, fromfile=f'/dev/null', tofile=f'File in {dir_path}/{file}'
                ))
            diffs.append({
                'file': file,
                'diff': diff_output,
                'status': status
            })
        else:
            diffs.append({
                'file': file,
                'status': status
            })
    except Exception as e:
        diffs.append({
            'file': file,
            'error': f'Could not read file: {e}',
            'status': 'error'
        })

@app.route('/diff', methods=['POST'])
def diff_logic():
    """
    Acts as a controller to determine if the user wants to diff
    two files or two directories based on the provided paths.
    """
    data = request.get_json()
    path1 = data.get('path1')
    path2 = data.get('path2')
    mode = data.get('mode', 'html')  # Default to 'html' mode
    include_unique = data.get('includeUnique', False) 

    if not path1 or not path2:
        return jsonify({'error': 'Please provide paths for both inputs.'}), 400

    # Check if paths are valid
    if not os.path.exists(path1):
        return jsonify({'error': f'Invalid path: {path1}. The path does not exist.'}), 400
    if not os.path.exists(path2):
        return jsonify({'error': f'Invalid path: {path2}. The path does not exist.'}), 400

    # Case 1: Both paths are directories
    if os.path.isdir(path1) and os.path.isdir(path2):
        return diff_directories(path1, path2, mode, include_unique)

    # Case 2: Both paths are files
    if os.path.isfile(path1) and os.path.isfile(path2):
        return diff_files(path1, path2, mode)

    # Case 3: Mismatched types (e.g., file and directory)
    return jsonify({'error': 'Mismatched types: Please provide two files or two directories to compare.'}), 400

def diff_files(file1_path, file2_path, mode):
    """
    Compares two individual files and returns the difference.
    """
    try:
        with open(file1_path, 'r', encoding='utf-8', errors='ignore') as f1:
            lines1 = f1.readlines()
        with open(file2_path, 'r', encoding='utf-8', errors='ignore') as f2:
            lines2 = f2.readlines()
        
        # Use the basename for the display name
        file_display_name = f"{os.path.basename(file1_path)} vs {os.path.basename(file2_path)}"

        if mode == 'html':
            differ = difflib.HtmlDiff(wrapcolumn=80)
            diff_output = differ.make_table(lines1, lines2, fromdesc=file1_path, todesc=file2_path)
        elif mode == 'unified':
            diff_output = ''.join(difflib.unified_diff(
                lines1, lines2, fromfile=file1_path, tofile=file2_path
            ))
        
        diffs = [{
            'file': file_display_name,
            'diff': diff_output,
            'status': 'modified'
        }]

        return jsonify({'diffs': diffs})
    except Exception as e:
        return jsonify({'error': f'Could not compare files: {e}'}), 500

def main():
    """
    Main function to run the Flask app.
    """
    app.run(debug=True)

if __name__ == '__main__':
    main()
