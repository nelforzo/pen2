/**
 * Stroke matching using normalized point-cloud distance.
 * Samples SVG paths and compares against user-drawn strokes.
 */

const SAMPLE_COUNT = 64;

// Hidden SVG for path sampling
let samplerSvg = null;

function getSampler() {
  if (!samplerSvg) {
    samplerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    samplerSvg.setAttribute('width', '0');
    samplerSvg.setAttribute('height', '0');
    samplerSvg.style.position = 'absolute';
    document.body.appendChild(samplerSvg);
  }
  return samplerSvg;
}

export function samplePath(pathData, count = SAMPLE_COUNT) {
  const svg = getSampler();
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  const len = path.getTotalLength();
  const points = [];
  for (let i = 0; i < count; i++) {
    const pt = path.getPointAtLength((len * i) / Math.max(1, count - 1));
    points.push({ x: pt.x, y: pt.y });
  }
  svg.removeChild(path);
  return points;
}

export function normalize(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.max(w, h);
  return points.map(p => ({
    x: (p.x - minX) / scale,
    y: (p.y - minY) / scale,
  }));
}

export function resample(points, count = SAMPLE_COUNT) {
  if (points.length === count) return points;
  if (points.length < 2) return Array.from({ length: count }, () => points[0] || { x: 0, y: 0 });

  // Compute cumulative arc length
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0) return Array.from({ length: count }, () => points[0]);

  const result = [points[0]];
  let idx = 1;
  for (let i = 1; i < count - 1; i++) {
    const target = (total * i) / (count - 1);
    while (idx < lengths.length && lengths[idx] < target) idx++;
    if (idx >= lengths.length) {
      result.push(points[points.length - 1]);
      continue;
    }
    const t = (target - lengths[idx - 1]) / (lengths[idx] - lengths[idx - 1] || 1);
    const a = points[idx - 1];
    const b = points[idx];
    result.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

function meanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i].x - b[i].x;
    const dy = a[i].y - b[i].y;
    sum += dx * dx + dy * dy;
  }
  return Math.sqrt(sum / a.length);
}

function directionAngle(points) {
  // Robust direction: vector from start to ~25% along the stroke.
  // Using just the first segment is too noisy for curvy strokes.
  if (points.length < 2) return 0;
  const idx = Math.max(1, Math.floor(points.length * 0.25));
  const start = points[0];
  const mid = points[idx];
  return Math.atan2(mid.y - start.y, mid.x - start.x);
}

function angleDifference(a, b) {
  let diff = Math.abs(a - b);
  while (diff > Math.PI) diff -= 2 * Math.PI;
  return Math.abs(diff);
}

export function matchStroke(userPoints, refPathData, options = {}) {
  const threshold = options.threshold ?? 0.75;
  const checkDirection = options.checkDirection !== false;

  const refSampled = samplePath(refPathData, SAMPLE_COUNT);
  const userResampled = resample(userPoints, SAMPLE_COUNT);

  const refNorm = normalize(refSampled);
  const userNorm = normalize(userResampled);

  const dist = meanDistance(refNorm, userNorm);
  // Map distance to similarity [0, 1]
  // Typical distances: similar strokes ~0.1-0.2, different ~0.4+
  let similarity = Math.max(0, 1 - dist * 2.5);

  // Direction check
  if (checkDirection && similarity >= threshold * 0.8) {
    const refAngle = directionAngle(refSampled);
    const userAngle = directionAngle(userResampled);
    const angleDiff = angleDifference(refAngle, userAngle);
    // Penalize if angle differs by more than ~60 degrees
    if (angleDiff > 1.0) {
      similarity *= 0.6;
    } else if (angleDiff > 0.5) {
      similarity *= 0.85;
    }
  }

  return {
    similarity,
    accepted: similarity >= threshold,
  };
}

export function getThresholdForMode(mode) {
  // Thresholds lowered ~20% from the original values (0.62 / 0.72 / 0.78)
  // to make stroke recognition more forgiving.
  switch (mode) {
    case 'trace': return 0.50;
    case 'guided': return 0.58;
    case 'recall': return 0.62;
    default: return 0.58;
  }
}
