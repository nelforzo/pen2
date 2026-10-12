import {
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

// The numbers deck is shown as manageable sections (0–9, 10–19, … 90–99, 100)
// rather than one long grid of 101 cards.
const NUMBER_GROUPS = [
  { label: '0〜9', chars: Array.from({ length: 10 }, (_, i) => String(i)) },
];
for (let tens = 1; tens <= 9; tens++) {
  const start = tens * 10;
  NUMBER_GROUPS.push({
    label: `${start}〜${start + 9}`,
    chars: Array.from({ length: 10 }, (_, i) => String(start + i)),
  });
}
NUMBER_GROUPS.push({ label: '100', chars: ['100'] });

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
    speechLang: 'ja-JP',
    showRomaji: true,
  },
  katakana: {
    id: 'katakana',
    label: 'カタカナ',
    dataFile: 'js/data/katakana.json',
    chars: STANDARD_KATAKANA.split(''),
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
    // Every number 0–100 has stroke data; multi-digit numbers are composed
    // from their digits (left to right) by scripts/build-numbers.js.
    chars: Array.from({ length: 101 }, (_, i) => String(i)),
    groups: NUMBER_GROUPS,
    speechLang: 'ja-JP',
    speechText: (char) => numberToJapanese(parseInt(char, 10)),
    showRomaji: false,
  },
};

export const DEFAULT_SECTION = 'hiragana';

export function getSection(id) {
  return SECTIONS[id] || SECTIONS[DEFAULT_SECTION];
}
