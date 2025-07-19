import os
import tempfile
import shutil
import pytest
from app import diff_directories, app

def create_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def test_unique_files_unified():
    dir1 = tempfile.mkdtemp()
    dir2 = tempfile.mkdtemp()
    try:
        # Only in dir1
        create_file(os.path.join(dir1, 'unique1.txt'), 'only in dir1')
        # Only in dir2
        create_file(os.path.join(dir2, 'unique2.txt'), 'only in dir2')
        # Common file
        create_file(os.path.join(dir1, 'common.txt'), 'foo\nbar\n')
        create_file(os.path.join(dir2, 'common.txt'), 'foo\nbaz\n')

        with app.app_context():
            # include_unique True: unique files should be present in diffs
            resp = diff_directories(dir1, dir2, mode='unified', include_unique=True)
            data = resp.get_json()
            files = {d['file']: d for d in data['diffs']}
            assert 'unique1.txt' in files
            assert 'unique2.txt' in files
            assert files['unique1.txt']['status'] == 'unique_to_dir1'
            assert files['unique2.txt']['status'] == 'unique_to_dir2'
            assert files['unique1.txt']['diff'].startswith('--- File in')
            assert files['unique2.txt']['diff'].startswith('--- /dev/null') or files['unique2.txt']['diff'].startswith('--- File in')

            # include_unique False: unique files should NOT be present
            resp2 = diff_directories(dir1, dir2, mode='unified', include_unique=False)
            data2 = resp2.get_json()
            files2 = {d['file']: d for d in data2['diffs']}
            assert 'unique1.txt' not in files2
            assert 'unique2.txt' not in files2
            assert 'common.txt' in files2
    finally:
        shutil.rmtree(dir1)
        shutil.rmtree(dir2)

def test_identical_files_and_dirs():
    dir1 = tempfile.mkdtemp()
    dir2 = tempfile.mkdtemp()
    try:
        # Identical files in both dirs
        create_file(os.path.join(dir1, 'same.txt'), 'identical\ncontent\n')
        create_file(os.path.join(dir2, 'same.txt'), 'identical\ncontent\n')
        # Identical file in both dirs, but with different name
        create_file(os.path.join(dir1, 'foo.txt'), 'foo\n')
        create_file(os.path.join(dir2, 'foo.txt'), 'foo\n')

        with app.app_context():
            # Should show no differences for identical files
            resp = diff_directories(dir1, dir2, mode='unified', include_unique=True)
            data = resp.get_json()
            # All diffs for identical files should be empty
            for d in data['diffs']:
                if d['status'] == 'modified':
                    assert d['diff'].strip() == ''
    finally:
        shutil.rmtree(dir1)
        shutil.rmtree(dir2)

def test_different_files_and_dirs():
    dir1 = tempfile.mkdtemp()
    dir2 = tempfile.mkdtemp()
    try:
        # Different files in both dirs
        create_file(os.path.join(dir1, 'a.txt'), 'foo\nbar\n')
        create_file(os.path.join(dir2, 'a.txt'), 'foo\nbaz\n')
        # Unique files
        create_file(os.path.join(dir1, 'only1.txt'), 'dir1 only\n')
        create_file(os.path.join(dir2, 'only2.txt'), 'dir2 only\n')

        with app.app_context():
            resp = diff_directories(dir1, dir2, mode='unified', include_unique=True)
            data = resp.get_json()
            files = {d['file']: d for d in data['diffs']}
            # a.txt should have a non-empty diff
            assert 'a.txt' in files
            assert files['a.txt']['status'] == 'modified'
            assert files['a.txt']['diff'].strip() != ''
            # Unique files should be present
            assert 'only1.txt' in files
            assert 'only2.txt' in files
            assert files['only1.txt']['status'] == 'unique_to_dir1'
            assert files['only2.txt']['status'] == 'unique_to_dir2'
    finally:
        shutil.rmtree(dir1)
        shutil.rmtree(dir2)
