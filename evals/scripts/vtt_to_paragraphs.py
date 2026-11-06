#!/usr/bin/env python3
"""Convert YouTube auto-captions (.vtt) into a numbered-paragraph transcript.

Writes "P<n>\t<text>" lines, the format of data/psplit_train1.txt. A paragraph is one
speaker turn (auto-captions mark speaker changes with ">>"); turns longer than ~180 words
are split at the first sentence end after 150 words.

Download the captions with yt-dlp, for example:
    yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format vtt <video url>

Usage:
    python3 scripts/vtt_to_paragraphs.py captions.en.vtt data/<board>/minutes/<date>_<meeting>/psplit_transcript.txt
"""

import argparse
import html
import re
from pathlib import Path

MAX_WORDS = 180
SPLIT_AFTER = 150


def caption_text(vtt: str) -> str:
    words = []
    for block in vtt.split("\n\n"):
        for line in block.splitlines():
            # Auto-captions roll: each cue repeats the previous line, and only the newly
            # spoken line carries inline word timings like <00:00:16.760><c> you</c>.
            if re.search(r"<\d\d:\d\d:\d\d\.\d+>|<c>", line):
                words.append(html.unescape(re.sub(r"<[^>]+>", "", line)).strip())
    return re.sub(r"\s+", " ", " ".join(w for w in words if w)).strip()


def split_turn(turn: str) -> list[str]:
    words = turn.split(" ")
    parts = []
    while len(words) > MAX_WORDS:
        cut = SPLIT_AFTER
        for i in range(SPLIT_AFTER, min(len(words), MAX_WORDS + 40)):
            if words[i - 1].endswith((".", "?", "!")):
                cut = i
                break
        parts.append(" ".join(words[:cut]))
        words = words[cut:]
    parts.append(" ".join(words))
    return parts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="captions file (.vtt)")
    parser.add_argument("output", type=Path, help="paragraph transcript to write")
    args = parser.parse_args()

    text = caption_text(args.input.read_text(encoding="utf-8"))
    turns = [t.strip() for t in text.split(">>") if t.strip()]
    paragraphs = [p for t in turns for p in split_turn(t)]

    args.output.write_text("".join(f"P{i}\t{p}\n" for i, p in enumerate(paragraphs, 1)), encoding="utf-8")
    print(f"Wrote {len(paragraphs)} paragraphs ({len(text.split())} words) to {args.output}")


if __name__ == "__main__":
    main()
