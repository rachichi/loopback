// Demo transcript; meetings will come from the Block Party API.
import rawTranscript from "../data/raw_train.txt?raw";

/** A character range in the transcript, [start, end) in global offsets. */
export type Span = { start: number; end: number };

export type Paragraph = { id: string; text: string; start: number; end: number };

// Paragraphs are laid end to end with one separator character between them,
// so every character in the meeting has a single global offset.
export const paragraphs: Paragraph[] = (() => {
  const lines = rawTranscript
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let offset = 0;
  return lines.map((text, index) => {
    const paragraph = { id: `P${index + 1}`, text, start: offset, end: offset + text.length };
    offset = paragraph.end + 1;
    return paragraph;
  });
})();

/** Index of the paragraph containing (or, between paragraphs, preceding) an offset. */
export function paragraphIndexAt(offset: number): number {
  let lo = 0;
  let hi = paragraphs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (paragraphs[mid].start <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Whole-paragraph spans, merging consecutive paragraphs into one span. */
export function spansFromParagraphIds(ids: string[]): Span[] {
  const indexes = [...new Set(ids.map((id) => Number(id.slice(1)) - 1))]
    .filter((i) => i >= 0 && i < paragraphs.length)
    .sort((a, b) => a - b);
  const spans: Span[] = [];
  for (let i = 0; i < indexes.length; i++) {
    let j = i;
    while (j + 1 < indexes.length && indexes[j + 1] === indexes[j] + 1) j++;
    spans.push({ start: paragraphs[indexes[i]].start, end: paragraphs[indexes[j]].end });
    i = j;
  }
  return spans;
}

/** Paragraph ids that any span touches. */
export function paragraphIdsFromSpans(spans: Span[]): string[] {
  const ids = new Set<number>();
  for (const span of spans) {
    for (let i = paragraphIndexAt(span.start); i < paragraphs.length && paragraphs[i].start < span.end; i++) {
      if (paragraphs[i].end > span.start) ids.add(i);
    }
  }
  return [...ids].sort((a, b) => a - b).map((i) => paragraphs[i].id);
}

/**
 * Keep a dragged span non-empty and off the separators between paragraphs:
 * a start at a paragraph's end moves to the next paragraph, an end at a
 * paragraph's start moves back to the previous one.
 */
export function normalizeSpan(span: Span): Span {
  let { start, end } = span;
  const si = paragraphIndexAt(start);
  if (start >= paragraphs[si].end && si + 1 < paragraphs.length) start = paragraphs[si + 1].start;
  const ei = paragraphIndexAt(end);
  if (end <= paragraphs[ei].start && ei > 0) end = paragraphs[ei - 1].end;
  if (end <= start) end = Math.min(start + 1, paragraphs[paragraphIndexAt(start)].end);
  return { start, end };
}
