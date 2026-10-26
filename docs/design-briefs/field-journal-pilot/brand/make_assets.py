"""Regenerate draft Inkborne logo assets from source.json and the licensed font."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import subprocess
from xml.sax.saxutils import escape

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = json.loads((ROOT / "source.json").read_text(encoding="utf-8"))
COLORS = SOURCE["colors"]
NIB = SOURCE["nib"]
LAYOUT = SOURCE["layout"]
outputs = {}
jobs = []


def number(value):
    return f"{value:.5f}".rstrip("0").rstrip(".")


def save(name, data, **details):
    (ROOT / name).write_text(data, encoding="utf-8", newline="\n")
    outputs[name] = details


def svg(body, width, height, label="Inkborne", description=None):
    description = description or "The Scribe: a fountain-pen nib with a transparent capital I. Draft vector identity."
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{number(width)}" height="{number(height)}" '
            f'viewBox="0 0 {number(width)} {number(height)}" role="img" aria-labelledby="title desc">'
            f'<title id="title">{escape(label)}</title><desc id="desc">{escape(description)}</desc>{body}</svg>\n')


def symbol(color, small=False):
    # One compound path: the counter is absent material, never a painted patch.
    counter = NIB["smallCounter"] if small else NIB["counter"]
    return f'<path fill="{color}" fill-rule="evenodd" d="{NIB["outer"]} {counter}"/>'


def square(color, size, small=False, background=None):
    # Identical square placement for all standalone icons.
    inset = LAYOUT["squareSafeArea"] * size
    height = size - inset * 2
    scale = height / 512
    x = (size - 320 * scale) / 2
    background_svg = f'<rect width="{size}" height="{size}" fill="{background}"/>' if background else ""
    body = background_svg + f'<g transform="translate({number(x)} {number(inset)}) scale({number(scale)})">{symbol(color, small)}</g>'
    return svg(body, size, size, "Inkborne symbol")


font_path = (ROOT / SOURCE["font"]).resolve()
font_bytes = font_path.read_bytes()
font_sha = hashlib.sha256(font_bytes).hexdigest()
if font_sha != SOURCE["fontSha256"]:
    raise SystemExit("Font checksum differs from source.json; review the source before rebuilding.")
font = instantiateVariableFont(TTFont(font_path), {"wght": SOURCE["fontWeight"]}, inplace=False)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
glyph_names = [cmap[ord(char)] for char in SOURCE["wordmark"]]


def pair_adjustment(first, second):
    """Apply the font's Latin GPOS kern feature to this unligated Latin word."""
    if "GPOS" not in font:
        return 0
    gpos = font["GPOS"].table
    lookup_indices = []
    for feature in gpos.FeatureList.FeatureRecord:
        if feature.FeatureTag == "kern":
            for index in feature.Feature.LookupListIndex:
                if index not in lookup_indices:
                    lookup_indices.append(index)
    adjustment = 0
    for index in lookup_indices:
        lookup = gpos.LookupList.Lookup[index]
        for subtable in lookup.SubTable:
            lookup_type = lookup.LookupType
            if lookup_type == 9:
                lookup_type = subtable.ExtensionLookupType
                subtable = subtable.ExtSubTable
            if lookup_type != 2 or first not in subtable.Coverage.glyphs:
                continue
            value = None
            if subtable.Format == 1:
                records = subtable.PairSet[subtable.Coverage.glyphs.index(first)].PairValueRecord
                for pair in records:
                    if pair.SecondGlyph == second:
                        value = pair.Value1
                        break
            elif subtable.Format == 2:
                left_class = subtable.ClassDef1.classDefs.get(first, 0)
                right_class = subtable.ClassDef2.classDefs.get(second, 0)
                value = subtable.Class1Record[left_class].Class2Record[right_class].Value1
            if value is not None:
                adjustment += getattr(value, "XAdvance", 0)
                break
    return adjustment


x = 0
positioned = []
kerning = []
for index, glyph_name in enumerate(glyph_names):
    positioned.append((glyph_name, x))
    x += font["hmtx"].metrics[glyph_name][0]
    if index + 1 < len(glyph_names):
        adjustment = pair_adjustment(glyph_name, glyph_names[index + 1])
        kerning.append(adjustment)
        x += adjustment

bounds_pen = BoundsPen(glyphs)
for glyph_name, glyph_x in positioned:
    glyphs[glyph_name].draw(TransformPen(bounds_pen, (1, 0, 0, 1, glyph_x, 0)))
x_min, y_min, x_max, y_max = bounds_pen.bounds
word_width = x_max - x_min
word_height = y_max - y_min
word_pen = SVGPathPen(glyphs)
for glyph_name, glyph_x in positioned:
    glyphs[glyph_name].draw(TransformPen(word_pen, (1, 0, 0, -1, glyph_x - x_min, y_max)))
