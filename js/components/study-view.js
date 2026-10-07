import { Storage } from '../lib/storage.js';
import { schedule, RATING, getMaturity, getModeLabel, suggestRating, isDue } from '../lib/srs.js';
import { matchStroke, getThresholdForMode, samplePath } from '../lib/stroke-matcher.js';

const VIEWBOX = 109;

export class StudyView {
  constructor(container, data, onComplete) {
    this.container = container;
    this.data = data; // hiragana.json
    this.onComplete = onComplete;
    this.cards = [];
    this.queue = [];
    this.currentIndex = 0;
    this.sessionStats = new Map(); // char -> { totalStrokes, retries, hints }
    this.acceptedStrokes = [];
    this.currentStroke = [];
    this.isDrawing = false;
    this.strokeIndex = 0;
    this.charData = null;
    this.mode = 'trace';
    this.sampledPaths = [];
    this.settings = { showRomaji: true };
  }

  async init() {
    this.settings = await Storage.getSettings();
    this.cards = await Storage.getCards();
    if (!this.cards.length) {
      // Seed with all characters as new
      this.cards = this.data.map(d => ({
        id: d.char,
        state: 'new',
        step: 0,
        interval: 0,
        ef: 2.5,
        due: Date.now(),
        reps: 0,
        lapses: 0,
        totalReviews: 0,
        strokesAttempted: 0,
        strokesCorrect: 0,
        lastReview: null,
      }));
    }
    this.buildQueue();
    this.render();
    this.loadCard(0);
  }

