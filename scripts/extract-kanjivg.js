#!/usr/bin/env node
// Extracts stroke data from KanjiVG SVGs.
//
// Usage:
//   node scripts/extract-kanjivg.js            # both scripts
//   node scripts/extract-kanjivg.js hiragana   # only hiragana
//   node scripts/extract-kanjivg.js katakana   # only katakana
const fs = require('fs');
const path = require('path');

const KANAS = {
  hiragana: [
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
  ],
  katakana: [
    'ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ',
    'サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト',
    'ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ',
    'マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ',
    'ル','レ','ロ','ワ','ヲ','ン',
    'ガ','ギ','グ','ゲ','ゴ','ザ','ジ','ズ','ゼ','ゾ',
    'ダ','ヂ','ヅ','デ','ド','バ','ビ','ブ','ベ','ボ',
    'パ','ピ','プ','ペ','ポ',
    'ァ','ィ','ゥ','ェ','ォ','ャ','ュ','ョ','ッ','ヮ',
    'ヰ','ヱ'
  ]
};

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

async function extract(script, chars) {
  const results = [];
  const failed = [];

  for (const char of chars) {
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

  const outPath = path.join(__dirname, '..', 'js', 'data', `${script}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} characters to ${outPath}`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

async function main() {
  const only = process.argv[2];
  const scripts = only ? [only] : Object.keys(KANAS);
  for (const script of scripts) {
    if (!KANAS[script]) {
      console.error(`Unknown script "${script}". Use one of: ${Object.keys(KANAS).join(', ')}`);
      process.exit(1);
    }
    await extract(script, KANAS[script]);
  }
}

main().catch(console.error);
