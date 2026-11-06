// The Generate button's progress bar, shared by the Transcript tab and the Meetings tab. The bar is a
// guess from the transcript's length, not real server progress.

/** Expected seconds for a Generate run. On CB9's meetings it took about 10 s plus 1 s per 2,000 characters. */
export function expectedSeconds(characters: number): number {
  return 10 + characters / 2000;
}

/** The fill: steady to 90% at the expected time, then creeping toward 99% so a slow run never looks done. */
export function progressAt(elapsed: number, expected: number): number {
  return elapsed < expected ? 0.9 * elapsed / expected : 0.9 + 0.09 * (1 - Math.exp(-(elapsed - expected) / expected));
}
