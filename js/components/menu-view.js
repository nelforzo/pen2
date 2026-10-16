import { SECTIONS } from '../lib/sections.js';

/**
 * The app's root view: the penguin icon with a vertical list of wide section
 * buttons, in the same order as the hamburger menu.
 */
export class MenuView {
  constructor(container, options = {}) {
    this.container = container;
    this.onSelect = options.onSelect || (() => {});
    this.sections = options.sections || Object.values(SECTIONS);
  }

  init() {
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="menu-view">
        <img class="menu-hero" src="icons/icon-512.png" alt="pen2" width="180" height="180">
        <nav class="menu-sections" aria-label="セクション">
          ${this.sections.map((s) => `
            <button class="menu-section-btn" data-section="${s.id}">${s.menuLabel || s.label}</button>
          `).join('')}
        </nav>
      </div>
    `;

    this.container.querySelectorAll('.menu-section-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.onSelect(btn.dataset.section));
    });
  }
}
