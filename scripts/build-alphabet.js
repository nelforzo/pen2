#!/usr/bin/env node
// Builds uppercase A–Z stroke data for the English section.
//
// There is no KanjiVG equivalent for the Latin alphabet, so these are
// hand-authored simple paths in KanjiVG's 0 0 109 109 coordinate space.
// Stroke order follows the common school convention (top→bottom, left→right).
//
// Usage: node scripts/build-alphabet.js
const fs = require('fs');
const path = require('path');

const LETTERS = {
  A: {
    paths: [
      'M55,12 L18,96',
      'M55,12 L92,96',
      'M31,63 L79,63'
    ],
    numbers: [[1, 44, 22], [2, 66, 22], [3, 55, 57]]
  },
  B: {
    paths: [
      'M28,12 L28,97',
      'M28,12 L60,12 Q80,12 80,30 Q80,49 60,49 L28,49',
      'M28,49 L62,49 Q85,49 85,73 Q85,97 60,97 L28,97'
    ],
    numbers: [[1, 20, 22], [2, 68, 20], [3, 68, 66]]
  },
  C: {
    paths: ['M86,28 Q70,12 52,12 Q18,12 18,54 Q18,97 52,97 Q70,97 86,80'],
    numbers: [[1, 76, 20]]
  },
  D: {
    paths: [
      'M28,12 L28,97',
      'M28,12 L55,12 Q90,12 90,54 Q90,97 55,97 L28,97'
    ],
    numbers: [[1, 20, 22], [2, 72, 24]]
  },
  E: {
    paths: [
      'M26,12 L26,97',
      'M26,12 L82,12',
      'M26,55 L70,55',
      'M26,97 L82,97'
    ],
    numbers: [[1, 17, 22], [2, 76, 20], [3, 64, 50], [4, 76, 92]]
  },
  F: {
    paths: [
      'M28,12 L28,97',
      'M28,12 L82,12',
      'M28,55 L70,55'
    ],
    numbers: [[1, 20, 22], [2, 76, 20], [3, 64, 50]]
  },
  G: {
    paths: [
      'M86,28 Q70,12 52,12 Q18,12 18,54 Q18,97 52,97 Q86,97 86,62',
      'M86,62 L58,62'
    ],
    numbers: [[1, 76, 20], [2, 78, 56]]
  },
  H: {
    paths: [
      'M26,12 L26,97',
      'M82,12 L82,97',
      'M26,55 L82,55'
    ],
    numbers: [[1, 18, 22], [2, 86, 22], [3, 54, 50]]
  },
  I: {
    paths: [
      'M24,12 L84,12',
      'M54,12 L54,97',
      'M24,97 L84,97'
    ],
    numbers: [[1, 46, 8], [2, 60, 22], [3, 46, 93]]
  },
  J: {
    paths: ['M74,12 L74,76 Q74,97 52,97 Q32,97 32,78'],
    numbers: [[1, 80, 22]]
  },
  K: {
    paths: [
      'M28,12 L28,97',
      'M80,12 L30,56',
      'M44,44 L82,97'
    ],
    numbers: [[1, 20, 22], [2, 72, 18], [3, 60, 62]]
  },
  L: {
    paths: [
      'M30,12 L30,97',
      'M30,97 L84,97'
    ],
    numbers: [[1, 22, 22], [2, 74, 92]]
  },
  M: {
    paths: [
      'M22,97 L22,12',
      'M22,12 L54,62',
      'M54,62 L86,12',
      'M86,12 L86,97'
    ],
    numbers: [[1, 14, 80], [2, 30, 40], [3, 66, 40], [4, 92, 80]]
  },
  N: {
    paths: [
      'M26,97 L26,12',
      'M26,12 L82,97',
      'M82,97 L82,12'
    ],
    numbers: [[1, 18, 80], [2, 40, 40], [3, 88, 80]]
  },
  O: {
    paths: ['M54,12 Q20,12 20,54 Q20,97 54,97 Q88,97 88,54 Q88,12 54,12'],
    numbers: [[1, 44, 20]]
  },
  P: {
    paths: [
      'M28,12 L28,97',
      'M28,12 L60,12 Q84,12 84,36 Q84,60 60,60 L28,60'
    ],
    numbers: [[1, 20, 22], [2, 68, 22]]
  },
  Q: {
    paths: [
      'M54,12 Q20,12 20,54 Q20,97 54,97 Q88,97 88,54 Q88,12 54,12',
      'M64,72 L88,98'
    ],
    numbers: [[1, 44, 20], [2, 82, 90]]
  },
  R: {
    paths: [
      'M28,12 L28,97',
      'M28,12 L60,12 Q84,12 84,36 Q84,60 60,60 L28,60',
      'M60,60 L86,97'
    ],
    numbers: [[1, 20, 22], [2, 68, 22], [3, 74, 76]]
  },
  S: {
    paths: ['M82,26 Q70,12 50,12 Q24,12 24,34 Q24,50 50,54 Q80,58 80,76 Q80,97 52,97 Q30,97 20,84'],
    numbers: [[1, 70, 18]]
  },
  T: {
    paths: [
      'M20,12 L88,12',
      'M54,12 L54,97'
    ],
    numbers: [[1, 44, 8], [2, 60, 22]]
  },
  U: {
    paths: ['M22,12 L22,70 Q22,97 54,97 Q86,97 86,70 L86,12'],
    numbers: [[1, 14, 22]]
  },
  V: {
    paths: ['M20,12 L54,97 L88,12'],
    numbers: [[1, 14, 22]]
  },
  W: {
    paths: ['M14,12 L32,97 L54,40 L76,97 L94,12'],
    numbers: [[1, 8, 22]]
  },
  X: {
    paths: [
      'M22,12 L86,97',
      'M86,12 L22,97'
    ],
    numbers: [[1, 14, 20], [2, 80, 20]]
  },
  Y: {
    paths: [
      'M22,12 L54,58',
      'M86,12 L54,56 L54,97'
    ],
    numbers: [[1, 14, 20], [2, 80, 20]]
  },
  Z: {
    paths: [
      'M22,12 L86,12',
      'M86,12 L22,97',
      'M22,97 L86,97'
    ],
    numbers: [[1, 44, 8], [2, 54, 52], [3, 44, 93]]
  }
};

function toHex(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

const results = Object.entries(LETTERS).map(([char, def]) => ({
  char,
  codepoint: toHex(char),
  viewBox: '0 0 109 109',
  paths: def.paths,
  numbers: def.numbers.map(([n, x, y]) => ({ n, x, y }))
}));

const outPath = path.join(__dirname, '..', 'js', 'data', 'alphabet.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} letters to ${outPath}`);
