import os
import sys
import tempfile
import shutil
import pytest
import json
from flask import Flask
from subprocess import Popen, PIPE
from multiprocessing import Process
import time
import requests

import importlib.util

# Helper to import app as a module
spec = importlib.util.spec_from_file_location("app", os.path.join(os.path.dirname(__file__), "../app.py"))
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

@pytest.fixture
def client():
    app = app_module.app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_diff_endpoint(client):
    dir1 = tempfile.mkdtemp()
    dir2 = tempfile.mkdtemp()
    try:
        with open(os.path.join(dir1, 'a.txt'), 'w') as f:
            f.write('foo\nbar\n')
        with open(os.path.join(dir2, 'a.txt'), 'w') as f:
            f.write('foo\nbaz\n')
        resp = client.post('/diff', json={
            'path1': dir1,
            'path2': dir2,
            'mode': 'unified',
            'includeUnique': True
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'diffs' in data
        assert any(d['file'] == 'a.txt' for d in data['diffs'])
    finally:
        shutil.rmtree(dir1)
        shutil.rmtree(dir2)

def test_diff_invalid_path(client):
    resp = client.post('/diff', json={
        'path1': '/not/exist/1',
        'path2': '/not/exist/2',
        'mode': 'unified',
        'includeUnique': True
    })
    assert resp.status_code == 400
    data = resp.get_json()
    assert 'error' in data

def run_flask_with_cli_args(path1, path2, mode='unified', include_unique=False):
    # Start the Flask app as a subprocess with CLI args
    script = os.path.abspath(os.path.join(os.path.dirname(__file__), '../app.py'))
    args = [sys.executable, script, '--path1', path1, '--path2', path2, '--mode', mode]
    if include_unique:
        args.append('--include-unique')
    proc = Popen(args, stdout=PIPE, stderr=PIPE)
    # Wait for server to start
    time.sleep(2)
    return proc

def test_root_with_cli_args(tmp_path):
    # Create two files to diff
    file1 = tmp_path / 'f1.txt'
    file2 = tmp_path / 'f2.txt'
    file1.write_text('foo\nbar\n')
    file2.write_text('foo\nbaz\n')
    proc = run_flask_with_cli_args(str(file1), str(file2), mode='unified')
    try:
        # Try to get the diff from the root endpoint
        for _ in range(10):
            try:
                resp = requests.get('http://127.0.0.1:5000/')
                if resp.status_code == 200 and '<html' in resp.text:
                    break
            except Exception:
                time.sleep(0.5)
        else:
            raise AssertionError('Flask app did not start or did not return HTML')
        # Check that the HTML contains the diff file name
        assert 'f1.txt' in resp.text or 'f2.txt' in resp.text
        assert 'diff' in resp.text or 'Diff' in resp.text
    finally:
        proc.terminate()
        proc.wait()

def test_diff_endpoint_with_files(tmp_path, client):
    file1 = tmp_path / 'f1.txt'
    file2 = tmp_path / 'f2.txt'
    file1.write_text('foo\nbar\n')
    file2.write_text('foo\nbaz\n')
    resp = client.post('/diff', json={
        'path1': str(file1),
        'path2': str(file2),
        'mode': 'unified',
        'includeUnique': False
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'diffs' in data
    assert any('diff' in d for d in data['diffs'])
