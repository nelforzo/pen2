// Eight cheerful colours for young learners.
const COLORS = [
  { hex: '#1a1a1a', name: '黒' },
  { hex: '#e53935', name: '赤' },
  { hex: '#fb8c00', name: 'オレンジ' },
  { hex: '#fdd835', name: '黄色' },
  { hex: '#43a047', name: '緑' },
  { hex: '#1e88e5', name: '青' },
  { hex: '#8e24aa', name: '紫' },
  { hex: '#ec407a', name: 'ピンク' },
];

// Stroke widths are fractions of the canvas width, so they scale with the
// (dynamic) canvas size and stay consistent when the drawing is replayed.
const TOOLS = {
  pencil: { label: '鉛筆', icon: '✏️', width: 0.008, eraser: false },
  brush: { label: '筆', icon: '🖌️', width: 0.03, eraser: false },
  eraser: { label: '消しゴム', icon: '🧽', width: 0.05, eraser: true },
};

export class DrawingView {
  constructor(container, section) {
    this.container = container;
    this.section = section;

    this.tool = 'pencil';
    this.color = COLORS[0].hex;

    // The canvas fills the available area, so its shape can change (resize /
    // rotation). Strokes are kept as normalized vectors and replayed whenever
    // the canvas is resized, which keeps the artwork intact and undistorted.
    this.strokes = [];
    this.currentStroke = null;

    this.cssW = 0;
    this.cssH = 0;
    this.dpr = 1;

    this.isDrawing = false;
    this._activePointerId = null;
    this._toastTimer = null;
  }

  init() {
    // Let the draw view stretch to fill the space below the header.
    this.container.classList.add('main-content--draw');
    this.render();
    this.setupCanvas();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="draw-view">
        <div class="draw-toolbar" role="toolbar" aria-label="おえかきの道具">
          <div class="tool-group" role="group" aria-label="ファイル">
            <button class="tool-btn" id="draw-export" aria-label="ダウンロード" title="ダウンロード">⬇️</button>
            <button class="tool-btn tool-btn-danger" id="draw-clear" aria-label="全部消す" title="全部消す">🗑️</button>
          </div>
          <div class="tool-sep" aria-hidden="true"></div>
          <div class="tool-group" role="group" aria-label="道具">
            ${Object.entries(TOOLS).map(([key, t]) => `
              <button class="tool-btn tool-btn-tool" data-tool="${key}"
                      aria-label="${t.label}" title="${t.label}"
                      aria-pressed="${key === this.tool}">${t.icon}</button>
            `).join('')}
          </div>
          <div class="tool-sep" aria-hidden="true"></div>
          <div class="tool-group tool-colors" role="group" aria-label="色">
            ${COLORS.map((c) => `
              <button class="swatch ${c.hex === this.color ? 'active' : ''}"
                      data-color="${c.hex}" style="--swatch:${c.hex}"
                      aria-label="${c.name}" title="${c.name}"
                      aria-pressed="${c.hex === this.color}"></button>
            `).join('')}
          </div>
        </div>

        <div class="draw-stage" id="draw-stage">
          <canvas id="draw-canvas" aria-label="おえかきキャンバス"></canvas>
          <div class="draw-toast" id="draw-toast" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#draw-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.stage = this.container.querySelector('#draw-stage');
    this.toastEl = this.container.querySelector('#draw-toast');
  }

  setupCanvas() {
    // The CSS makes the canvas fill the stage; here we only sync the backing
    // store (resolution) and replay the artwork whenever the size changes.
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.stage);
    this.resizeCanvas();
  }

  resizeCanvas() {
    const w = Math.round(this.stage.clientWidth);
    const h = Math.round(this.stage.clientHeight);
    if (w < 20 || h < 20) return;
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.redraw();
  }

  redraw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    for (const stroke of this.strokes) this.drawStroke(stroke);
  }

  drawStroke(stroke) {
    const pts = stroke.points;
    if (!pts.length) return;
    if (pts.length === 1) {
      this.drawSegment(pts[0], pts[0], stroke);
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      this.drawSegment(pts[i - 1], pts[i], stroke);
    }
  }

  drawSegment(from, to, stroke) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, stroke.width * this.cssW);
    // The paper is white, so an eraser is simply white paint. This keeps
    // exported PNGs opaque and looking the same everywhere they are viewed.
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
    ctx.beginPath();
    ctx.moveTo(from.x * this.cssW, from.y * this.cssH);
    ctx.lineTo(to.x * this.cssW, to.y * this.cssH);
    ctx.stroke();
  }

  bindEvents() {
    this.container.querySelector('#draw-export').addEventListener('click', () => this.exportImage());
    this.container.querySelector('#draw-clear').addEventListener('click', () => this.clear());

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

  // Returns a normalized point in [0,1] relative to the canvas.
  point(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
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
    const stroke = {
      tool: this.tool,
      color: this.color,
      width: TOOLS[this.tool].width,
      points: [p],
    };
    this.strokes.push(stroke);
    this.currentStroke = stroke;
    // A single tap should leave a dot.
    this.drawSegment(p, p, stroke);
  }

  onPointerMove(e) {
    if (!this.isDrawing || e.pointerId !== this._activePointerId) return;
    e.preventDefault();
    // Coalesced events give a smoother line on high-rate styluses.
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events) {
      const p = this.point(ev);
      const pts = this.currentStroke.points;
      const prev = pts[pts.length - 1];
      pts.push(p);
      this.drawSegment(prev, p, this.currentStroke);
    }
  }

  onPointerEnd(e) {
    if (e.pointerId !== this._activePointerId) return;
    this.isDrawing = false;
    this.currentStroke = null;
    this._activePointerId = null;
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
    this.toast('ダウンロードしたよ');
  }

  clear() {
    if (!window.confirm('全部消してもいい？')) return;
    this.strokes = [];
    this.redraw();
    this.toast('新しいキャンバス');
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
    this.container.classList.remove('main-content--draw');
    if (this.resizeObserver) this.resizeObserver.disconnect();
    clearTimeout(this._toastTimer);
  }
}
