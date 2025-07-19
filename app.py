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

@app.route('/diff', methods=['POST'])
def diff_files():
    """
    Compares files in two directories and returns the differences.
    """
    data = request.get_json()
    dir1 = data.get('dir1')
    dir2 = data.get('dir2')

    if not dir1 or not dir2:
        return jsonify({'error': 'Please provide two directories.'}), 400

    if not os.path.isdir(dir1) or not os.path.isdir(dir2):
        return jsonify({'error': 'Invalid directory path provided. '}), 400

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

                # Create a side-by-side HTML diff
                differ = difflib.HtmlDiff(wrapcolumn=80)
                diff_html = differ.make_table(lines1, lines2, fromdesc=f'File in {dir1}', todesc=f'File in {dir2}')
                
                diffs.append({
                    'file': file,
                    'diff': diff_html,
                    'status': 'modified'
                })
            except Exception as e:
                diffs.append({
                    'file': file,
                    'error': f'Could not compare file: {e}',
                    'status': 'error'
                })
        
        # Handle files only in directory 1
        for file in unique_to_dir1:
             diffs.append({
                'file': file,
                'status': 'unique_to_dir1'
            })

        # Handle files only in directory 2
        for file in unique_to_dir2:
            diffs.append({
                'file': file,
                'status': 'unique_to_dir2'
            })


        return jsonify({'diffs': diffs})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # It's recommended to use a production-ready server like Gunicorn or Waitress
    # For development, the Flask dev server is fine.
    app.run(debug=True)
