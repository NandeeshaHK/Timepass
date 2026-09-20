import { Store } from '../storage/store.js';

const FONT_SIZES = [
  'var(--font-size-sm)',
  'var(--font-size-md)',
  'var(--font-size-lg)',
  'var(--font-size-xl)',
  'var(--font-size-xxl)'
];

export class SettingsManager {
  constructor() {
    this.currentFontIdx = Store.getFontSizeIndex();
    this.currentTheme = Store.getTheme();

    this.applyTheme(this.currentTheme);
    this.applyFontSize(this.currentFontIdx);

    this.initButtons();
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    Store.setTheme(theme);
    const themeIcon = document.getElementById('icon-theme');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    }
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme);
  }

  applyFontSize(idx) {
    if (idx < 0) idx = 0;
    if (idx >= FONT_SIZES.length) idx = FONT_SIZES.length - 1;
    this.currentFontIdx = idx;
    Store.setFontSizeIndex(idx);
    document.documentElement.style.setProperty('--font-size-current', FONT_SIZES[idx]);
  }

  increaseFont() {
    this.applyFontSize(this.currentFontIdx + 1);
  }

  decreaseFont() {
    this.applyFontSize(this.currentFontIdx - 1);
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
