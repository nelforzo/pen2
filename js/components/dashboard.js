import { Storage } from '../lib/storage.js';
import { isPracticed, isClean } from '../lib/progress.js';
import { speak } from '../lib/speech.js';

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
    // Characters we can actually trace (have stroke data).
    this.dataChars = new Set(this.data.map((d) => d.char));
    this.refreshChars();
    this.render();
  }

  refreshChars() {
    const raw = this.section.chars;
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
    const isNumbers = this.section.id === 'numbers';
    const hint = isNumbers
      ? 'タップして練習。2桁は左から書いてね。'
      : 'タップしてその文字を練習';
    const cards = this.section.groups
      ? this.section.groups.map((g) => this.renderGroup(g)).join('')
      : `<div class="card-list">${this.chars.map((c) => this.renderCardItem(c)).join('')}</div>`;
    const caseToggle = this.section.id === 'english' ? `
      <div class="case-toggle" role="group" aria-label="文字の大小">
        <button class="case-btn ${this.caseMode === 'upper' ? 'active' : ''}" data-case="upper" aria-pressed="${this.caseMode === 'upper'}">大文字 ABC</button>
        <button class="case-btn ${this.caseMode === 'lower' ? 'active' : ''}" data-case="lower" aria-pressed="${this.caseMode === 'lower'}">小文字 abc</button>
      </div>
    ` : '';

    this.container.innerHTML = `
      <div class="dashboard">
        <div class="deck-actions">
          <button class="btn btn-accent btn-large" id="btn-study" aria-label="最初から練習">▶</button>
        </div>

        <h3 class="deck-heading">全部の ${this.section.label}（${total}）</h3>
        ${caseToggle}
        <p class="deck-hint">${hint}</p>
        ${cards}

        <div class="deck-actions" style="margin-top:1.5rem">
          <button class="btn btn-danger" id="btn-reset" aria-label="最初から">↻</button>
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
        if (!this.dataChars.has(char)) {
          // A card without stroke data can't be traced: read it aloud instead.
          const text = this.section.speechText
            ? this.section.speechText(char)
            : char;
          speak(text, { lang: this.section.speechLang });
          return;
        }
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
      if (confirm(`${this.section.label}の練習の記録を消しますか？`)) {
        await Storage.remove(Storage.progressKey(this.section.id));
        location.reload();
      }
    });
  }

  renderGroup(group) {
    return `
      <section class="deck-group">
        <div class="deck-group-head">
          <h4 class="deck-group-heading">${group.label}</h4>
        </div>
        <div class="card-list${['hiragana', 'katakana', 'numbers'].includes(this.section.id) ? ' five-grid' : ''}">
          ${group.chars.map((c) => this.renderCardItem(c)).join('')}
        </div>
      </section>
    `;
  }

  renderCardItem(char) {
    const hasStrokes = this.dataChars.has(char);
    const entry = this.progress[char];
    const done = hasStrokes && isPracticed(entry);
    const clean = hasStrokes && isClean(entry);
    let stateCls = '';
    let mark = '';
    if (clean) { stateCls = 'done-clean'; mark = '★'; }
    else if (done) { stateCls = 'done'; mark = '✓'; }
    const cls = [
      hasStrokes ? '' : 'no-strokes',
      char.length === 2 ? 'digits-2' : '',
      char.length >= 3 ? 'digits-3' : '',
      stateCls,
    ].filter(Boolean).join(' ');
    const aria = hasStrokes ? char : `${char}（読み方）`;
    return `
      <button class="card-item ${cls}" data-char="${char}" aria-label="${aria}">
        <div class="char">${char}</div>
        <span class="card-mark">${mark}</span>
      </button>
    `;
  }
}
