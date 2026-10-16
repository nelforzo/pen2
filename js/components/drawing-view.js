import { Storage } from '../lib/storage.js';

// The drawing is kept on a fixed high-resolution square canvas and only the
// CSS size changes with the screen. That keeps strokes sharp, makes export
// predictable, and means a resize/orientation change never distorts a drawing.
const CANVAS_SIZE = 1000;

const DRAWINGS_KEY = 'drawings';
const MAX_DRAWINGS = 12;

// Eight cheerful colours for young learners.
const COLORS = [
  { hex: '#1a1a1a', name: 'くろ' },
  { hex: '#e53935', name: 'あか' },
  { hex: '#fb8c00', name: 'オレンジ' },
  { hex: '#fdd835', name: 'きいろ' },
  { hex: '#43a047', name: 'みどり' },
  { hex: '#1e88e5', name: 'あお' },
  { hex: '#8e24aa', name: 'むらさき' },
  { hex: '#ec407a', name: 'ピンク' },
];

// `width` is in logical canvas units (see CANVAS_SIZE).
const TOOLS = {
  pencil: { label: 'えんぴつ', icon: '✏️', width: 8, eraser: false },
  brush: { label: 'ふで', icon: '🖌️', width: 30, eraser: false },
  eraser: { label: 'けしゴム', icon: '🧽', width: 48, eraser: true },
};

export class DrawingView {
  constructor(container, section, options = {}) {
    this.container = container;
    this.section = section;
    this.onExit = options.onExit || (() => {});

    this.tool = 'pencil';
    this.color = COLORS[0].hex;
    this.currentId = null; // id of the loaded drawing, if any

    this.isDrawing = false;
    this.lastPoint = null;
    this._activePointerId = null;
    this.drawings = [];
    this._toastTimer = null;
  }

  async init() {
    const saved = await Storage.get(DRAWINGS_KEY, []);
    this.drawings = Array.isArray(saved) ? saved : [];
    this.render();
    this.setupCanvas();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="draw-view">
        <div class="draw-toolbar" role="toolbar" aria-label="おえかきの どうぐ">
          <div class="tool-group" role="group" aria-label="ファイル">
            <button class="tool-btn" id="draw-load" aria-label="ひらく" title="ひらく">📂</button>
            <button class="tool-btn" id="draw-save" aria-label="ほぞん" title="ほぞん">💾</button>
            <button class="tool-btn" id="draw-export" aria-label="ダウンロード" title="ダウンロード">⬇️</button>
            <button class="tool-btn tool-btn-danger" id="draw-clear" aria-label="ぜんぶ けす" title="ぜんぶ けす">🗑️</button>
          </div>
          <div class="tool-sep" aria-hidden="true"></div>
          <div class="tool-group" role="group" aria-label="どうぐ">
            ${Object.entries(TOOLS).map(([key, t]) => `
              <button class="tool-btn tool-btn-tool" data-tool="${key}"
                      aria-label="${t.label}" title="${t.label}"
                      aria-pressed="${key === this.tool}">${t.icon}</button>
            `).join('')}
          </div>
          <div class="tool-sep" aria-hidden="true"></div>
          <div class="tool-group tool-colors" role="group" aria-label="いろ">
            ${COLORS.map((c) => `
              <button class="swatch ${c.hex === this.color ? 'active' : ''}"
                      data-color="${c.hex}" style="--swatch:${c.hex}"
                      aria-label="${c.name}" title="${c.name}"
                      aria-pressed="${c.hex === this.color}"></button>
            `).join('')}
          </div>
        </div>

        <div class="draw-stage" id="draw-stage">
          <canvas id="draw-canvas" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"
                  aria-label="おえかき キャンバス"></canvas>
          <div class="draw-toast" id="draw-toast" role="status" aria-live="polite"></div>
        </div>
      </div>

      <div class="draw-modal" id="draw-modal" hidden>
        <div class="draw-modal-panel" role="dialog" aria-modal="true" aria-label="ほぞんした え">
          <div class="draw-modal-head">
            <h3>ほぞんした え</h3>
            <button class="draw-modal-close" id="draw-modal-close" aria-label="とじる">✕</button>
          </div>
          <ul class="drawing-list" id="drawing-list"></ul>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#draw-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.stage = this.container.querySelector('#draw-stage');
    this.toastEl = this.container.querySelector('#draw-toast');
    this.modal = this.container.querySelector('#draw-modal');
    this.drawingList = this.container.querySelector('#drawing-list');
  }

