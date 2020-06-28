# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

# get version from __version__ variable in posx/__init__.py
from posx import __version__ as version

setup(
    name="posx",
    version=version,
    description="ERPNext POS Extended",
    author="Libermatic",
    author_email="info@libermatic.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
