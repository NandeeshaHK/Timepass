/**
 * Local Storage Manager for Reading Progress, UI Settings, and Session Passphrase
 */

const STORAGE_KEYS = {
  PASSPHRASE: 'tp_tea_passphrase',
  THEME: 'tp_tea_theme',
  FONT_SIZE_INDEX: 'tp_tea_font_size_idx',
  LAST_READ: 'tp_tea_last_read', // { storyId, chunkIndex, title, timestamp }
  PROGRESS_PREFIX: 'tp_tea_prog_' // + storyId -> chunkIndex
};

export const Store = {
  // Passphrase management (Stored in sessionStorage by default for security, or localStorage if user prefers)
  getPassphrase() {
    return sessionStorage.getItem(STORAGE_KEYS.PASSPHRASE) || localStorage.getItem(STORAGE_KEYS.PASSPHRASE);
  },

  setPassphrase(passphrase, rememberOnDevice = true) {
    sessionStorage.setItem(STORAGE_KEYS.PASSPHRASE, passphrase);
    if (rememberOnDevice) {
      localStorage.setItem(STORAGE_KEYS.PASSPHRASE, passphrase);
    }
  },

  clearPassphrase() {
    sessionStorage.removeItem(STORAGE_KEYS.PASSPHRASE);
    localStorage.removeItem(STORAGE_KEYS.PASSPHRASE);
  },

  // Theme management ('light' | 'dark')
  getTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved) return saved;
    // Fallback to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  // Font Size Scaling
  getFontSizeIndex() {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE_INDEX);
    return saved ? parseInt(saved, 10) : 1; // Default is index 1 (md)
  },

  setFontSizeIndex(index) {
    localStorage.setItem(STORAGE_KEYS.FONT_SIZE_INDEX, index.toString());
  },

  /**
   * Reading Progress per Story
   * @param {string} storyId
   * @returns {{ chapterIndex: number, pageIndex: number }}
   */
  getStoryProgress(storyId) {
    const saved = localStorage.getItem(STORAGE_KEYS.PROGRESS_PREFIX + storyId);
    if (!saved) return { chapterIndex: 0, pageIndex: 0 };
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'number') {
        return { chapterIndex: parsed, pageIndex: 0 };
      }
      return {
        chapterIndex: typeof parsed.chapterIndex === 'number' ? parsed.chapterIndex : 0,
        pageIndex: typeof parsed.pageIndex === 'number' ? parsed.pageIndex : 0
      };
    } catch {
      const num = parseInt(saved, 10);
      return { chapterIndex: isNaN(num) ? 0 : num, pageIndex: 0 };
    }
  },

  /**
   * @param {string} storyId
   * @param {number} chapterIndex
   * @param {number} [pageIndex=0]
   * @param {string} [storyTitle='']
   */
  setStoryProgress(storyId, chapterIndex, pageIndex = 0, storyTitle = '') {
    localStorage.setItem(STORAGE_KEYS.PROGRESS_PREFIX + storyId, JSON.stringify({ chapterIndex, pageIndex }));
    localStorage.setItem(STORAGE_KEYS.LAST_READ, JSON.stringify({
      storyId,
      chunkIndex: chapterIndex,
      chapterIndex,
      pageIndex,
      title: storyTitle,
      timestamp: Date.now()
    }));
  },

  /**
   * @returns {{ storyId: string, chunkIndex: number, chapterIndex: number, pageIndex: number, title: string, timestamp: number } | null}
   */
  getLastRead() {
    const saved = localStorage.getItem(STORAGE_KEYS.LAST_READ);
    return saved ? JSON.parse(saved) : null;
  }
};
