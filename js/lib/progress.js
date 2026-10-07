/**
 * Simple per-character practice progress (no SRS).
 *
 * For each character we track:
 *   - practiced:  has the child ever completed it successfully?
 *   - clean:      was it completed on the very first try (no mistakes)?
 *   - attempts:   total number of tries (for grown-ups / curiosity)
 */

export const STANDARD_HIRAGANA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';

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