  buildQueue() {
    // Show new cards first, then due reviews
    const newCards = this.cards.filter(c => c.state === 'new');
    const dueCards = this.cards.filter(c => c.state !== 'new' && isDue(c));
    // Limit new cards per session
    const maxNew = 10;
    this.queue = [...newCards.slice(0, maxNew), ...dueCards];
    // Shuffle slightly but keep new first
    for (let i = dueCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dueCards[i], dueCards[j]] = [dueCards[j], dueCards[i]];
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="study-view">
        <div class="study-prompt">
          <div class="reading" id="prompt-reading" aria-live="polite"></div>
          <span class="mode-badge" id="mode-badge">Trace</span>
        </div>
        <div class="drawing-container" id="drawing-container" role="img"
             aria-label="Handwriting practice area. Draw the character stroke by stroke.">
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
          <span class="progress" id="study-progress">Card 1 / 5</span>
          <span id="stroke-info"></span>
        </div>
        <div class="study-controls" id="study-controls">
          <button class="btn btn-secondary" id="btn-undo" aria-label="Undo last accepted stroke (keyboard: U)">Undo Stroke</button>
          <button class="btn btn-secondary" id="btn-hint" aria-label="Show the correct stroke (keyboard: H)">Show Stroke</button>
          <button class="btn btn-secondary" id="btn-skip" aria-label="Skip this card, rate Again (keyboard: S)">Skip</button>
        </div>
        <div class="rating-buttons" id="rating-buttons" style="display:none" role="group" aria-label="Rate your recall">
          <button class="rating-btn again" data-rating="1" aria-label="Again (keyboard: 1)">Again</button>
          <button class="rating-btn hard" data-rating="2" aria-label="Hard (keyboard: 2)">Hard</button>
          <button class="rating-btn good" data-rating="3" aria-label="Good (keyboard: 3)">Good</button>
          <button class="rating-btn easy" data-rating="4" aria-label="Easy (keyboard: 4)">Easy</button>
        </div>
      </div>
    `;

    this.shadowSvg = this.container.querySelector('#shadow-svg');
    this.shadowGroup = this.container.querySelector('#shadow-group');
    this.numbersGroup = this.container.querySelector('#numbers-group');
    this.gridCanvas = this.container.querySelector('#grid-canvas');
    this.drawCanvas = this.container.querySelector('#draw-canvas');
    this.drawCtx = this.drawCanvas.getContext('2d');
    this.feedbackOverlay = this.container.querySelector('#feedback-overlay');
    this.feedbackText = this.container.querySelector('#feedback-text');
    this.promptReading = this.container.querySelector('#prompt-reading');
    this.modeBadge = this.container.querySelector('#mode-badge');
    this.progressEl = this.container.querySelector('#study-progress');
    this.strokeInfo = this.container.querySelector('#stroke-info');
    this.ratingButtons = this.container.querySelector('#rating-buttons');
    this.studyControls = this.container.querySelector('#study-controls');

    this.drawGrid();
    this.bindEvents();
  }

  drawGrid() {
    const ctx = this.gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, VIEWBOX, VIEWBOX);
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Outer box
    ctx.strokeRect(2, 2, VIEWBOX - 4, VIEWBOX - 4);

    // Center cross
    ctx.beginPath();
    ctx.moveTo(VIEWBOX / 2, 2);
    ctx.lineTo(VIEWBOX / 2, VIEWBOX - 2);
    ctx.moveTo(2, VIEWBOX / 2);
    ctx.lineTo(VIEWBOX - 2, VIEWBOX / 2);
    ctx.stroke();

    // Diagonals
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(VIEWBOX - 2, VIEWBOX - 2);
    ctx.moveTo(VIEWBOX - 2, 2);
    ctx.lineTo(2, VIEWBOX - 2);
    ctx.stroke();
  }

  bindEvents() {
    const container = this.container.querySelector('#drawing-container');

    container.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      container.setPointerCapture(e.pointerId);
      this.startStroke(this.getPoint(e));
    });

    container.addEventListener('pointermove', (e) => {
      if (!this.isDrawing) return;
      this.addPoint(this.getPoint(e));
    });

    container.addEventListener('pointerup', () => {
      if (!this.isDrawing) return;
      this.endStroke();
    });

    this.container.querySelector('#btn-undo').addEventListener('click', () => this.undoStroke());
    this.container.querySelector('#btn-hint').addEventListener('click', () => this.showHint());
    this.container.querySelector('#btn-skip').addEventListener('click', () => this.skipCard());

    this.ratingButtons.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rating = parseInt(btn.dataset.rating, 10);
        this.rateCard(rating);
      });
    });

    // Keyboard shortcuts (review controls accessibility)
    this._keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      const ratingVisible = this.ratingButtons.style.display !== 'none';
      if (ratingVisible && ['1', '2', '3', '4'].includes(key)) {
        e.preventDefault();
        this.rateCard(parseInt(key, 10));
        return;
      }
      if (!ratingVisible) {
        if (key === 'u') { e.preventDefault(); this.undoStroke(); }
        else if (key === 'h') { e.preventDefault(); this.showHint(); }
        else if (key === 's') { e.preventDefault(); this.skipCard(); }
      }
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

  loadCard(index) {
    if (index >= this.queue.length) {
      this.finishSession();
      return;
    }

    this.currentIndex = index;
    const card = this.queue[index];
    this.charData = this.data.find(d => d.char === card.id);
    this.mode = getMaturity(card);
    this.strokeIndex = 0;
    this.acceptedStrokes = [];
    this.currentStroke = [];
    this.isDrawing = false;
    this.sampledPaths = [];

    // Pre-sample reference paths
    if (this.charData) {
      this.sampledPaths = this.charData.paths.map(p => samplePath(p));
    }

    if (!this.sessionStats.has(card.id)) {
      this.sessionStats.set(card.id, { totalStrokes: 0, retries: 0, hints: 0 });
    }

    this.updateUI();
    this.renderShadow();
    this.clearDrawCanvas();
  }

  updateUI() {
    const card = this.queue[this.currentIndex];
    const total = this.queue.length;
    const idx = this.currentIndex + 1;
    this.progressEl.textContent = `Card ${idx} / ${total}`;
    this.modeBadge.textContent = getModeLabel(this.mode);

    const romaji = this.getRomaji(card.id);
    this.promptReading.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:0.25rem">${card.id}</div>
      ${this.settings.showRomaji && romaji ? `<div style="font-size:1rem;color:var(--text-muted)">${romaji}</div>` : ''}
    `;

    // Show/hide numbers based on mode
    this.numbersGroup.style.display = this.mode === 'trace' ? 'block' : 'none';
    // Show/hide shadow based on mode
    this.shadowGroup.style.opacity = this.mode === 'recall' ? '0' : '1';

    this.strokeInfo.textContent = `Stroke ${this.strokeIndex + 1} of ${this.charData?.paths.length || 0}`;
    this.ratingButtons.style.display = 'none';
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
      'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
      'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
      'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
      'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
      'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
      'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
      'ゃ':'ya','ゅ':'yu','ょ':'yo','っ':'tsu','ゎ':'wa',
      'ゐ':'i','ゑ':'e'
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

    if (this.mode === 'trace' && this.charData.numbers) {
      this.charData.numbers.forEach(num => {
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
    paths.forEach((p, i) => {
      p.classList.toggle('highlight', i === this.strokeIndex);
    });
    this.strokeInfo.textContent = `Stroke ${this.strokeIndex + 1} of ${this.charData?.paths.length || 0}`;
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
    if (this.currentStroke.length < 3) {
      this.currentStroke = [];
      this.redrawAcceptedStrokes();
      return;
    }

    const stats = this.sessionStats.get(this.queue[this.currentIndex].id);
    stats.totalStrokes++;

    const refPath = this.charData.paths[this.strokeIndex];
    const threshold = getThresholdForMode(this.mode);
    const result = matchStroke(this.currentStroke, refPath, { threshold });

    if (result.accepted) {
      this.acceptedStrokes.push([...this.currentStroke]);
      this.currentStroke = [];
      this.strokeIndex++;
      this.redrawAcceptedStrokes();
      this.updateHighlight();

      if (this.strokeIndex >= this.charData.paths.length) {
        this.showCompletion();
      }
    } else {
      stats.retries++;
      this.currentStroke = [];
      this.redrawAcceptedStrokes();
      this.showFeedback('Try again', 800);
    }
  }

  showFeedback(text, duration = 1000) {
    this.feedbackText.textContent = text;
    this.feedbackOverlay.classList.add('visible');
    setTimeout(() => {
      this.feedbackOverlay.classList.remove('visible');
    }, duration);
  }

  showHint() {
    const stats = this.sessionStats.get(this.queue[this.currentIndex].id);
    stats.hints++;
    // Flash the correct stroke
    const paths = this.shadowGroup.querySelectorAll('.shadow-path');
    const target = paths[this.strokeIndex];
    if (!target) return;
    const originalStroke = target.getAttribute('stroke');
    target.setAttribute('stroke', '#059669');
    target.setAttribute('stroke-width', '5');
    setTimeout(() => {
      target.setAttribute('stroke', originalStroke || '#000');
      target.setAttribute('stroke-width', '3');
    }, 1200);
  }

  undoStroke() {
    if (this.strokeIndex > 0) {
      this.strokeIndex--;
      this.acceptedStrokes.pop();
      this.redrawAcceptedStrokes();
      this.updateHighlight();
    }
  }

  skipCard() {
    this.showRating(RATING.AGAIN);
  }

  showCompletion() {
    this.showFeedback('Great!', 600);
    const card = this.queue[this.currentIndex];
    const stats = this.sessionStats.get(card.id);
    const suggested = suggestRating(card, stats);
    this.showRating(suggested);
  }

  showRating(highlightRating) {
    this.studyControls.style.display = 'none';
    this.ratingButtons.style.display = 'flex';
    this.ratingButtons.querySelectorAll('.rating-btn').forEach(btn => {
      const r = parseInt(btn.dataset.rating, 10);
      btn.style.outline = r === highlightRating ? '2px solid var(--primary)' : 'none';
      btn.style.outlineOffset = '2px';
    });
  }

  rateCard(rating) {
    const card = this.queue[this.currentIndex];
    schedule(card, rating);

    // Persist
    const idx = this.cards.findIndex(c => c.id === card.id);
    if (idx >= 0) this.cards[idx] = card;
    else this.cards.push(card);
    Storage.saveCards(this.cards);

    this.loadCard(this.currentIndex + 1);
  }

  finishSession() {
    this.container.innerHTML = `
      <div class="empty-state">
        <h3>Session Complete!</h3>
        <p>You reviewed ${this.queue.length} cards.</p>
        <button class="btn btn-primary btn-large" id="btn-finish">Back to Dashboard</button>
      </div>
    `;
    this.container.querySelector('#btn-finish').addEventListener('click', () => {
      if (this.onComplete) this.onComplete();
    });
  }
}
