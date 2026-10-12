#!/usr/bin/env node
// Builds stroke data for the digits 0–9 for the numbers section.
//
// Like the alphabet, there is no KanjiVG equivalent, so these are simple
// hand-authored paths in KanjiVG's 0 0 109 109 coordinate space. Stroke
// order follows the common school convention (top→bottom, left→right).
//
// Usage: node scripts/build-numbers.js
const fs = require('fs');
const path = require('path');

const DIGITS = {
  0: {
    paths: ['M54,12 Q22,12 22,54 Q22,96 54,96 Q86,96 86,54 Q86,12 54,12'],
    numbers: [[1, 54, 18]]
  },
  1: {
    paths: ['M34,28 L54,14 L54,96'],
    numbers: [[1, 36, 22]]
  },
  2: {
    paths: ['M22,36 Q22,14 52,14 Q82,14 82,36 Q82,54 54,70 Q30,84 22,96 L84,96'],
    numbers: [[1, 50, 18]]
  },
  3: {
    paths: ['M24,30 Q38,14 54,14 Q82,14 82,34 Q82,52 54,52 Q82,52 82,72 Q82,96 54,96 Q38,96 24,82'],
    numbers: [[1, 50, 16]]
  },
  4: {
    paths: [
      'M66,14 L22,66 L88,66',
      'M66,14 L66,96'
    ],
    numbers: [[1, 70, 22], [2, 60, 30]]
  },
  5: {
    paths: ['M76,14 L34,14 L28,50 Q42,44 56,44 Q84,44 84,70 Q84,96 54,96 Q36,96 24,84'],
    numbers: [[1, 68, 18]]
  },
  6: {
    paths: ['M72,18 Q55,12 42,22 Q22,38 22,66 Q22,96 52,96 Q80,96 80,72 Q80,50 52,50 Q30,50 24,64'],
    numbers: [[1, 62, 16]]
  },
  7: {
    paths: [
      'M22,14 L84,14',
      'M84,14 L46,96'
    ],
    numbers: [[1, 52, 10], [2, 74, 30]]
  },
  8: {
    paths: ['M54,50 Q28,50 28,31 Q28,14 54,14 Q80,14 80,31 Q80,50 54,50 Q22,50 22,73 Q22,96 54,96 Q86,96 86,73 Q86,50 54,50'],
    numbers: [[1, 54, 20]]
  },
  9: {
    paths: [
      'M82,36 Q82,14 54,14 Q26,14 26,36 Q26,58 54,58 Q82,58 82,36',
      'M82,36 L82,68 Q82,96 52,96 Q36,96 28,88'
    ],
    numbers: [[1, 54, 16], [2, 88, 46]]
  }
};

function toHex(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

const results = Object.entries(DIGITS).map(([char, def]) => ({
  char,
  codepoint: toHex(char),
  viewBox: '0 0 109 109',
  paths: def.paths,
  numbers: def.numbers.map(([n, x, y]) => ({ n, x, y }))
}));

const outPath = path.join(__dirname, '..', 'js', 'data', 'numbers.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} digits to ${outPath}`);
