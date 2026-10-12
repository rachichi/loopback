#!/usr/bin/env python3
"""Split a raw meeting transcript into numbered paragraphs.

Each non-empty line of the raw transcript becomes one paragraph, written as
"P<n>\t<text>" (the format of data/psplit_train.txt).

Usage:
    python3 scripts/split_paragraphs.py data/raw_train.txt data/psplit_train.txt
    python3 scripts/split_paragraphs.py data/raw_test.txt            # -> data/psplit_test.txt
"""

import argparse
import re
from pathlib import Path


def split_paragraphs(text: str) -> list[str]:
    paragraphs = []
    for line in text.splitlines():
        # Collapse tabs/extra whitespace so the tab delimiter stays unambiguous.
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            paragraphs.append(line)
    return paragraphs


def default_output(input_path: Path) -> Path:
    name = input_path.name
    if name.startswith("raw_"):
        name = "psplit_" + name[len("raw_") :]
    else:
        name = "psplit_" + name
    return input_path.with_name(name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="raw transcript (one utterance per line)")
    parser.add_argument("output", type=Path, nargs="?", help="output file (default: raw_X.txt -> psplit_X.txt)")
    args = parser.parse_args()

    # utf-8-sig strips the BOM that the raw transcripts start with.
    text = args.input.read_text(encoding="utf-8-sig")
    paragraphs = split_paragraphs(text)

    output = args.output or default_output(args.input)
    output.write_text("".join(f"P{i}\t{p}\n" for i, p in enumerate(paragraphs, 1)), encoding="utf-8")
    print(f"Wrote {len(paragraphs)} paragraphs to {output}")


if __name__ == "__main__":
    main()
