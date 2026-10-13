"""Two actual-provider PDF exports only. Original six use unchanged verify-pdfs.py.
No hosted access. Capture native renderer identity and exact output/module bytes.
"""
import argparse
import hashlib
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

def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def identity(pid, parent):
    assert isinstance(pid, int) and pid > 0 and isinstance(parent, int) and parent > 0
    command = f"$p=Get-CimInstance Win32_Process -Filter 'ProcessId={pid}';if(!$p -or $p.ParentProcessId -ne {parent} -or !$p.CreationDate){{exit 3}};@{{pid=$p.ProcessId;parentPid=$p.ParentProcessId;birthUtc=$p.CreationDate.ToUniversalTime().ToString('o');command=$p.CommandLine}}|ConvertTo-Json -Compress"
    result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command], capture_output=True, check=True)
    value = json.loads(result.stdout.decode("utf-8-sig"))
    assert value["pid"] == pid and value["parentPid"] == parent and value["birthUtc"].endswith("Z") and value["command"]
    return value

parser = argparse.ArgumentParser()
parser.add_argument("--renderer", required=True)
parser.add_argument("--input", required=True)
args = parser.parse_args()
root = Path(args.input).resolve()
files = sorted(root.glob("*.pdf"))
assert {file.name for file in files} == {"bonus-Letter.pdf", "bonus-A4.pdf"}
expected = {"Strength": (10, "+0", "+1"), "Dexterity": (12, "+1", "+2"), "Constitution": (14, "+2", "+5"), "Intelligence": (10, "+0", "+1"), "Wisdom": (12, "+1", "+2"), "Charisma": (8, "-1", "+0")}
processes = {"self": identity(os.getpid(), os.getppid()), "cwd": os.getcwd(), "python": {"path": sys.executable, "sha256": sha(sys.executable)}, "renderer": {"path": str(Path(args.renderer).resolve()), "sha256": sha(args.renderer)}, "renders": [], "modules": []}
report = []
for file in files:
    document = PdfReader(file)
    text = "\n".join(page.extract_text() or "" for page in document.pages)
    assert "Original Lantern Courier" in text and "FORBIDDEN_" not in text
    assert "Captured loaded sheet values and saved content versions" in text
    assert "Back to character" not in text and "Choose Letter" not in text and "1d4" not in text
    for name, (score, modifier, save) in expected.items():
        assert re.search(rf"\b{name}\s+{score}\s+{re.escape(modifier)}\s+{re.escape(save)}\b", text), (file, name)
    paper = file.stem.split("-")[-1]
    with pdfplumber.open(file) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            assert page.chars, (file, number, "Blank page")
            assert abs(page.width - (612 if paper == "Letter" else 595.28)) < 1
            assert all(char["x0"] >= 32 and char["x1"] <= page.width - 32 and char["top"] >= 32 and char["bottom"] <= page.height - 32 for char in page.chars), (file, number, "Printable margins")
    folder = file.parent / (file.stem + "-pages")
    folder.mkdir(exist_ok=False)
    command = [args.renderer, "-png", "-r", "110", str(file), str(folder / "page")]
    started = datetime.now(timezone.utc).isoformat()
    child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Native exit can race a short renderer; a missed OS identity fails rather
    # than fabricate birth from wall clock or accept an unidentified live process.
    try:
        native = identity(child.pid, os.getpid())
    except Exception:
        # Do not abandon a launched renderer on an identity-capture failure.
        # Never force an unidentified PID; the owning runner retains the full
        # private-tree/source guard and captures failure/remaining resources.
        child.communicate(timeout=10)
        raise
    native.update(cwd=os.getcwd(), commandArgs=command, startedUTC=started)
    processes["renders"].append(native)
    (root / "render-processes.json").write_text(json.dumps(processes, indent=2), encoding="utf-8")
    _, stderr = child.communicate()
    assert child.returncode == 0, stderr.decode(errors="replace")
    native["exitCode"] = child.returncode
    images = sorted(folder.glob("page-*.png"), key=lambda image: int(image.stem.split("-")[-1]))
    assert len(images) == len(document.pages)
    contact = Image.new("RGB", (720, ((len(images) + 1) // 2) * 520), "#ddd")
    draw = ImageDraw.Draw(contact)
    for index, image_path in enumerate(images):
        image = Image.open(image_path).convert("RGB")
        image.thumbnail((348, 488))
        x, y = index % 2 * 360, index // 2 * 520
        contact.paste(image, (x + 6, y + 24))
        draw.text((x + 6, y + 5), f"{file.stem} page{index + 1}", fill="black")
    contact_file = file.parent / (file.stem + "-all-pages.png")
    contact.save(contact_file)
    report.append({"file": file.name, "pdfSHA256": sha(file), "pages": len(document.pages), "expectedRows": expected, "textSHA256": hashlib.sha256(text.encode()).hexdigest(), "privacy": True, "geometry": True, "images": [{"path": str(image), "sha256": sha(image)} for image in images], "contactSheetSHA256": sha(contact_file)})
for name, module in sorted(sys.modules.items()):
    file = getattr(module, "__file__", None)
    if file and Path(file).is_file():
        processes["modules"].append({"name": name, "path": str(Path(file).resolve()), "sha256": sha(file)})
(root / "render-processes.json").write_text(json.dumps(processes, indent=2), encoding="utf-8")
(root / "pdf-verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"reports": report, "limits": "Headless Chrome PDF export; no native print dialog/mobile print interoperability or provider persistence proof"}))
