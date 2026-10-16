/**
 * Simple per-character practice progress (no SRS).
 *
 * For each character we track:
 *   - practiced:  has the child ever completed it successfully?
 *   - clean:      was it completed on the very first try (no mistakes)?
 *   - attempts:   total number of tries (for grown-ups / curiosity)
 */

/**
 * The gojūon rows (あ行, か行, …), the canonical order for both kana decks.
 * Each row is 5 kana except や行 (3) and わ行 (3, including ん). Deriving the
 * flat character sets from these rows keeps practice order and the dashboard
 * grouping in sync.
 */
export const KANA_ROWS = [
  { hiragana: 'あいうえお', katakana: 'アイウエオ' },
  { hiragana: 'かきくけこ', katakana: 'カキクケコ' },
  { hiragana: 'さしすせそ', katakana: 'サシスセソ' },
  { hiragana: 'たちつてと', katakana: 'タチツテト' },
  { hiragana: 'なにぬねの', katakana: 'ナニヌネノ' },
  { hiragana: 'はひふへほ', katakana: 'ハヒフヘホ' },
  { hiragana: 'まみむめも', katakana: 'マミムメモ' },
  { hiragana: 'やゆよ', katakana: 'ヤユヨ' },
  { hiragana: 'らりるれろ', katakana: 'ラリルレロ' },
  { hiragana: 'わをん', katakana: 'ワヲン' },
];

export const STANDARD_HIRAGANA = KANA_ROWS.map((row) => row.hiragana).join('');

export const STANDARD_KATAKANA = KANA_ROWS.map((row) => row.katakana).join('');

export const STANDARD_ENGLISH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const STANDARD_ENGLISH_LOWER = 'abcdefghijklmnopqrstuvwxyz';

export function standardCharacters() {
  return STANDARD_HIRAGANA.split('');
}

export function createProgress(char) {
  return {
    id: char,
    practiced: false,
    clean: false,
    attempts: 0,
  };
}

export function isPracticed(entry) {
  return !!(entry && entry.practiced);
}

export function isClean(entry) {
  return !!(entry && entry.clean);
}

/**
 * Update a progress entry after a completed practice run.
 * `cleanRun` is true when every stroke was correct on the first try.
 */
export function recordPractice(entry, cleanRun) {
  const next = entry ? { ...entry } : createProgress(entry?.id);
  next.practiced = true;
  next.attempts = (next.attempts || 0) + 1;
  if (cleanRun) next.clean = true;
  return next;
}
