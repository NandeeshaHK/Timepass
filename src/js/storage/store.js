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

  // Reading Progress per Story
  getStoryProgress(storyId) {
    const saved = localStorage.getItem(STORAGE_KEYS.PROGRESS_PREFIX + storyId);
    return saved ? parseInt(saved, 10) : 0;
  },

  setStoryProgress(storyId, chunkIndex, storyTitle = '') {
    localStorage.setItem(STORAGE_KEYS.PROGRESS_PREFIX + storyId, chunkIndex.toString());
    localStorage.setItem(STORAGE_KEYS.LAST_READ, JSON.stringify({
      storyId,
      chunkIndex,
      title: storyTitle,
      timestamp: Date.now()
    }));
  },

  getLastRead() {
    const saved = localStorage.getItem(STORAGE_KEYS.LAST_READ);
    return saved ? JSON.parse(saved) : null;
  }
};
