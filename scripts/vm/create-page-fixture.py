"""Create a synthetic PPTX fixture without launching an editor (stdlib only)."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--desktop-zip", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
expected = json.loads((root / "versions.json").read_text("utf-8"))["desktopDistributionSha256"]
with args.desktop_zip.open("rb") as archive_file:
    digest = hashlib.file_digest(archive_file, "sha256").hexdigest()
if digest != expected:
    parser.error("Desktop archive checksum mismatch")
if args.output.exists():
    parser.error("Choose a new output file; existing files are never overwritten")
with zipfile.ZipFile(args.desktop_zip) as archive:
    template = archive.read("converter/empty/en-US/new.pptx")

a = "http://schemas.openxmlformats.org/drawingml/2006/main"
p = "http://schemas.openxmlformats.org/presentationml/2006/main"
for prefix, uri in {"a": a, "p": p, "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}.items():
    ET.register_namespace(prefix, uri)
groups = [
    [[("VM QA title", True)]],
    [[(" Budget 950 ", True), ("approved.", False)], [("Delivery 2026 confirmed.", False)]],
]
with zipfile.ZipFile(io.BytesIO(template)) as source:
    tree = ET.fromstring(source.read("ppt/slides/slide1.xml"))
    bodies = tree.findall(f".//{{{p}}}txBody")
    if len(bodies) != len(groups):
        parser.error("Unexpected pinned template shape structure")
    for body, paragraphs in zip(bodies, groups):
        for paragraph in body.findall(f"{{{a}}}p"):
            body.remove(paragraph)
        for runs in paragraphs:
            paragraph = ET.SubElement(body, f"{{{a}}}p")
            for text, bold in runs:
                run = ET.SubElement(paragraph, f"{{{a}}}r")
                ET.SubElement(run, f"{{{a}}}rPr", {"lang": "en-US", "b": "1" if bold else "0", "sz": "2400"})
                ET.SubElement(run, f"{{{a}}}t").text = text
    slide = ET.tostring(tree, encoding="utf-8", xml_declaration=True)
    with zipfile.ZipFile(args.output, "x", zipfile.ZIP_DEFLATED) as output:
        for entry in source.infolist():
            output.writestr(entry, slide if entry.filename == "ppt/slides/slide1.xml" else source.read(entry.filename))
print(json.dumps({"created": True, "synthetic": True, "slides": 1, "textShapes": 2, "paragraphs": 3, "runs": 4, "editorLaunched": False}))
