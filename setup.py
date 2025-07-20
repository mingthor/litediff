from setuptools import setup, find_packages

setup(
    name='litediff',
    version='0.1.2',
    author='mingthor',
    author_email='gaomingduke@gmail.com',
    description='A short description of my package.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/mingthor/litediff',
    packages=find_packages(),
    package_data={
        'litediff': ['templates/*.html'],
        # You can add more patterns or even other packages:
        # 'my_package': ['templates/*.html', 'data/*.json'],
    },
    include_package_data=True,
    license="MIT",
    classifiers=[
        'Programming Language :: Python :: 3',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.6', 
    # If your script has an entry point for command-line execution:
    entry_points={
        'console_scripts': [
            'litediff = litediff.app:main',
        ],
    },
)