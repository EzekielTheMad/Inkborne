"""Offline PDF completeness/geometry checks and full-page PNGs for visual QA.

Usage: python e2e/print/verify-pdfs.py --renderer /path/to/pdftoppm
Requires pypdf, pdfplumber and Pillow in the verification runtime only.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("--renderer", required=True)
parser.add_argument("--input", default="test-results/character-print")
args = parser.parse_args()
root = Path(args.input)
process_evidence = {"pid": os.getpid(), "parentPid": os.getppid(), "command": [sys.executable, *sys.argv], "cwd": os.getcwd(), "startedAt": datetime.now(timezone.utc).isoformat(), "ports": [], "renderProcesses": []}
(root / "render-processes.json").write_text(json.dumps(process_evidence, indent=2), encoding="utf-8")
files = sorted(root.glob("**/*.pdf"))
assert len(files) == 6, f"Expected six fixture exports; found {len(files)}"
report = []
for source in files:
    kind, paper = source.stem.split("-")
    document = PdfReader(source)
    text = "\n".join(page.extract_text() or "" for page in document.pages)
    assert "FORBIDDEN_" not in text, f"Private sentinel in {source}"
    assert "Back to character" not in text and "Choose Letter" not in text, f"Controls in {source}"
    expected_hp = "23/38 (4 temporary)" if kind == "martial" else "23/32 (4 temporary)"
    assert expected_hp in text and "Athletics" in text and "Arcana" in text
    assert "Captured loaded sheet values and saved content versions" in text
    if kind != "martial":
        assert "wizard 3/5 d6" in text and "fighter" not in text
        assert "DC 15; attack +7; intelligence" in text
        assert "saving throw intelligence (proficient)" in text and "saving throw wisdom (proficient)" in text
        assert "saving throw strength (proficient)" not in text
    assert "Source:" in text and "v3" in text
    if kind == "long":
        for index in range(1, 13):
            assert re.search(rf"FEATURE_END_{index}\b", text), f"Missing feature {index} in {source}"
        for index in range(1, 15):
            assert re.search(rf"SPELL_END_{index}\b", text), f"Missing spell {index} in {source}"
        for index in range(1, 29):
            assert re.search(rf"Travel Bundle {index}\b", text), f"Missing inventory {index} in {source}"
        assert len(document.pages) >= 4, f"Long content did not paginate in {source}"
    if kind == "martial":
        assert "Hit +7" in text and "1d8 +4 slashing" in text
    with pdfplumber.open(source) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            assert page.chars, f"Empty page {number} in {source}"
            assert all(char["x0"] >= 32 and char["x1"] <= page.width - 32 and char["top"] >= 32 and char["bottom"] <= page.height - 32 for char in page.chars), f"Text crossed printable margin, page {number} in {source}"
            expected_width = 612 if paper == "Letter" else 595.28
            assert abs(page.width - expected_width) < 1
    image_dir = source.parent / "pages"
    image_dir.mkdir(exist_ok=True)
    command = [args.renderer, "-png", "-r", "110", str(source), str(image_dir / source.stem)]
    started_at = datetime.now(timezone.utc).isoformat()
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    process_evidence["renderProcesses"].append({"pid": process.pid, "parentPid": os.getpid(), "command": command, "cwd": os.getcwd(), "startedAt": started_at, "ports": []})
    (root / "render-processes.json").write_text(json.dumps(process_evidence, indent=2), encoding="utf-8")
    _, stderr = process.communicate()
    assert process.returncode == 0, stderr.decode(errors="replace")
    process_evidence["renderProcesses"][-1]["completedAt"] = datetime.now(timezone.utc).isoformat()
    pages = sorted(image_dir.glob("*.png"), key=lambda path: int(path.stem.split("-")[-1]))
    thumb_width, thumb_height, columns = 360, 520, 3
    sheet = Image.new("RGB", (columns * thumb_width, ((len(pages) + columns - 1) // columns) * thumb_height), "#ddd")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(pages):
        image = Image.open(path).convert("RGB")
        image.thumbnail((thumb_width - 12, thumb_height - 28))
        x, y = (index % columns) * thumb_width, (index // columns) * thumb_height
        sheet.paste(image, (x + 6, y + 24))
        draw.text((x + 6, y + 5), f"{source.stem} - page {index + 1}", fill="black")
    sheet.save(source.parent / "all-pages.png")
    report.append({"file": str(source), "pages": len(document.pages), "text_characters": len(text), "privacy_sentinels_absent": True, "printable_margins": True, "all_expected_markers_present": True})
(root / "pdf-verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
process_evidence["completedAt"] = datetime.now(timezone.utc).isoformat()
(root / "render-processes.json").write_text(json.dumps(process_evidence, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
