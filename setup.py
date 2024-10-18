from setuptools import find_packages, setup

setup(
    name="flask_app",
    version="0.1.0",
    description="A Flask app that serves stats and random images",
    author="Joe",
    author_email="kenwood364@gmail.com",
    packages=find_packages(),
    include_package_data=True,
    install_requires=["Flask", "Pillow", "psutil", "numpy", "gunicorn"],
)
