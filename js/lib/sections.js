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
    // Writing practice covers 0–9; 10–100 are shown as read-only cards.
    chars: Array.from({ length: 101 }, (_, i) => String(i)),
    speechLang: 'ja-JP',
    speechText: (char) => numberToJapanese(parseInt(char, 10)),
    showRomaji: false,
  },
};

export const DEFAULT_SECTION = 'hiragana';

export function getSection(id) {
  return SECTIONS[id] || SECTIONS[DEFAULT_SECTION];
}
