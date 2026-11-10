const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    : null;

/** Counts user-visible characters (grapheme clusters), not UTF-16 code units. */
export function graphemeLength(value: string): number {
  if (!value) return 0;
  if (segmenter) {
    let count = 0;
    for (const _part of segmenter.segment(value)) count += 1;
    return count;
  }
  return Array.from(value).length;
}

/** Titles are single line: line breaks become a single space. */
export function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

export function normalizeTitle(value: string): string {
  return stripLineBreaks(value).trim();
}

export function normalizeListName(value: string): string {
  return value.trim();
}

/** Case-insensitive comparison key. Internal spaces are preserved. */
export function comparisonKey(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}
