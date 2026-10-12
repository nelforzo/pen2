import { Storage } from '../lib/storage.js';
import { isPracticed, isClean } from '../lib/progress.js';

export class Dashboard {
  constructor(container, section, data, onPractice) {
    this.container = container;
    this.section = section;
    this.data = data;
    this.onPractice = onPractice; // (char) => void
  }

  async init() {
    this.progress = await Storage.getProgress(this.section.id);
    this.chars = this.section.chars.filter((c) =>
      this.data.some((d) => d.char === c)
    );
    this.render();
  }

  render() {
    const total = this.chars.length;

    this.container.innerHTML = `
      <div class="dashboard">
        <div class="deck-actions">
          <button class="btn btn-primary btn-large" id="btn-study">はじめから れんしゅう</button>
        </div>

        <h3 class="deck-heading">ぜんぶの ${this.section.label}（${total}）</h3>
        <p class="deck-hint">タップして その もじを れんしゅう</p>
        <div class="card-list">
          ${this.chars.map((c) => this.renderCardItem(c)).join('')}
        </div>

        <div class="deck-actions" style="margin-top:1.5rem">
          <button class="btn btn-secondary" id="btn-reset">さいしょから</button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-study').addEventListener('click', () => {
      if (this.onPractice) this.onPractice(null);
    });

    this.container.querySelectorAll('.card-item').forEach((el) => {
      el.addEventListener('click', () => {
        const char = el.dataset.char;
        if (this.onPractice) this.onPractice(char);
      });
    });

    this.container.querySelector('#btn-reset').addEventListener('click', async () => {
      if (confirm(`${this.section.label}の れんしゅうの きろくを けしますか？`)) {
        await Storage.remove(Storage.progressKey(this.section.id));
        location.reload();
      }
    });
  }

  renderCardItem(char) {
    const entry = this.progress[char];
    const done = isPracticed(entry);
    const clean = isClean(entry);
    let cls = '';
    let mark = '';
    if (clean) { cls = 'done-clean'; mark = '★'; }
    else if (done) { cls = 'done'; mark = '✓'; }
    return `
      <button class="card-item ${cls}" data-char="${char}" aria-label="${char}">
        <div class="char">${char}</div>
        <span class="card-mark">${mark}</span>
      </button>
    `;
  }
}
