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

  /** Local calendar date as YYYY-MM-DD (used for the once-a-day progress reset). */
  today() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  },

  /**
   * Clear the given progress keys once per local day. Returns true when a reset
   * happened. A date stamp is persisted so this only runs on the first load of
   * each day, giving children a fresh deck to collect stars on.
   */
  async resetProgressDaily(keys) {
    const today = this.today();
    const last = await this.get('progress_reset_date', null);
    if (last === today) return false;
    for (const key of keys) await this.remove(key);
    await this.set('progress_reset_date', today);
    return true;
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
