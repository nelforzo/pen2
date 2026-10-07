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

  async getCards() {
    return await this.get('cards', []);
  },

  async saveCards(cards) {
    await this.set('cards', cards);
  },

  async getSettings() {
    return await this.get('settings', {
      showRomaji: true,
      strictness: 'normal',
    });
  },

  async saveSettings(settings) {
    await this.set('settings', settings);
  },
};
