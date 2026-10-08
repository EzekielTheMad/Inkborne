#!/usr/bin/env python3
"""Flag non-example email literals near login/test-account guidance, without printing values.

This current-tree guard supplements Gitleaks. It is deliberately not a history
scrubber or a comprehensive personal-data/secret detector.
"""
from pathlib import Path
import re
import subprocess
import sys

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
CONTEXT = re.compile(r"test.?account|test.?login|credentials|password|log[ -]?in|sign[ -]?in", re.I)


def is_example(domain):
    domain = domain.lower()
    return domain in {"example.com", "example.org", "example.net"} or domain.endswith((".test", ".invalid", ".example", ".localhost"))


def findings(text):
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if any(not is_example(match.group(1)) for match in EMAIL.finditer(line)):
            context = " ".join(lines[max(0, index - 1):index + 2])
            if CONTEXT.search(context):
                yield index + 1


def main():
    # Small regression checks use only reserved synthetic examples.
    assert not list(findings("Login: `reader@example.test` / `${E2E_TEST_PASSWORD}`"))
    assert not list(findings("Login: `${E2E_TEST_EMAIL}` / `${E2E_TEST_PASSWORD}`"))
    assert list(findings("Test account: reader@mail.company / private-env-value")) == [1]
    assert is_example("example.com")
    assert not is_example("mail.company")
    tracked = subprocess.check_output(["git", "ls-files", "-z"], text=True).split("\0")
    failed = False
    for name in tracked:
        if not name.endswith(".md") or not Path(name).is_file():
            continue
        for line in findings(Path(name).read_text(encoding="utf-8")):
            print(f"{name}:{line}: non-example email near login guidance; use private environment variables")
            failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
