#!/usr/bin/env node
// Extracts stroke data from KanjiVG SVGs.
const fs = require('fs');
const path = require('path');

const HIRAGANA = [
  'あ','い','う','え','お','か','き','く','け','こ',
  'さ','し','す','せ','そ','た','ち','つ','て','と',
  'な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ',
  'ま','み','む','め','も','や','ゆ','よ','ら','り',
  'る','れ','ろ','わ','を','ん',
  'が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ',
  'だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ',
  'ぱ','ぴ','ぷ','ぺ','ぽ',
  'ぁ','ぃ','ぅ','ぇ','ぉ','ゃ','ゅ','ょ','っ','ゎ',
  'ゐ','ゑ'
];

function toHex(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

async function fetchSVG(codepoint) {
  const hex = toHex(codepoint);
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${hex}: ${res.status}`);
  return res.text();
}

function parseTransform(t) {
  // Parses "matrix(1 0 0 1 x y)" to {x, y}
  const match = t.match(/matrix\([\d\s.]+\s([\d.]+)\s([\d.]+)\)/);
  if (match) return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
  const trans = t.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
  if (trans) return { x: parseFloat(trans[1]), y: parseFloat(trans[2]) };
  return { x: 0, y: 0 };
}

function parseSVG(svgText, char) {
  // Extract paths
  const paths = [];
  const pathRegex = /<path\s+id="kvg:[^"]+"\s+d="([^"]+)"/g;
  let m;
  while ((m = pathRegex.exec(svgText)) !== null) {
    paths.push(m[1]);
  }

  // Extract numbers with positions
  const numbers = [];
  const numRegex = /<text[^>]*transform="([^"]+)"[^>]*>(\d+)<\/text>/g;
  while ((m = numRegex.exec(svgText)) !== null) {
    const pos = parseTransform(m[1]);
    numbers.push({
      n: parseInt(m[2], 10),
      x: pos.x,
      y: pos.y
    });
  }

  // Extract viewBox
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 109 109';

  return {
    char,
    codepoint: toHex(char),
    viewBox,
    paths,
    numbers
  };
}

async function main() {
  const results = [];
  const failed = [];

  for (const char of HIRAGANA) {
    try {
      const svg = await fetchSVG(char);
      const data = parseSVG(svg, char);
      results.push(data);
      console.log(`✓ ${char} — ${data.paths.length} strokes`);
    } catch (e) {
      failed.push(char);
      console.error(`✗ ${char} — ${e.message}`);
    }
  }

  const outPath = path.join(__dirname, '..', 'js', 'data', 'hiragana.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} characters to ${outPath}`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

main().catch(console.error);
