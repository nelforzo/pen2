import { Storage } from '../lib/storage.js';
import { matchStroke, getThresholdForMode, samplePath, isDotMark } from '../lib/stroke-matcher.js';
import { recordPractice, isPracticed, isClean } from '../lib/progress.js';
import { speak } from '../lib/speech.js';

const VIEWBOX = 109;

// Recognition thresholds are fairly forgiving — this is for young learners.
const TRACE_THRESHOLD = getThresholdForMode('trace');

// Stroke-order demo speed, in viewBox units per millisecond. Computing the
// duration from each stroke's length (instead of a fixed time per stroke)
// keeps short and long strokes animating at the same gentle pace.
const DEMO_SPEED = 0.07; // ~70 units per second
const DEMO_MIN_DURATION = 500; // ms — keep very short strokes visible

// Romaji readings for the standard hiragana. Katakana readings are derived by
// shifting each hiragana codepoint by 0x60 (あ→ア, を→ヲ, ん→ン, …).
const HIRAGANA_ROMAJI = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'wo','ん':'n',
};
const ROMAJI = { ...HIRAGANA_ROMAJI };
for (const [kana, reading] of Object.entries(HIRAGANA_ROMAJI)) {
  ROMAJI[String.fromCodePoint(kana.codePointAt(0) + 0x60)] = reading;
}

export class StudyView {
  constructor(container, section, data, options = {}) {
    this.container = container;
    this.section = section;
    this.data = data; // stroke data for this section
    this.onExit = options.onExit || (() => {});

    // The practice sequence: all standard characters (optionally starting at one).
    this.sequence = section.chars.filter((c) =>
      this.data.some((d) => d.char === c)
    );
    this.startChar = options.startChar || null;

    this.acceptedStrokes = [];
    this.currentStroke = [];
    this.isDrawing = false;
    this.strokeIndex = 0;
    this.charData = null;
    this.attemptedThisStroke = false; // did the child already miss the current stroke?
    this.cleanRun = true;
    this.settings = { showRomaji: true };
    this.isAnimating = false;
    this._animationToken = 0;
    // Translation applied to center the current character on the canvas.
    this.offset = { x: 0, y: 0 };
  }

  async init() {
    this.settings = await Storage.getSettings();
    this.progress = await Storage.getProgress(this.section.id);

    const startIndex = this.startChar
      ? Math.max(0, this.sequence.indexOf(this.startChar))
      : 0;
    this.index = startIndex;

    this.render();
    this.loadCharacter(this.index);
  }

  render() {
    this.container.innerHTML = `
      <div class="study-view">
        <button class="btn btn-secondary study-back" id="btn-back" aria-label="戻る">←</button>
        <div class="study-status" id="study-status" aria-live="polite"></div>
        <div class="study-prompt">
          <div class="reading" id="prompt-reading" aria-live="polite"></div>
        </div>
        <div class="drawing-container" id="drawing-container" role="img"
             aria-label="練習エリア。線を書いてください。">
          <svg id="shadow-svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">
            <g id="shadow-group"></g>
            <g id="numbers-group"></g>
          </svg>
          <canvas id="grid-canvas" width="${VIEWBOX}" height="${VIEWBOX}"></canvas>
          <canvas id="draw-canvas" width="${VIEWBOX}" height="${VIEWBOX}"></canvas>
          <!-- Arrow sits above the draw canvas so accepted strokes don't hide it. -->
          <svg id="arrow-svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g id="arrow-group"></g>
          </svg>
          <div class="feedback-overlay" id="feedback-overlay">
            <div class="feedback-text" id="feedback-text" role="status" aria-live="polite"></div>
          </div>
        </div>
        <div class="study-info">
          <span class="progress" id="study-progress"></span>
          <span id="stroke-info"></span>
        </div>

        <div class="study-controls" id="study-controls" role="group" aria-label="操作">
          <button class="btn btn-secondary" id="btn-replay" aria-label="ヒント">?</button>
          <button class="btn btn-secondary" id="btn-redo" aria-label="やり直す">↻</button>
          <button class="btn btn-primary" id="btn-next" disabled aria-label="次へ">→</button>
        </div>
      </div>
    `;

    this.shadowGroup = this.container.querySelector('#shadow-group');
    this.numbersGroup = this.container.querySelector('#numbers-group');
    this.arrowGroup = this.container.querySelector('#arrow-group');
    this.gridCanvas = this.container.querySelector('#grid-canvas');
    this.drawCanvas = this.container.querySelector('#draw-canvas');
    this.drawCtx = this.drawCanvas.getContext('2d');
    this.feedbackOverlay = this.container.querySelector('#feedback-overlay');
    this.feedbackText = this.container.querySelector('#feedback-text');
    this.promptReading = this.container.querySelector('#prompt-reading');
    this.progressEl = this.container.querySelector('#study-progress');
    this.strokeInfo = this.container.querySelector('#stroke-info');
    this.studyControls = this.container.querySelector('#study-controls');
    this.statusEl = this.container.querySelector('#study-status');
    this.nextBtn = this.container.querySelector('#btn-next');

    this.setupHiDPI();
    this.drawGrid();
    this.bindEvents();
  }

