import { Store } from '../storage/store.js';
import { HapticUX } from './haptics.js';

const FONT_SIZES = [
  'var(--font-size-sm)',
  'var(--font-size-md)',
  'var(--font-size-lg)',
  'var(--font-size-xl)',
  'var(--font-size-xxl)'
];

/**
 * Manages user UI preferences including Themes and Font Size scaling.
 */
export class SettingsManager {
  /**
   * @param {Object} [options]
   * @param {() => void} [options.onFontSizeChange] - Callback invoked when font size changes to reflow pages.
   */
  constructor(options = {}) {
    this.onFontSizeChange = options.onFontSizeChange;
    this.currentFontIdx = Store.getFontSizeIndex();
    this.currentTheme = Store.getTheme();

    this.applyTheme(this.currentTheme);
    this.applyFontSize(this.currentFontIdx, false);

    this.initButtons();
  }

  /**
   * @param {'light' | 'dark'} theme
   */
  applyTheme(theme) {
    this.currentTheme = theme;
    Store.setTheme(theme);
    const themeIcon = document.getElementById('icon-theme');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    }
  }

  toggleTheme() {
    HapticUX.fontChange();
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }

  /**
   * @param {number} idx
   * @param {boolean} [triggerCallback=true]
   */
  applyFontSize(idx, triggerCallback = true) {
    if (idx < 0) idx = 0;
    if (idx >= FONT_SIZES.length) idx = FONT_SIZES.length - 1;
    this.currentFontIdx = idx;
    Store.setFontSizeIndex(idx);
    document.documentElement.style.setProperty('--font-size-current', FONT_SIZES[idx]);
    if (triggerCallback && this.onFontSizeChange) {
      this.onFontSizeChange();
    }
  }

  increaseFont() {
    HapticUX.fontChange();
    this.applyFontSize(this.currentFontIdx + 1, true);
  }

  decreaseFont() {
    HapticUX.fontChange();
    this.applyFontSize(this.currentFontIdx - 1, true);
  }

  initButtons() {
    const btnTheme = document.getElementById('btn-toggle-theme');
    const btnThemeReader = document.getElementById('btn-reader-theme');
    const btnFontPlus = document.getElementById('btn-font-plus');
    const btnFontMinus = document.getElementById('btn-font-minus');

    if (btnTheme) btnTheme.addEventListener('click', () => this.toggleTheme());
    if (btnThemeReader) btnThemeReader.addEventListener('click', () => this.toggleTheme());
    if (btnFontPlus) btnFontPlus.addEventListener('click', () => this.increaseFont());
    if (btnFontMinus) btnFontMinus.addEventListener('click', () => this.decreaseFont());
  }
}
