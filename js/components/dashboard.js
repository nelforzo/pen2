import { Storage } from '../lib/storage.js';
import { standardCharacters, isPracticed, isClean } from '../lib/progress.js';

export class Dashboard {
  constructor(container, data, onPractice) {
    this.container = container;
    this.data = data;
    this.onPractice = onPractice; // (char) => void
  }

  async init() {
    this.progress = await Storage.getProgress();
    this.chars = standardCharacters().filter((c) =>
      this.data.some((d) => d.char === c)
    );
    this.render();
  }

  render() {
    const total = this.chars.length;
    const practiced = this.chars.filter((c) => isPracticed(this.progress[c])).length;
    const clean = this.chars.filter((c) => isClean(this.progress[c])).length;

    this.container.innerHTML = `
      <div class="dashboard">
        <h2>ひらがな</h2>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${practiced}</div>
            <div class="stat-label">れんしゅうした</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${clean}</div>
            <div class="stat-label">かんぺき</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${total - practiced}</div>
            <div class="stat-label">のこり</div>
          </div>
        </div>

        <div class="deck-actions">
          <button class="btn btn-primary btn-large" id="btn-study">はじめから れんしゅう</button>
        </div>

        <h3 class="deck-heading">ぜんぶの ひらがな（${total}）</h3>
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
      if (confirm('れんしゅうの きろくを ぜんぶ けしますか？')) {
        await Storage.remove('progress');
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