word_path = word_pen.getCommands()


def wordmark(color, x, y, height):
    scale = height / word_height
    return f'<path fill="{color}" transform="translate({number(x)} {number(y)}) scale({number(scale)})" d="{word_path}"/>'


def lockup(kind, mark_color, text_color):
    if kind == "horizontal":
        height = LAYOUT["horizontalSymbolHeight"]
        symbol_width = 320 * height / 512
        word_h = LAYOUT["horizontalWordmarkHeight"]
        word_w = word_width * word_h / word_height
        width = symbol_width + LAYOUT["horizontalGap"] + word_w
        body = f'<g transform="scale({number(height / 512)})">{symbol(mark_color)}</g>'
        body += wordmark(text_color, symbol_width + LAYOUT["horizontalGap"], (height - word_h) / 2 + 1, word_h)
        return svg(body, width, height), width, height
    word_h = LAYOUT["stackedWordmarkHeight"]
    width = word_width * word_h / word_height
    symbol_h = LAYOUT["stackedSymbolHeight"]
    symbol_w = 320 * symbol_h / 512
    height = symbol_h + LAYOUT["stackedGap"] + word_h
    body = f'<g transform="translate({number((width-symbol_w)/2)} 0) scale({number(symbol_h/512)})">{symbol(mark_color)}</g>'
    body += wordmark(text_color, 0, symbol_h + LAYOUT["stackedGap"], word_h)
    return svg(body, width, height), width, height


for variant in ("ink", "oxblood", "reverse"):
    mark_color = COLORS[variant]
    text_color = COLORS["ink"] if variant == "oxblood" else mark_color
    for kind in ("horizontal", "stacked"):
        data, width, height = lockup(kind, mark_color, text_color)
        filename = f"inkborne-{kind}-{variant}.svg"
        save(filename, data, type="svg", layout=kind, color=variant, width=width, height=height)
        png_width = 1600 if kind == "horizontal" else 1000
        png_height = round(png_width * height / width)
        jobs.append(dict(file=filename.replace(".svg", ".png"), svg=data, width=png_width, height=png_height))
    for small in (False, True):
        suffix = "-small" if small else ""
        filename = f"inkborne-symbol-{variant}{suffix}.svg"
        data = square(mark_color, 512, small=small)
        save(filename, data, type="svg", layout="symbol", color=variant, opticalSmall=small, width=512, height=512)
    for size in (16, 24, 32, 48):
        filename = f"inkborne-symbol-{variant}-{size}.png"
        jobs.append(dict(file=filename, svg=square(mark_color, size, small=size <= 32), width=size, height=size))

save("inkborne-master.svg", svg(symbol(COLORS["ink"]), 320, 512, "Inkborne nib master"), type="svg", layout="master", width=320, height=512)

for size in (180, 192, 512):
    filename = f"inkborne-appicon-{size}.png"
    jobs.append(dict(file=filename, svg=square(COLORS["ink"], size, background=COLORS["paper"]), width=size, height=size))
    filename = f"inkborne-appicon-reverse-{size}.png"
    jobs.append(dict(file=filename, svg=square(COLORS["reverse"], size, background=COLORS["dark"]), width=size, height=size))

save("favicon.svg", square(COLORS["ink"], 32, small=True, background=COLORS["paper"]), type="svg", layout="favicon", width=32, height=32)
for size in (16, 32, 48):
    jobs.append(dict(file=f"favicon-{size}.png", svg=square(COLORS["ink"], size, small=size <= 32, background=COLORS["paper"]), width=size, height=size))

# A deliberately plain proof board: each demonstration embeds the same generated paths.
proof = [f'<rect width="1440" height="1220" fill="{COLORS["paper"]}"/>']
proof.append('<g fill="#282A25" font-family="Arial, sans-serif"><text x="64" y="57" font-size="14" letter-spacing="2">INKBORNE / THE SCRIBE</text><text x="64" y="100" font-size="30">Vector identity proof · draft for site review</text><text x="64" y="132" font-size="16">EB Garamond 600 outlines · one nib silhouette · transparent I counter</text></g>')


def embedded(name, x, y, width, height):
    content = (ROOT / name).read_text(encoding="utf-8")
    # Nested SVG viewBox retains its aspect ratio and all outlines.
    content = content.replace('<svg ', f'<svg x="{x}" y="{y}" ', 1)
    content = re.sub(r'width="[\d.]+" height="[\d.]+"', f'width="{width}" height="{height}"', content, count=1)
    return content.replace(' aria-labelledby="title desc"', '').replace(' id="title"', '').replace(' id="desc"', '')


