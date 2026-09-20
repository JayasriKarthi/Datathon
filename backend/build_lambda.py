#!/usr/bin/env python3
"""Builds build/ (code + dependencies) for Lambda WITHOUT Docker.

`sam build` on Windows/macOS would install Windows/macOS wheels, which crash on Lambda
(pydantic-core, cryptography are compiled). This downloads Linux x86_64 wheels instead.

    python build_lambda.py
"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
BUILD = ROOT / "build"

shutil.rmtree(BUILD, ignore_errors=True)
BUILD.mkdir()
subprocess.check_call([
    sys.executable, "-m", "pip", "install", "-r", str(ROOT / "src" / "requirements.txt"),
    "--target", str(BUILD), "--upgrade", "--quiet",
    "--platform", "manylinux2014_x86_64", "--platform", "manylinux_2_28_x86_64",
    "--python-version", "3.12", "--implementation", "cp", "--only-binary=:all:",
])
shutil.copytree(ROOT / "src" / "app", BUILD / "app", ignore=shutil.ignore_patterns("__pycache__"))
for junk in BUILD.rglob("__pycache__"):
    shutil.rmtree(junk, ignore_errors=True)

size = sum(f.stat().st_size for f in BUILD.rglob("*") if f.is_file()) / 1e6
print(f"Built {BUILD} ({size:.0f} MB unzipped; Lambda limit is 250 MB)")