  setupHiDPI() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    [this.gridCanvas, this.drawCanvas].forEach((canvas) => {
      canvas.width = Math.round(VIEWBOX * dpr);
      canvas.height = Math.round(VIEWBOX * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    this.drawCtx = this.drawCanvas.getContext('2d');
    this._dpr = dpr;
  }

  drawGrid() {
    const ctx = this.gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, VIEWBOX, VIEWBOX);
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, VIEWBOX - 4, VIEWBOX - 4);
    ctx.beginPath();
    ctx.moveTo(VIEWBOX / 2, 2);
    ctx.lineTo(VIEWBOX / 2, VIEWBOX - 2);
    ctx.moveTo(2, VIEWBOX / 2);
    ctx.lineTo(VIEWBOX - 2, VIEWBOX / 2);
    ctx.stroke();
  }

  bindEvents() {
    const container = this.container.querySelector('#drawing-container');
    const isDrawable = (e) =>
      e.isPrimary &&
      (e.pointerType === 'pen' || e.pointerType === 'touch' || e.button === 0 || e.buttons === 1);

    container.addEventListener('pointerdown', (e) => {
      if (!isDrawable(e)) return;
      if (this.isDrawing || this.isComplete) return;
      e.preventDefault();
      this._activePointerId = e.pointerId;
      try { container.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      this.startStroke(this.getPoint(e));
    });

    container.addEventListener('pointermove', (e) => {
      if (!this.isDrawing || e.pointerId !== this._activePointerId) return;
      e.preventDefault();
      this.addPoint(this.getPoint(e));
    });

    const finish = (e) => {
      if (!this.isDrawing || e.pointerId !== this._activePointerId) return;
      this._activePointerId = null;
      this.endStroke();
    };

    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', finish);
    container.addEventListener('lostpointercapture', () => {
      if (this.isDrawing) { this._activePointerId = null; this.endStroke(); }
    });

    this.container.querySelector('#btn-back').addEventListener('click', () => this.onExit());
    this.container.querySelector('#btn-replay').addEventListener('click', () => this.playStrokeOrder());
    this.container.querySelector('#btn-redo').addEventListener('click', () => this.repeat());
    this.nextBtn.addEventListener('click', () => this.next());

    this._keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      // Next is available once the character is complete or already passed.
      if (!this.nextBtn.disabled && (key === 'n' || key === 'arrowright')) {
        e.preventDefault();
        this.next();
        return;
      }
      if (this.isComplete) {
        if (key === 'r') { e.preventDefault(); this.repeat(); }
        return;
      }
      if (key === 'c') { e.preventDefault(); this.resetStrokes(); }
      else if (key === 'b' || key === 'escape') { e.preventDefault(); this.onExit(); }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  destroy() {
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
  }

  getPoint(e) {
    const rect = this.drawCanvas.getBoundingClientRect();
    const scaleX = VIEWBOX / rect.width;
    const scaleY = VIEWBOX / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  loadCharacter(index) {
    this.index = index;
    const char = this.sequence[index];
    this.charData = this.data.find((d) => d.char === char);

    this._animationToken++;
    this.isAnimating = false;
    this.strokeIndex = 0;
    this.acceptedStrokes = [];
    this.currentStroke = [];
    this.isDrawing = false;
    this.attemptedThisStroke = false;
    this.cleanRun = true;
    this.isComplete = false;
    this.hintsUsed = 0;

    // Pre-sample reference paths in their raw data space first, so we can flag
    // dots (i/j, etc.) for the tap-friendly match. Dot detection is based on
    // size, so translation does not affect it.
    const localSampled = this.charData ? this.charData.paths.map((p) => samplePath(p)) : [];
    this.dotStrokes = localSampled.map((pts) => isDotMark(pts));

    this.updateUI();
    // renderShadow() computes the centering offset and applies it to the guide,
    // number and arrow layers.
    this.renderShadow();
    // Translate the reference samples into the same (centered) space the child
    // draws in, so dot-position matching stays accurate.
    this.sampledPaths = localSampled.map((pts) =>
      pts.map((p) => ({ x: p.x + this.offset.x, y: p.y + this.offset.y }))
    );
    this.clearDrawCanvas();

    // Read the character name aloud when it appears.
    this.speakCharacter();
  }

  speakCharacter() {
    if (this.settings.speak === false) return;
    const char = this.sequence[this.index];
    if (!char) return;
    const text = this.section.speechText ? this.section.speechText(char) : char;
    speak(text, { lang: this.section.speechLang });
  }

  updateUI() {
    const char = this.sequence[this.index];
    const romaji = this.getRomaji(char);
    this.promptReading.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:0.25rem">${char}</div>
      ${this.settings.showRomaji && this.section.showRomaji !== false && romaji ? `<div style="font-size:1rem;color:var(--text-muted)">${romaji}</div>` : ''}
    `;
    this.progressEl.textContent = `${this.index + 1} / ${this.sequence.length}`;
    this.strokeInfo.textContent = `Stroke ${this.strokeIndex + 1} of ${this.charData?.paths.length || 0}`;
    // A character that already has a pass mark (✓/★) can be skipped, so the
    // child can move on without redrawing it.
    this.nextBtn.disabled = !this.hasPassed(this.progress[char]);
    this.updateStatusBadge();
  }

  hasPassed(entry) {
    return isPracticed(entry) || isClean(entry);
  }

  updateStatusBadge() {
    if (!this.statusEl) return;
    const char = this.sequence[this.index];
    const entry = this.progress[char];
    const clean = isClean(entry);
    const done = isPracticed(entry);
    this.statusEl.textContent = clean ? '★' : done ? '✓' : '';
    this.statusEl.classList.toggle('clean', clean);
    this.statusEl.classList.toggle('practiced', done && !clean);
    this.statusEl.setAttribute(
      'aria-label',
      clean ? '完璧' : done ? '練習済み' : ''
    );
  }

  getRomaji(char) {
    return ROMAJI[char] || '';
  }

  renderShadow() {
    this.shadowGroup.innerHTML = '';
    this.numbersGroup.innerHTML = '';
    this.arrowGroup.innerHTML = '';
    this.shadowGroup.removeAttribute('transform');
    this.numbersGroup.removeAttribute('transform');
    this.arrowGroup.removeAttribute('transform');
    this.offset = { x: 0, y: 0 };
    if (!this.charData) return;

    this.charData.paths.forEach((d, i) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', `shadow-path ${i === this.strokeIndex ? 'highlight' : ''}`);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      this.shadowGroup.appendChild(path);
    });

    if (this.charData.numbers) {
      this.charData.numbers.forEach((num) => {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', num.x);
        text.setAttribute('y', num.y);
        text.setAttribute('class', 'stroke-number');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = num.n;
        this.numbersGroup.appendChild(text);
      });
    }

    // Center the character on the canvas based on its geometric bounds. Some
    // glyphs (descenders like p/j, small kana, dakuten) sit well off-centre in
    // the source data; nudging the whole character keeps it mid-canvas.
    const b = this.shadowGroup.getBBox();
    const dx = VIEWBOX / 2 - (b.x + b.width / 2);
    const dy = VIEWBOX / 2 - (b.y + b.height / 2);
    this.offset = { x: dx, y: dy };
    if (dx || dy) {
      const t = `translate(${dx} ${dy})`;
      this.shadowGroup.setAttribute('transform', t);
      this.numbersGroup.setAttribute('transform', t);
      this.arrowGroup.setAttribute('transform', t);
    }

    this.renderStartArrow();
  }

  /**
   * Draw a small arrow near the start of the current stroke, pointing in the
   * direction the child should draw. Only the current stroke gets one.
   */
  renderStartArrow() {
    if (!this.arrowGroup) return;
    this.arrowGroup.innerHTML = '';
    if (!this.charData) return;

    const svgPath = this.shadowGroup.querySelectorAll('.shadow-path')[this.strokeIndex];
    if (!svgPath) return;

    // Dots (i/j, etc.) and very short ticks don't need a direction hint.
    if (this.dotStrokes && this.dotStrokes[this.strokeIndex]) return;
    const total = svgPath.getTotalLength();
    if (total < 10) return;

    const start = svgPath.getPointAtLength(0);
    // Look a little way ahead to work out the initial direction.
    const ahead = svgPath.getPointAtLength(Math.min(total, 10));
    let dx = ahead.x - start.x;
    let dy = ahead.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    dx /= dist;
    dy /= dist;

    // Lay the arrow along the initial direction, starting at the very start of
    // the stroke so its tail meets the stroke (no gap). Sized at ~80% of the
    // original.
    const tail = start;
    const length = 5.6; // total arrow length (shaft + head), ~80% of original
    const headLength = 2.8;
    const headHalfWidth = 1.9;
    const perpX = -dy;
    const perpY = dx;
    const tip = { x: tail.x + dx * length, y: tail.y + dy * length };
    const neck = { x: tip.x - dx * headLength, y: tip.y - dy * headLength };
    const left = { x: neck.x + perpX * headHalfWidth, y: neck.y + perpY * headHalfWidth };
    const right = { x: neck.x - perpX * headHalfWidth, y: neck.y - perpY * headHalfWidth };

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute(
      'd',
      `M ${tail.x} ${tail.y} L ${neck.x} ${neck.y} ` +
      `M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y} Z`
    );
    arrow.setAttribute('class', 'stroke-arrow');
    this.arrowGroup.appendChild(arrow);
  }

  updateHighlight() {
    const paths = this.shadowGroup.querySelectorAll('.shadow-path');
    paths.forEach((p, i) => p.classList.toggle('highlight', i === this.strokeIndex));
    this.renderStartArrow();
    const total = this.charData?.paths.length || 0;
    const shown = Math.min(this.strokeIndex + 1, total);
    this.strokeInfo.textContent = `Stroke ${shown} of ${total}`;
  }

  clearDrawCanvas() {
    this.drawCtx.clearRect(0, 0, VIEWBOX, VIEWBOX);
  }

  startStroke(pt) {
    if (!this.charData || this.strokeIndex >= this.charData.paths.length) return;
    // Stop a running stroke-order demo so the child can draw freely.
    this._animationToken++;
    this.isAnimating = false;
    this.isDrawing = true;
    this.currentStroke = [pt];
    // Hide the hint once the child starts drawing.
    this.arrowGroup.innerHTML = '';
  }

  addPoint(pt) {
    if (!this.isDrawing) return;
    this.currentStroke.push(pt);
    this.drawCurrentStroke();
  }

  drawCurrentStroke() {
    this.redrawAcceptedStrokes();
    if (this.currentStroke.length < 2) return;
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(this.currentStroke[0].x, this.currentStroke[0].y);
    for (let i = 1; i < this.currentStroke.length; i++) {
      this.drawCtx.lineTo(this.currentStroke[i].x, this.currentStroke[i].y);
    }
    this.drawCtx.strokeStyle = '#2563eb';
    this.drawCtx.lineWidth = 3;
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.stroke();
  }

  redrawAcceptedStrokes() {
    this.clearDrawCanvas();
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.lineWidth = 3;
    for (const stroke of this.acceptedStrokes) {
      this.drawCtx.beginPath();
      this.drawCtx.strokeStyle = '#1a1a1a';
      this.drawCtx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        this.drawCtx.lineTo(stroke[i].x, stroke[i].y);
      }
      this.drawCtx.stroke();
    }
  }

  endStroke() {
    this.isDrawing = false;
    // A single point (tap) is enough for a dot stroke, but otherwise we need a
    // real stroke to compare against the reference.
    const isDot = this.dotStrokes && this.dotStrokes[this.strokeIndex];
    if (this.currentStroke.length < 2 && !isDot) {
      this.currentStroke = [];
      this.redrawAcceptedStrokes();
      // Nothing was accepted, so bring the hint back.
      this.renderStartArrow();
      return;
    }

    const refPath = this.charData.paths[this.strokeIndex];
    const result = matchStroke(this.currentStroke, refPath, {
      threshold: TRACE_THRESHOLD,
      refSampled: this.sampledPaths[this.strokeIndex],
    });

    if (result.accepted) {
      if (this.attemptedThisStroke) this.cleanRun = false;
      this.acceptedStrokes.push([...this.currentStroke]);
      this.currentStroke = [];
      this.strokeIndex++;
      this.attemptedThisStroke = false;
      this.redrawAcceptedStrokes();
      this.updateHighlight();

      if (this.strokeIndex >= this.charData.paths.length) {
        this.complete();
      }
    } else {
      // A miss on this stroke means it wasn't a clean run.
      this.attemptedThisStroke = true;
      this.cleanRun = false;
      this.currentStroke = [];
      this.redrawAcceptedStrokes();
      this.showFeedback('もう一度', 800);
      // The stroke was rejected, so show the hint again for the retry.
      this.renderStartArrow();
    }
  }

  showFeedback(text, duration = 1000) {
    this.feedbackText.textContent = text;
    this.feedbackOverlay.classList.add('visible');
    setTimeout(() => this.feedbackOverlay.classList.remove('visible'), duration);
  }

  resetStrokes() {
    if (this.isComplete) return;
    this.strokeIndex = 0;
    this.acceptedStrokes = [];
    this.currentStroke = [];
    this.attemptedThisStroke = false;
    this.cleanRun = true;
    this.hintsUsed = 0;
    this.redrawAcceptedStrokes();
    this.updateHighlight();
  }

  complete() {
    this.isComplete = true;
    this.showFeedback('できた！', 900);

    // Persist progress.
    const char = this.sequence[this.index];
    const updated = recordPractice(this.progress[char], this.cleanRun);
    updated.id = char;
    this.progress[char] = updated;
    Storage.saveProgress(this.section.id, this.progress);
    document.dispatchEvent(new CustomEvent('pen2:progresschanged'));

    // All strokes are registered, so the child may advance regardless of
    // whether the first attempt was clean. cleanRun still earns a ★.
    this.nextBtn.disabled = false;
    this.updateStatusBadge();
  }

  playStrokeOrder() {
    if (!this.charData || !this.charData.paths.length) return;

    // Say the character again while the order is demonstrated.
    this.speakCharacter();

    const token = ++this._animationToken;
    this.isAnimating = true;

    const svgPaths = Array.from(this.shadowGroup.querySelectorAll('.shadow-path'));

    const drawStroke = (index) => {
      if (token !== this._animationToken) return;
      if (index >= svgPaths.length) {
        this.isAnimating = false;
        return;
      }
      const pathEl = svgPaths[index];
      const total = pathEl.getTotalLength();
      // Longer strokes take proportionally longer so the pen moves at a
      // constant speed.
      const strokeDuration = Math.max(DEMO_MIN_DURATION, total / DEMO_SPEED);
      const start = performance.now();

      const step = (now) => {
        if (token !== this._animationToken) return;
        const t = Math.min(1, (now - start) / strokeDuration);
        this.renderAnimationFrame(svgPaths, index, total * t);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setTimeout(() => drawStroke(index + 1), 150);
        }
      };
      requestAnimationFrame(step);
    };

    drawStroke(0);
  }

  renderAnimationFrame(svgPaths, currentIndex, currentLength) {
    this.redrawAcceptedStrokes();
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.strokeStyle = '#059669'; // demo strokes differ from the child's strokes
    this.drawCtx.lineWidth = 4;

    for (let i = 0; i < currentIndex; i++) {
      this.drawPathLength(svgPaths[i], svgPaths[i].getTotalLength());
    }
    if (currentIndex < svgPaths.length) {
      this.drawPathLength(svgPaths[currentIndex], currentLength);
    }
  }

  drawPathLength(pathEl, length) {
    if (length <= 0) return;
    const ctx = this.drawCtx;
    const steps = Math.max(2, Math.ceil(length / 2));
    const { x: ox, y: oy } = this.offset;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const l = Math.min(length, (length * i) / steps);
      const p = pathEl.getPointAtLength(l);
      // getPointAtLength is in the path's local space; add the centering offset
      // so demo strokes line up with the translated guide layer.
      if (i === 0) ctx.moveTo(p.x + ox, p.y + oy);
      else ctx.lineTo(p.x + ox, p.y + oy);
    }
    ctx.stroke();
  }

  next() {
    if (this.index + 1 >= this.sequence.length) {
      this.onExit();
      return;
    }
    this.loadCharacter(this.index + 1);
  }

  repeat() {
    this.loadCharacter(this.index);
  }
}
