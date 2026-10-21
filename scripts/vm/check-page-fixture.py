"""Verify a generated QA fixture and that its existing output cannot be overwritten."""
import argparse
import hashlib
import io
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--desktop-zip", required=True, type=Path)
parser.add_argument("--fixture", required=True, type=Path)
args = parser.parse_args()
with zipfile.ZipFile(args.desktop_zip) as archive:
    template = archive.read("converter/empty/en-US/new.pptx")
with zipfile.ZipFile(io.BytesIO(template)) as original, zipfile.ZipFile(args.fixture) as fixture:
    assert original.namelist() == fixture.namelist(), "Package parts changed"
    for entry in original.namelist():
        if entry != "ppt/slides/slide1.xml":
            assert original.read(entry) == fixture.read(entry), "Non-slide part changed"
    tree = ET.fromstring(fixture.read("ppt/slides/slide1.xml"))
    ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main", "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
    assert len(tree.findall(".//p:sp", ns)) == 2
    assert len(tree.findall(".//a:p", ns)) == 3
    assert [node.text for node in tree.findall(".//a:t", ns)] == ["VM QA title", " Budget 950 ", "approved.", "Delivery 2026 confirmed."]
    assert [node.get("b") for node in tree.findall(".//a:rPr", ns)] == ["1", "1", "0", "0"]
before = hashlib.sha256(args.fixture.read_bytes()).digest()
result = subprocess.run([sys.executable, str(Path(__file__).with_name("create-page-fixture.py")), "--desktop-zip", str(args.desktop_zip), "--output", str(args.fixture)], capture_output=True, text=True)
assert result.returncode != 0 and "never overwritten" in result.stderr
assert before == hashlib.sha256(args.fixture.read_bytes()).digest(), "Existing file changed"
print("Fixture structure, spaces, numbers, mixed bold runs, untouched package parts and overwrite refusal verified. No editor was launched.")
