#!/usr/bin/env node
// Builds uppercase A–Z and lowercase a–z stroke data for the English section.
//
// There is no KanjiVG equivalent for the Latin alphabet, so these are
// hand-authored simple paths in KanjiVG's 0 0 109 109 coordinate space.
// Stroke order follows the common school convention (top→bottom, left→right).
//
// Usage: node scripts/build-alphabet.js
const fs = require('fs');
const path = require('path');

// A small filled dot (used for the i/j tittles). Kept under the stroke
// matcher's dot-detection size so any small tap/tick is accepted.
function dot(cx, cy, r = 3) {
  return `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy}`;
}

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
  },
  a: {
    // Bowl, then the downstroke on the right.
    paths: [
      'M52,46 C40,46 34,56 34,68 C34,80 42,90 52,90 C62,90 70,80 70,68 C70,56 62,46 52,46',
      'M70,48 L70,90'
    ],
    numbers: [[1, 44, 44], [2, 78, 46]]
  },
  b: {
    // Tall stem, then the bowl.
    paths: [
      'M40,14 L40,90',
      'M40,52 C58,50 72,60 72,71 C72,82 58,90 40,90'
    ],
    numbers: [[1, 32, 18], [2, 32, 50]]
  },
  c: {
    paths: ['M72,54 C68,48 58,44 50,45 C40,47 32,56 32,68 C32,80 40,88 50,89 C58,90 68,86 72,80'],
    numbers: [[1, 80, 52]]
  },
  d: {
    // Bowl (like a c), then the tall stem.
    paths: [
      'M70,52 C52,50 38,60 38,71 C38,82 52,90 70,90',
      'M70,14 L70,90'
    ],
    numbers: [[1, 78, 50], [2, 78, 18]]
  },
  e: {
    paths: ['M32,68 L70,68 C70,56 62,46 50,46 C38,46 30,56 30,68 C30,80 38,90 50,90 C60,90 68,86 72,78'],
    numbers: [[1, 24, 66]]
  },
  f: {
    // Hooked stem, then the crossbar.
    paths: [
      'M70,22 C64,14 50,14 50,28 L50,90',
      'M34,54 L72,54'
    ],
    numbers: [[1, 76, 18], [2, 28, 50]]
  },
  g: {
    // Bowl, then the descender tail.
    paths: [
      'M52,46 C40,46 34,56 34,68 C34,80 42,90 52,90 C62,90 70,80 70,68 C70,56 62,46 52,46',
      'M70,76 L70,98 C70,104 62,107 52,107 C44,107 38,104 35,99'
    ],
    numbers: [[1, 44, 44], [2, 78, 74]]
  },
  h: {
    // Tall stem, then the arch.
    paths: [
      'M38,14 L38,90',
      'M38,58 C46,46 62,44 70,56 L70,90'
    ],
    numbers: [[1, 30, 18], [2, 30, 56]]
  },
  i: {
    paths: [
      'M54,46 L54,90',
      dot(54, 28, 3)
    ],
    numbers: [[1, 46, 44], [2, 46, 26]]
  },
  j: {
    paths: [
      'M62,46 L62,98 C62,105 54,108 46,108 C40,108 35,105 33,100',
      dot(62, 28, 3)
    ],
    numbers: [[1, 70, 44], [2, 70, 26]]
  },
  k: {
    // Stem, arm, then leg.
    paths: [
      'M38,14 L38,90',
      'M68,42 L42,58',
      'M50,54 L72,90'
    ],
    numbers: [[1, 30, 18], [2, 74, 38], [3, 44, 60]]
  },
  l: {
    paths: ['M52,14 L52,90'],
    numbers: [[1, 44, 18]]
  },
  m: {
    // One continuous stroke: down, retrace up, two arches.
    paths: ['M22,46 L22,90 L22,58 Q34,44 46,58 L46,90 L46,58 Q58,44 70,58 L70,90'],
    numbers: [[1, 14, 44]]
  },
  n: {
    paths: ['M36,46 L36,90 L36,58 Q48,42 60,58 L60,90'],
    numbers: [[1, 28, 44]]
  },
  o: {
    paths: ['M56,46 C44,46 36,56 36,68 C36,80 44,90 56,90 C68,90 76,80 76,68 C76,56 68,46 56,46'],
    numbers: [[1, 48, 44]]
  },
  p: {
    // Stem (with descender), then the bowl.
    paths: [
      'M38,46 L38,106',
      'M38,56 C56,54 70,62 70,72 C70,82 56,90 38,90'
    ],
    numbers: [[1, 30, 44], [2, 30, 60]]
  },
  q: {
    // Bowl, then the stem with descender.
    paths: [
      'M70,56 C52,54 38,62 38,72 C38,82 52,90 70,90',
      'M70,46 L70,106'
    ],
    numbers: [[1, 78, 54], [2, 78, 44]]
  },
  r: {
    // Stem, then the arm.
    paths: [
      'M40,46 L40,90',
      'M40,58 C48,46 58,46 64,52'
    ],
    numbers: [[1, 32, 44], [2, 32, 60]]
  },
  s: {
    paths: ['M70,54 C66,47 58,44 50,45 C40,47 34,52 35,59 C36,65 44,67 54,69 C64,71 70,75 70,81 C70,87 60,88 50,88 C42,88 34,84 30,78'],
    numbers: [[1, 78, 52]]
  },
  t: {
    // Stem (with a small hook), then the crossbar.
    paths: [
      'M52,26 L52,84 Q52,90 60,90',
      'M36,54 L70,54'
    ],
    numbers: [[1, 44, 24], [2, 30, 50]]
  },
  u: {
    paths: ['M34,46 L34,74 C34,83 42,90 52,90 C62,90 70,83 70,74 L70,46'],
    numbers: [[1, 26, 44]]
  },
  v: {
    paths: ['M36,46 L54,90 L72,46'],
    numbers: [[1, 28, 44]]
  },
  w: {
    paths: ['M22,46 L38,90 L54,62 L70,90 L86,46'],
    numbers: [[1, 14, 44]]
  },
  x: {
    paths: [
      'M34,46 L74,90',
      'M74,46 L34,90'
    ],
    numbers: [[1, 26, 44], [2, 82, 44]]
  },
  y: {
    // Left diagonal, then the right diagonal continuing below the baseline.
    paths: [
      'M34,46 L56,90',
      'M74,46 L56,90 L44,106'
    ],
    numbers: [[1, 26, 44], [2, 82, 44]]
  },
  z: {
    paths: [
      'M30,46 L74,46',
      'M74,46 L30,90',
      'M30,90 L74,90'
    ],
    numbers: [[1, 22, 44], [2, 82, 44], [3, 22, 86]]
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
