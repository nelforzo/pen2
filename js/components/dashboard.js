import { Storage } from '../lib/storage.js';
import { isDue, STATE } from '../lib/srs.js';

export class Dashboard {
  constructor(container, data, onStudy) {
    this.container = container;
    this.data = data;
    this.onStudy = onStudy;
  }

  async init() {
    this.cards = await Storage.getCards();
    if (!this.cards.length) {
      this.cards = this.data.map(d => ({
        id: d.char,
        state: STATE.NEW,
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
      await Storage.saveCards(this.cards);
    }
    this.render();
  }

  render() {
    const total = this.cards.length;
    const newCount = this.cards.filter(c => c.state === STATE.NEW).length;
    const dueCount = this.cards.filter(c => c.state !== STATE.NEW && isDue(c)).length;
    const learningCount = this.cards.filter(c => c.state === STATE.LEARNING || c.state === STATE.RELEARNING).length;
    const reviewCount = this.cards.filter(c => c.state === STATE.REVIEW).length;
    const matureCount = this.cards.filter(c => c.state === STATE.REVIEW && c.interval >= 21).length;

    this.container.innerHTML = `
      <div class="dashboard">
        <h2>Hiragana Deck</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${dueCount + Math.min(newCount, 10)}</div>
            <div class="stat-label">Due Now</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${newCount}</div>
            <div class="stat-label">New</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${learningCount}</div>
            <div class="stat-label">Learning</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${matureCount}</div>
            <div class="stat-label">Mature</div>
          </div>
        </div>
        <div class="deck-actions">
          <button class="btn btn-primary btn-large" id="btn-study">Start Study Session</button>
          <button class="btn btn-secondary" id="btn-reset">Reset Progress</button>
        </div>
        <h3 style="margin-bottom:0.75rem">All Characters (${total})</h3>
        <div class="card-list">
          ${this.cards.map(card => this.renderCardItem(card)).join('')}
        </div>
      </div>
    `;

    this.container.querySelector('#btn-study').addEventListener('click', () => {
      if (this.onStudy) this.onStudy();
    });

    this.container.querySelector('#btn-reset').addEventListener('click', async () => {
      if (confirm('Reset all progress? This cannot be undone.')) {
        await Storage.remove('cards');
        location.reload();
      }
    });
  }

  renderCardItem(card) {
    let statusClass = 'status-new';
    let statusLabel = 'New';
    if (card.state === STATE.LEARNING) { statusClass = 'status-learning'; statusLabel = 'Learning'; }
    else if (card.state === STATE.RELEARNING) { statusClass = 'status-relearning'; statusLabel = 'Relearn'; }
    else if (card.state === STATE.REVIEW) {
      if (card.interval >= 21) { statusClass = 'status-mature'; statusLabel = 'Mature'; }
      else { statusClass = 'status-review'; statusLabel = 'Review'; }
    }
    return `
      <div class="card-item" title="${statusLabel} — interval: ${card.interval}d">
        <div class="char">${card.id}</div>
        <span class="status ${statusClass}">${statusLabel}</span>
      </div>
    `;
  }
}
