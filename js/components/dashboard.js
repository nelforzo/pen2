import { Storage } from '../lib/storage.js';
import { isPracticed, isClean } from '../lib/progress.js';

const CASE_STORAGE_KEY = 'english_case_mode';

function isUpperCase(char) {
  return char >= 'A' && char <= 'Z';
}

function isLowerCase(char) {
  return char >= 'a' && char <= 'z';
}

export class Dashboard {
  constructor(container, section, data, onPractice) {
    this.container = container;
    this.section = section;
    this.data = data;
    this.onPractice = onPractice; // (char) => void
    this.caseMode = 'upper'; // 'upper' | 'lower'
  }

  async init() {
    this.progress = await Storage.getProgress(this.section.id);
    if (this.section.id === 'english') {
      const saved = await Storage.get(CASE_STORAGE_KEY, 'upper');
      this.caseMode = saved === 'lower' ? 'lower' : 'upper';
    }
    this.refreshChars();
    this.render();
  }

  refreshChars() {
    const raw = this.section.chars.filter((c) =>
      this.data.some((d) => d.char === c)
    );
    if (this.section.id === 'english') {
      this.chars = raw.filter((c) =>
        this.caseMode === 'lower' ? isLowerCase(c) : isUpperCase(c)
      );
    } else {
      this.chars = raw;
    }
  }

  render() {
    const total = this.chars.length;
    const caseToggle = this.section.id === 'english' ? `
      <div class="case-toggle" role="group" aria-label="もじの だいしょう">
        <button class="case-btn ${this.caseMode === 'upper' ? 'active' : ''}" data-case="upper" aria-pressed="${this.caseMode === 'upper'}">大文字 ABC</button>
        <button class="case-btn ${this.caseMode === 'lower' ? 'active' : ''}" data-case="lower" aria-pressed="${this.caseMode === 'lower'}">小文字 abc</button>
      </div>
    ` : '';

    this.container.innerHTML = `
      <div class="dashboard">
        <div class="deck-actions">
          <button class="btn btn-primary btn-large" id="btn-study">はじめから れんしゅう</button>
        </div>

        <h3 class="deck-heading">ぜんぶの ${this.section.label}（${total}）</h3>
        ${caseToggle}
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
      let start = null;
      if (this.section.id === 'english' && this.caseMode === 'lower') {
        start = 'a';
      }
      if (this.onPractice) this.onPractice(start);
    });

    this.container.querySelectorAll('.card-item').forEach((el) => {
      el.addEventListener('click', () => {
        const char = el.dataset.char;
        if (this.onPractice) this.onPractice(char);
      });
    });

    if (this.section.id === 'english') {
      this.container.querySelectorAll('.case-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.caseMode = btn.dataset.case;
          Storage.set(CASE_STORAGE_KEY, this.caseMode);
          this.refreshChars();
          this.render();
        });
      });
    }

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
