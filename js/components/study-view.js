import { Storage } from '../lib/storage.js';
import { matchStroke, getThresholdForMode, samplePath } from '../lib/stroke-matcher.js';
import { standardCharacters, recordPractice } from '../lib/progress.js';

const VIEWBOX = 109;

// Recognition thresholds are fairly forgiving — this is for young learners.
const TRACE_THRESHOLD = getThresholdForMode('trace');

export class StudyView {
  constructor(container, data, options = {}) {
    this.container = container;
    this.data = data; // hiragana.json
    this.onExit = options.onExit || (() => {});

    // The practice sequence: all standard characters (optionally starting at one).
    this.sequence = standardCharacters().filter((c) =>
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
  }

  async init() {
    this.settings = await Storage.getSettings();
    this.progress = await Storage.getProgress();

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
        <div class="study-prompt">
          <div class="reading" id="prompt-reading" aria-live="polite"></div>
        </div>
        <div class="drawing-container" id="drawing-container" role="img"
             aria-label="れんしゅうエリア。せんを かいてください。">
          <svg id="shadow-svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">
            <g id="shadow-group"></g>
            <g id="numbers-group"></g>
          </svg>
          <canvas id="grid-canvas" width="${VIEWBOX}" height="${VIEWBOX}"></canvas>
          <canvas id="draw-canvas" width="${VIEWBOX}" height="${VIEWBOX}"></canvas>
          <div class="feedback-overlay" id="feedback-overlay">
            <div class="feedback-text" id="feedback-text" role="status" aria-live="polite"></div>
          </div>
        </div>
        <div class="study-info">
          <span class="progress" id="study-progress"></span>
          <span id="stroke-info"></span>
        </div>

        <div class="study-controls" id="study-controls">
          <button class="btn btn-secondary" id="btn-clear" aria-label="けす">けす</button>
          <button class="btn btn-secondary" id="btn-back" aria-label="もどる">もどる</button>
        </div>

        <div class="result-buttons" id="result-buttons" style="display:none" role="group" aria-label="つぎの どうさ">
          <button class="btn btn-primary btn-large" id="btn-next">つぎへ</button>
          <button class="btn btn-secondary btn-large" id="btn-repeat">もういちど</button>
          <button class="btn btn-secondary" id="btn-back2">もどる</button>
        </div>
      </div>
    `;

    this.shadowGroup = this.container.querySelector('#shadow-group');
    this.numbersGroup = this.container.querySelector('#numbers-group');
    this.gridCanvas = this.container.querySelector('#grid-canvas');
    this.drawCanvas = this.container.querySelector('#draw-canvas');
    this.drawCtx = this.drawCanvas.getContext('2d');
    this.feedbackOverlay = this.container.querySelector('#feedback-overlay');
    this.feedbackText = this.container.querySelector('#feedback-text');
    this.promptReading = this.container.querySelector('#prompt-reading');
    this.progressEl = this.container.querySelector('#study-progress');
    this.strokeInfo = this.container.querySelector('#stroke-info');
    this.studyControls = this.container.querySelector('#study-controls');
    this.resultButtons = this.container.querySelector('#result-buttons');

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

    this.container.querySelector('#btn-clear').addEventListener('click', () => this.resetStrokes());
    this.container.querySelector('#btn-back').addEventListener('click', () => this.onExit());
    this.container.querySelector('#btn-back2').addEventListener('click', () => this.onExit());
    this.container.querySelector('#btn-next').addEventListener('click', () => this.next());
    this.container.querySelector('#btn-repeat').addEventListener('click', () => this.repeat());

    this._keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (this.isComplete) {
        if (key === 'n' || key === 'arrowright') { e.preventDefault(); this.next(); }
        else if (key === 'r') { e.preventDefault(); this.repeat(); }
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

    this.strokeIndex = 0;
    this.acceptedStrokes = [];
    this.currentStroke = [];
    this.isDrawing = false;
    this.attemptedThisStroke = false;
    this.cleanRun = true;
    this.isComplete = false;
    this.hintsUsed = 0;

    // Pre-sample reference paths for recognition.
    this.sampledPaths = this.charData ? this.charData.paths.map((p) => samplePath(p)) : [];

    this.updateUI();
    this.renderShadow();
    this.clearDrawCanvas();
  }

  updateUI() {
    const char = this.sequence[this.index];
    const romaji = this.getRomaji(char);
    this.promptReading.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:0.25rem">${char}</div>
      ${this.settings.showRomaji && romaji ? `<div style="font-size:1rem;color:var(--text-muted)">${romaji}</div>` : ''}
    `;
    this.progressEl.textContent = `${this.index + 1} / ${this.sequence.length}`;
    this.strokeInfo.textContent = `Stroke ${this.strokeIndex + 1} of ${this.charData?.paths.length || 0}`;
    this.resultButtons.style.display = 'none';
    this.studyControls.style.display = 'flex';
  }

  getRomaji(char) {
    const map = {
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
    return map[char] || '';
  }

  renderShadow() {
    this.shadowGroup.innerHTML = '';
    this.numbersGroup.innerHTML = '';
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
  }

  updateHighlight() {
    const paths = this.shadowGroup.querySelectorAll('.shadow-path');
    paths.forEach((p, i) => p.classList.toggle('highlight', i === this.strokeIndex));
    const total = this.charData?.paths.length || 0;
    const shown = Math.min(this.strokeIndex + 1, total);
    this.strokeInfo.textContent = `Stroke ${shown} of ${total}`;
  }

  clearDrawCanvas() {
    this.drawCtx.clearRect(0, 0, VIEWBOX, VIEWBOX);
  }

  startStroke(pt) {
    if (!this.charData || this.strokeIndex >= this.charData.paths.length) return;
    this.isDrawing = true;
    this.currentStroke = [pt];
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
    if (this.currentStroke.length < 2) {
      this.currentStroke = [];
      this.redrawAcceptedStrokes();
      return;
    }

    const refPath = this.charData.paths[this.strokeIndex];
    const result = matchStroke(this.currentStroke, refPath, { threshold: TRACE_THRESHOLD });

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
      this.showFeedback('もう いちど', 800);
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
    Storage.saveProgress(this.progress);

    // Show result buttons. "Next" only after a clean run.
    this.studyControls.style.display = 'none';
    this.resultButtons.style.display = 'flex';
    const nextBtn = this.container.querySelector('#btn-next');
    nextBtn.style.display = this.cleanRun ? 'inline-flex' : 'none';
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
