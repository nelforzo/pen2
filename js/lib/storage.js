/**
 * Async storage wrapper around localStorage.
 * Abstracted so IndexedDB can be swapped in later.
 */

const PREFIX = 'pen2_';

export const Storage = {
  async get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  async set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },

  async remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  /** Progress is a plain object: { "あ": { practiced, clean, attempts }, ... } */
  async getProgress() {
    return await this.get('progress', {});
  },

  async saveProgress(progress) {
    await this.set('progress', progress);
  },

  async getSettings() {
    return await this.get('settings', {
      showRomaji: true,
    });
  },

  async saveSettings(settings) {
    await this.set('settings', settings);
  },
};
