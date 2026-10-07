import { Storage } from '../lib/storage.js';

export class SettingsView {
  constructor(container) {
    this.container = container;
  }

  async init() {
    this.settings = await Storage.getSettings();
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="settings-view">
        <h2>Settings</h2>
        <div class="setting-row">
          <div>
            <label for="show-romaji">Show Romaji</label>
            <div class="description">Display romaji reading alongside the character.</div>
          </div>
          <input type="checkbox" id="show-romaji" ${this.settings.showRomaji ? 'checked' : ''}>
        </div>
        <div class="setting-row">
          <div>
            <label>Fade-out progression</label>
            <div class="description">The scaffolding (trace &rarr; guided &rarr; recall) is tied to SRS maturity and cannot be disabled. This ensures you develop true recall.</div>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <label>Attribution</label>
            <div class="description">Stroke data from <a href="http://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>, licensed CC BY-SA 3.0.</div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#show-romaji').addEventListener('change', async (e) => {
      this.settings.showRomaji = e.target.checked;
      await Storage.saveSettings(this.settings);
    });
  }
}