for index, variant in enumerate(("ink", "oxblood", "reverse")):
    y = 174 + index * 228
    bg = COLORS["dark"] if variant == "reverse" else "#FFFCF5"
    fg = COLORS["reverse"] if variant == "reverse" else COLORS["ink"]
    proof.append(f'<rect x="48" y="{y}" width="1344" height="208" fill="{bg}"/>')
    proof.append(f'<text x="72" y="{y+28}" font-family="Arial, sans-serif" fill="{fg}" font-size="13">{variant.upper()}</text>')
    proof.append(embedded(f"inkborne-horizontal-{variant}.svg", 82, y + 72, 600, 96))
    proof.append(embedded(f"inkborne-stacked-{variant}.svg", 855, y + 28, 244, 157))
    proof.append(embedded(f"inkborne-symbol-{variant}.svg", 1187, y + 50, 112, 112))

proof.append('<g font-family="Arial, sans-serif" fill="#282A25"><text x="64" y="912" font-size="20">Small-size checks · displayed at their actual CSS sizes</text><text x="64" y="941" font-size="14">The compact counter is widened for 16–32 px exports. The outer silhouette is identical.</text></g>')
for row, variant in enumerate(("ink", "reverse")):
    y = 966 + row * 90
    proof.append(f'<rect x="48" y="{y}" width="1344" height="74" fill="{COLORS["dark"] if variant=="reverse" else "#FFFCF5"}"/>')
    for index, size in enumerate((16, 24, 32, 48)):
        x = 92 + index * 182
        proof.append(f'<text x="{x}" y="{y+19}" font-family="Arial, sans-serif" font-size="12" fill="{COLORS[variant]}">{size} px</text>')
        content = square(COLORS[variant], size, small=size <= 32).replace('<svg ', f'<svg x="{x}" y="{y+23}" ', 1)
        content = content.replace(' aria-labelledby="title desc"', '').replace(' id="title"', '').replace(' id="desc"', '')
        proof.append(content)
    proof.append(embedded(f"inkborne-horizontal-{variant}.svg", 840, y + 20, 180, 36))
proof.append('<text x="64" y="1195" font-family="Arial, sans-serif" font-size="13" fill="#63675D">Direction selected; final proportions and optical recognition remain subject to the homepage and sheet pilot.</text>')
proof_svg = svg("".join(proof), 1440, 1220, "Inkborne logo proof board")
save("proof.svg", proof_svg, type="svg", layout="proof", width=1440, height=1220)
jobs.append(dict(file="proof.png", svg=proof_svg, width=1440, height=1220))

jobs_path = ROOT / ".raster-jobs.json"
jobs_path.write_text(json.dumps(jobs), encoding="utf-8")
try:
    subprocess.run(["node", str(ROOT / "render-assets.cjs")], check=True)
finally:
    jobs_path.unlink(missing_ok=True)

for job in jobs:
    with Image.open(ROOT / job["file"]) as raster:
        if raster.size != (job["width"], job["height"]):
            raise SystemExit("Raster dimensions differ: " + job["file"])
    outputs[job["file"]] = dict(type="png", width=job["width"], height=job["height"])

# Pillow permits explicit per-size source images; the ICO uses the checked PNGs.
with Image.open(ROOT / "favicon-48.png") as image:
    small_images = [Image.open(ROOT / f"favicon-{size}.png") for size in (16, 32)]
    image.save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=small_images)
    for small_image in small_images:
        small_image.close()
with Image.open(ROOT / "favicon.ico") as ico:
    assert ico.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
outputs["favicon.ico"] = dict(type="ico", sizes=[16, 32, 48])

for name, details in sorted(outputs.items()):
    content = (ROOT / name).read_bytes()
    details["bytes"] = len(content)
    details["sha256"] = hashlib.sha256(content).hexdigest()

manifest = dict(
    name=SOURCE["name"], status=SOURCE["status"],
    source="source.json", sourceSha256=hashlib.sha256((ROOT / "source.json").read_bytes()).hexdigest(),
    generator="make_assets.py", generatorSha256=hashlib.sha256((ROOT / "make_assets.py").read_bytes()).hexdigest(),
    reference=SOURCE["reference"],
    font=dict(path=SOURCE["font"], family="EB Garamond", weight=SOURCE["fontWeight"], sha256=font_sha, license=SOURCE["fontLicense"]),
    geometry=dict(nibViewBox=NIB["viewBox"], nibAxisX=160, wordmarkOutlineBounds=[x_min, y_min, x_max, y_max], wordmarkKerning=kerning,
                  horizontalAspect=outputs["inkborne-horizontal-ink.svg"]["width"]/96,
                  stackedAspect=outputs["inkborne-stacked-ink.svg"]["width"]/outputs["inkborne-stacked-ink.svg"]["height"]),
    exports=outputs,
)
(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(manifest["geometry"], indent=2))
print(f"Generated {len(outputs)} exports and manifest.json")
