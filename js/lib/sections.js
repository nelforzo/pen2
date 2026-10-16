import {
  KANA_ROWS,
  STANDARD_HIRAGANA,
  STANDARD_KATAKANA,
  STANDARD_ENGLISH,
  STANDARD_ENGLISH_LOWER,
} from './progress.js';

// Spoken readings for 0–9. 4 and 7 use the "よん"/"なな" readings that are
// easier for children and avoid the ambiguous "し"/"しち".
const NUMBER_READINGS = [
  'ゼロ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう',
];

function numberToJapanese(n) {
  if (n < 10) return NUMBER_READINGS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    let text = tens === 1 ? 'じゅう' : NUMBER_READINGS[tens] + 'じゅう';
    if (ones) text += NUMBER_READINGS[ones];
    return text;
  }
  return 'ひゃく';
}

// The numbers deck is grouped as 1–10, 11–20, … 91–100 (ten groups of ten).
// Zero has no card of its own — it is practised inside 10, 20, … 100.
const NUMBER_GROUPS = [];
for (let start = 1; start <= 91; start += 10) {
  NUMBER_GROUPS.push({
    label: `${start}〜${start + 9}`,
    chars: Array.from({ length: 10 }, (_, i) => String(start + i)),
  });
}

/**
 * Group a kana deck by gojūon row (あ行, か行, …) for the dashboard, using the
 * deck's own script for the row label (あ行 for hiragana, ア行 for katakana).
 */
function kanaGroups(script) {
  return KANA_ROWS.map((row) => ({
    label: `${row[script][0]}行`,
    chars: row[script].split(''),
  }));
}

/**
 * The four practice sections shown in the main menu. Each one is a full
 * deck: a character set plus the stroke data file that backs it.
 */
export const SECTIONS = {
  hiragana: {
    id: 'hiragana',
    label: 'ひらがな',
    dataFile: 'js/data/hiragana.json',
    chars: STANDARD_HIRAGANA.split(''),
    groups: kanaGroups('hiragana'),
    speechLang: 'ja-JP',
    showRomaji: true,
  },
  katakana: {
    id: 'katakana',
    label: 'カタカナ',
    dataFile: 'js/data/katakana.json',
    chars: STANDARD_KATAKANA.split(''),
    groups: kanaGroups('katakana'),
    speechLang: 'ja-JP',
    showRomaji: true,
  },
  english: {
    id: 'english',
    label: 'えいご',
    dataFile: 'js/data/alphabet.json',
    chars: [...STANDARD_ENGLISH.split(''), ...STANDARD_ENGLISH_LOWER.split('')],
    speechLang: 'en-US',
    // Lowercase so TTS reads the letter name ("ay") rather than "capital A".
    speechText: (char) => char.toLowerCase(),
    showRomaji: false,
  },
  numbers: {
    id: 'numbers',
    label: 'すうじ',
    dataFile: 'js/data/numbers.json',
    // Every number 1–100 has stroke data; multi-digit numbers are composed
    // from their digits (left to right) by scripts/build-numbers.js.
    chars: Array.from({ length: 100 }, (_, i) => String(i + 1)),
    groups: NUMBER_GROUPS,
    speechLang: 'ja-JP',
    speechText: (char) => numberToJapanese(parseInt(char, 10)),
    showRomaji: false,
  },
  // Not a stroke deck: this section renders a free-drawing canvas instead of a
  // character grid (see DrawingView). It has no stroke data file.
  draw: {
    id: 'draw',
    label: 'おえかき',
    kind: 'draw',
  },
};

export const DEFAULT_SECTION = 'hiragana';

export function getSection(id) {
  return SECTIONS[id] || SECTIONS[DEFAULT_SECTION];
}
