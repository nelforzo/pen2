#!/usr/bin/env node
// Builds stroke data for the numbers section.
//
// Digits 0–9 are hand-authored simple paths in KanjiVG's 0 0 109 109 coordinate
// space. Every integer from 10–100 is then composed by placing the digit shapes
// side by side, so a multi-digit number is practised as the strokes of its
// digits in order — first the left digit, then the next, and so on.
//
// Usage: node scripts/build-numbers.js
const fs = require('fs');
const path = require('path');

// Order numbers are placed just before each path's start point, so the child
// knows where to begin the stroke. See `numbers` in each entry.
const DIGITS = {
  0: {
    paths: ['M54,12 Q22,12 22,54 Q22,96 54,96 Q86,96 86,54 Q86,12 54,12'],
    numbers: [[1, 54, 6]]
  },
  1: {
    paths: ['M34,28 L54,14 L54,96'],
    numbers: [[1, 28, 23]]
  },
  2: {
    paths: ['M22,36 Q22,14 52,14 Q82,14 82,36 Q82,54 54,70 Q30,84 22,96 L84,96'],
    numbers: [[1, 16, 32]]
  },
  3: {
    paths: ['M24,30 Q38,14 54,14 Q82,14 82,34 Q82,52 54,52 Q82,52 82,72 Q82,96 54,96 Q38,96 24,82'],
    numbers: [[1, 18, 25]]
  },
  4: {
    paths: [
      'M66,14 L22,66 L88,66',
      'M66,14 L66,96'
    ],
    numbers: [[1, 58, 9], [2, 74, 9]]
  },
  5: {
    paths: ['M76,14 L34,14 L28,50 Q42,44 56,44 Q84,44 84,70 Q84,96 54,96 Q36,96 24,84'],
    numbers: [[1, 84, 9]]
  },
  6: {
    paths: ['M72,18 Q55,12 42,22 Q22,38 22,66 Q22,96 52,96 Q80,96 80,72 Q80,50 52,50 Q30,50 24,64'],
    numbers: [[1, 80, 13]]
  },
  7: {
    paths: [
      'M22,14 L84,14',
      'M84,14 L46,96'
    ],
    numbers: [[1, 16, 9], [2, 92, 20]]
  },
  8: {
    // Start at the centre: up the left side of the upper loop, back to the
    // centre, then around the lower loop and back.
    paths: ['M54,50 Q28,50 28,31 Q28,14 54,14 Q80,14 80,31 Q80,50 54,50 Q22,50 22,73 Q22,96 54,96 Q86,96 86,73 Q86,50 54,50'],
    numbers: [[1, 54, 40]]
  },
  9: {
    paths: [
      'M82,36 Q82,14 54,14 Q26,14 26,36 Q26,58 54,58 Q82,58 82,36',
      'M82,36 L82,68 Q82,96 52,96 Q36,96 28,88'
    ],
    numbers: [[1, 92, 31], [2, 90, 49]]
  }
};

const VIEW = 109;
const MARGIN = 5; // left/right inset for composed numbers
const GAP = 3;    // space between composed digits

function toHex(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

function pathCoords(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

function pathsBBox(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const { x, y } of pathCoords(p)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Scales every coordinate pair (M/L/Q only) and rounds to 2 decimals.
function transformPath(d, s, tx, ty) {
  return d.replace(/([MLQC])([^MLQC]*)/g, (_, cmd, args) => {
    const nums = (args.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const pairs = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = +(nums[i] * s + tx).toFixed(2);
      const y = +(nums[i + 1] * s + ty).toFixed(2);
      pairs.push(`${x},${y}`);
    }
    return cmd + pairs.join(' ');
  });
}

function baseEntry(digit) {
  return {
    paths: DIGITS[digit].paths,
    numbers: DIGITS[digit].numbers.map(([n, x, y]) => ({ n, x, y })),
  };
}

// Bounding box of a digit including its order-number anchors, so composed
// numbers leave room for the tags instead of clipping them at the edges.
function digitBBox(digit) {
  const box = pathsBBox(DIGITS[digit].paths);
  let { minX, minY, maxX, maxY } = box;
  for (const [, x, y] of DIGITS[digit].numbers) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Composes a string of digits into one glyph: each digit is uniformly scaled
// and centred in its own slot, then the strokes are concatenated left→right.
function composeNumber(str) {
  const digits = str.split('');
  if (digits.length === 1) return baseEntry(str);

  const n = digits.length;
  const slotW = (VIEW - 2 * MARGIN - (n - 1) * GAP) / n;
  const maxH = VIEW - 2 * MARGIN;
  const boxes = digits.map((d) => digitBBox(d));

  // One shared scale so all digits in the number are the same size.
  let scale = Infinity;
  boxes.forEach((b) => {
    scale = Math.min(scale, slotW / b.width, maxH / b.height);
  });

  const paths = [];
  const numbers = [];
  let strokeOffset = 0;

  digits.forEach((d, i) => {
    const b = boxes[i];
    const slotLeft = MARGIN + i * (slotW + GAP);
    const tx = slotLeft + (slotW - b.width * scale) / 2 - b.minX * scale;
    const ty = (VIEW - b.height * scale) / 2 - b.minY * scale;

    DIGITS[d].paths.forEach((p) => paths.push(transformPath(p, scale, tx, ty)));
    DIGITS[d].numbers.forEach(([num, x, y]) => {
      // Keep tags inside the viewBox; the rightmost digit's label can otherwise
      // spill past x=109 and be clipped.
      numbers.push({
        n: num + strokeOffset,
        x: Math.min(105, Math.max(4, +(x * scale + tx).toFixed(2))),
        y: Math.min(105, Math.max(4, +(y * scale + ty).toFixed(2))),
      });
    });
    strokeOffset += DIGITS[d].paths.length;
  });

  return { paths, numbers };
}

const results = [];
for (let i = 0; i <= 100; i++) {
  const str = String(i);
  const composed = composeNumber(str);
  results.push({
    char: str,
    codepoint: [...str].map(toHex).join(' '),
    viewBox: '0 0 109 109',
    paths: composed.paths,
    numbers: composed.numbers,
  });
}

const outPath = path.join(__dirname, '..', 'js', 'data', 'numbers.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`Wrote ${results.length} numbers to ${outPath}`);
