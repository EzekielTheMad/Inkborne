"""Package the character study for offline and conversation review."""

from pathlib import Path
import argparse
import base64
import hashlib
import json
import re


ROOT = Path(__file__).resolve().parent


def data_url(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def clean(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inline-dir", type=Path, help="Existing thread-readable directory for the inline copy")
    args = parser.parse_args()
    if args.inline_dir and not args.inline_dir.is_dir():
        parser.error("--inline-dir must name an existing directory")
    source = (ROOT / "character-study.html").read_text(encoding="utf-8")
    css = (ROOT / "character-study.css").read_text(encoding="utf-8")
    for name in ("EBGaramond-latin.ttf", "EBGaramond-Italic-latin.ttf", "Marcellus-Regular.ttf"):
        css = css.replace("fonts/" + name, data_url(ROOT / "fonts" / name, "font/ttf"))
    logos = {
        theme: data_url(ROOT / f"brand/inkborne-horizontal-{color}.svg", "image/svg+xml")
        for theme, color in (("light", "ink"), ("dark", "reverse"))
    }
    script = "window.InkborneCharacterStudyAssets = " + json.dumps(logos) + ";\n"
    script += (ROOT / "character-colors.js").read_text(encoding="utf-8") + "\n"
    script += (ROOT / "character-study.js").read_text(encoding="utf-8")
    # The same source and behavior power both packages. No runtime resources needed.
    source = re.sub(r'<script\b[^>]*src="character-(?:colors|study)\.js"[^>]*>\s*</script>', "", source)
    source = re.sub(r'<link\b[^>]*href="character-study\.css"[^>]*>', "", source)
    source = re.sub(
        r'(?:src|href)="(brand/[^\"]+\.svg)"',
        lambda match: match[0].split("=")[0] + '="' + data_url(ROOT / match[1], "image/svg+xml") + '"',
        source,
    )
    offline = source.replace("</head>", "<style>\n" + css + "\n</style>\n</head>")
    offline = offline.replace("</body>", "<script>\n" + script + "\n</script>\n</body>")
    offline = clean(offline)
    (ROOT / "character-preview.html").write_text(offline, encoding="utf-8", newline="\n")

    body = re.search(r"<body[^>]*>(.*?)</body>", source, re.DOTALL)[1]
    # Keep the inline host's native focus order; standalone retains its tab UI.
    body = re.sub(r'\s+tabindex="-?\d+"', "", body)
    inline_script = script.replace("tab.tabIndex = active ? 0 : -1;", "")
    fragment = clean("<style>\n" + css + "\n</style>\n" + body + "\n<script>\n" + inline_script + "\n</script>")
    assert 'id="inkborne-character-study"' in fragment
    assert not re.search(r"<(?:!doctype|html|head|body)(?:\s|>)", fragment, re.IGNORECASE)
    assert len(fragment.encode("utf-8")) < 1_000_000
    assert not re.search(r'(?:src|href)="(?:brand/|character-)', offline)
    assert 'url("fonts/' not in css and "url('fonts/" not in css
    target = ROOT / "inkborne-character-context.html"
    target.write_text(fragment, encoding="utf-8", newline="\n")
    if args.inline_dir:
        exported = args.inline_dir / target.name
        exported.write_bytes(target.read_bytes())
        assert hashlib.sha256(exported.read_bytes()).digest() == hashlib.sha256(target.read_bytes()).digest()
    print(json.dumps({"offlineBytes": len(offline.encode("utf-8")), "inlineBytes": len(fragment.encode("utf-8")), "inlineExport": str(args.inline_dir / target.name) if args.inline_dir else None}))


if __name__ == "__main__":
    main()