  setupCanvas() {
    this.fillWhite();
    // Keep the CSS size a square that fits the available stage area.
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.stage);
    this.resizeCanvas();
  }

  resizeCanvas() {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const side = Math.max(120, Math.floor(Math.min(w, h)));
    this.canvas.style.width = `${side}px`;
    this.canvas.style.height = `${side}px`;
  }

  bindEvents() {
    this.container.querySelector('#draw-load').addEventListener('click', () => this.openLoad());
    this.container.querySelector('#draw-save').addEventListener('click', () => this.save());
    this.container.querySelector('#draw-export').addEventListener('click', () => this.exportImage());
    this.container.querySelector('#draw-clear').addEventListener('click', () => this.clear());
    this.container.querySelector('#draw-modal-close').addEventListener('click', () => this.closeModal());

    this.container.querySelectorAll('.tool-btn-tool').forEach((btn) => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });
    this.container.querySelectorAll('.swatch').forEach((btn) => {
      btn.addEventListener('click', () => this.setColor(btn.dataset.color));
    });

    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    const end = (e) => this.onPointerEnd(e);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
    this.drawingList.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.drawing-del');
      if (delBtn) {
        e.stopPropagation();
        this.deleteDrawing(delBtn.dataset.del);
        return;
      }
      const loadBtn = e.target.closest('.drawing-load');
      if (loadBtn) this.loadDrawing(loadBtn.dataset.id);
    });
  }

  setTool(tool) {
    if (!TOOLS[tool]) return;
    this.tool = tool;
    this.container.querySelectorAll('.tool-btn-tool').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.tool === tool));
    });
  }

  setColor(color) {
    this.color = color;
    // Picking a colour while erasing means the child wants to draw again.
    if (this.tool === 'eraser') this.setTool('pencil');
    this.container.querySelectorAll('.swatch').forEach((btn) => {
      const active = btn.dataset.color === color;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  point(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  onPointerDown(e) {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this._activePointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.isDrawing = true;
    const p = this.point(e);
    this.lastPoint = p;
    // A single tap should leave a dot.
    this.strokeSegment(p, p);
  }

  onPointerMove(e) {
    if (!this.isDrawing || e.pointerId !== this._activePointerId) return;
    e.preventDefault();
    // Coalesced events give a smoother line on high-rate styluses.
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      const p = this.point(ev);
      this.strokeSegment(this.lastPoint, p);
      this.lastPoint = p;
    }
  }

  onPointerEnd(e) {
    if (e.pointerId !== this._activePointerId) return;
    this.isDrawing = false;
    this.lastPoint = null;
    this._activePointerId = null;
  }

  strokeSegment(from, to) {
    const tool = TOOLS[this.tool];
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = tool.width;
    // The paper is white, so an eraser is simply white paint. This keeps saved
    // PNGs opaque and looking the same everywhere they are viewed.
    ctx.strokeStyle = tool.eraser ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  fillWhite() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  async save() {
    const dataUrl = this.canvas.toDataURL('image/png');
    const existing = this.drawings.find((d) => d.id === this.currentId);
    if (existing) {
      // Saving an opened drawing updates it in place.
      existing.dataUrl = dataUrl;
      existing.updatedAt = Date.now();
    } else {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `おえかき ${this.drawings.length + 1}`,
        dataUrl,
        updatedAt: Date.now(),
      };
      this.drawings.unshift(entry);
      this.currentId = entry.id;
    }
    const ok = await this.persist();
    this.toast(ok ? 'ほぞんしたよ' : 'ほぞん できなかった');
  }

  async persist() {
    // Keep the newest MAX_DRAWINGS, and if storage is full drop the oldest
    // until it fits rather than losing the save silently.
    while (this.drawings.length > MAX_DRAWINGS) this.drawings.pop();
    for (let attempt = 0; attempt < MAX_DRAWINGS; attempt++) {
      try {
        await Storage.set(DRAWINGS_KEY, this.drawings);
        return true;
      } catch {
        if (this.drawings.length <= 1) return false;
        this.drawings.pop();
        if (this.drawings.every((d) => d.id !== this.currentId)) this.currentId = null;
      }
    }
    return false;
  }

  exportImage() {
    const url = this.canvas.toDataURL('image/png');
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pen2-oekaki-${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.toast('ダウンロード したよ');
  }

  clear() {
    if (!window.confirm('ぜんぶ けしても いい？')) return;
    this.fillWhite();
    // Clearing starts a fresh picture, so a later Save creates a new entry
    // instead of overwriting the drawing that was last opened.
    this.currentId = null;
    this.toast('あたらしい キャンバス');
  }

  openLoad() {
    this.renderDrawingList();
    this.modal.hidden = false;
  }

  closeModal() {
    this.modal.hidden = true;
  }

  renderDrawingList() {
    if (!this.drawings.length) {
      this.drawingList.innerHTML = '<li class="draw-empty">まだ ほぞんした えが ないよ</li>';
      return;
    }
    this.drawingList.innerHTML = this.drawings.map((d) => `
      <li class="drawing-item">
        <button class="drawing-load" data-id="${d.id}">
          <img src="${d.dataUrl}" alt="${d.name}">
          <span>${d.name}</span>
        </button>
        <button class="drawing-del" data-del="${d.id}" aria-label="${d.name}を けす">✕</button>
      </li>
    `).join('');
  }

  loadDrawing(id) {
    const entry = this.drawings.find((d) => d.id === id);
    if (!entry) return;
    const img = new Image();
    img.onload = () => {
      this.fillWhite();
      this.ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      this.currentId = id;
      this.closeModal();
      this.toast('ひらいたよ');
    };
    img.src = entry.dataUrl;
  }

  async deleteDrawing(id) {
    const entry = this.drawings.find((d) => d.id === id);
    if (!entry) return;
    if (!window.confirm(`「${entry.name}」を けしても いい？`)) return;
    this.drawings = this.drawings.filter((d) => d.id !== id);
    if (this.currentId === id) this.currentId = null;
    await this.persist();
    this.renderDrawingList();
  }

  toast(message) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 1400);
  }

  destroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    clearTimeout(this._toastTimer);
  }
}
