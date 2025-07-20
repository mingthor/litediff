# LiteDiff
A file or directory diff web app

# Get Started

1. Install, `pip install litediff=0.1.2`

2. Start LiteDiff server, `litediff`

# Develop

## Install Dependencies
1. `pip install Flask`

## Run App
1. `python app.py` or `python litediff/app.py --path1 /path1 --path2 /path2`
2. Open browser on http://127.0.0.1:5000

## Test
1. `PYTHONPATH=. pytest litediff/tests`

## Publish

1. Install Packaging Tools, 
`pip install setuptools wheel twine`

2. Cleanup Build Artifacts, `rm -rf dist/ build/ *.egg-info/`

3. Build Distribution, `python setup.py sdist bdist_wheel`

4. Upload to PyPI, `twine upload dist/*`