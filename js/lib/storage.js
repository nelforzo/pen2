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

  /** Progress is stored per section: { "あ": { practiced, clean, attempts } } */
  progressKey(sectionId) {
    // Keep the original key for hiragana so existing progress survives.
    return !sectionId || sectionId === 'hiragana' ? 'progress' : `progress_${sectionId}`;
  },

  async getProgress(sectionId) {
    return await this.get(this.progressKey(sectionId), {});
  },

  async saveProgress(sectionId, progress) {
    await this.set(this.progressKey(sectionId), progress);
  },

  async getSettings() {
    return await this.get('settings', {
      showRomaji: true,
      speak: true,
    });
  },

  async saveSettings(settings) {
    await this.set('settings', settings);
  },
};
