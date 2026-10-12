import {
  STANDARD_HIRAGANA,
  STANDARD_KATAKANA,
  STANDARD_ENGLISH,
} from './progress.js';

/**
 * The three practice sections shown in the main menu. Each one is a full
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
    chars: STANDARD_ENGLISH.split(''),
    speechLang: 'en-US',
    // Lowercase so TTS reads the letter name ("ay") rather than "capital A".
    speechText: (char) => char.toLowerCase(),
    showRomaji: false,
  },
};

export const DEFAULT_SECTION = 'hiragana';

export function getSection(id) {
  return SECTIONS[id] || SECTIONS[DEFAULT_SECTION];
}
