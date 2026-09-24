import { decryptEncPayload, verifyAndDecryptCatalog } from './crypto/decryptor.js';
import { Store } from './storage/store.js';
import { SettingsManager } from './ui/settings.js';
import { LibraryView } from './ui/library.js';
import { Router } from './ui/router.js';
import { VirtualCarousel } from './reader/carousel.js';
import { TocDrawer } from './reader/toc.js';
import { WakeLockManager } from './reader/wakelock.js';
import { FullscreenManager } from './ui/fullscreen.js';
import { HapticUX } from './ui/haptics.js';
import { createIcons, icons } from 'lucide';

/**
 * Main Application Controller for Timepass Tea
 */
class App {
  constructor() {
    /** @type {Array<{ id: string, title: string, author: string, synopsis: string, totalChunks: number, estimatedMinutes: number }>} */
    this.catalog = [];
    this.passphrase = Store.getPassphrase();
    /** @type {string | null} */
    this.currentStoryId = null;
    /** @type {Object | null} */
    this.currentStoryMeta = null;
    /** @type {Array<{ title: string, level: number, chunkIndex: number }>} */
    this.currentToc = [];

    // UI Elements
    this.libraryViewEl = /** @type {HTMLElement} */ (document.getElementById('view-library'));
    this.readerViewEl = /** @type {HTMLElement} */ (document.getElementById('view-reader'));
    this.hudContainerEl = /** @type {HTMLElement} */ (document.getElementById('hud-container'));
    this.passphraseModal = /** @type {HTMLElement} */ (document.getElementById('passphrase-modal'));
    this.passphraseInput = /** @type {HTMLInputElement} */ (document.getElementById('passphrase-input'));
    this.passphraseSubmitBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-submit-passphrase'));
    this.passphraseError = /** @type {HTMLElement} */ (document.getElementById('passphrase-error'));
    this.storyTitleHeader = /** @type {HTMLElement} */ (document.getElementById('story-header-title'));
    this.pageProgressText = /** @type {HTMLElement} */ (document.getElementById('page-progress-text'));
    this.progressSlider = /** @type {HTMLInputElement} */ (document.getElementById('progress-slider'));

    // Sub-systems
    this.fullscreen = new FullscreenManager({
      onChange: (active) => this.handleFullscreenChange(active)
    });

    this.settings = new SettingsManager({
      onFontSizeChange: (label) => {
        if (this.carousel) {
          this.carousel.recalculatePages(false);
          this.carousel.showToast(`Text Size: ${label}`);
        }
      }
    });

    this.library = new LibraryView({
      onSelectStory: (id, chapterIdx, pageIdx) => this.openStory(id, chapterIdx, pageIdx)
    });

    this.toc = new TocDrawer({
      onSelectChapter: (chapterIndex) => {
        this.carousel.goToChapter(chapterIndex, 0);
      }
    });

    this.router = new Router({
      onNavigateToLibrary: () => this.showLibraryView(),
      onNavigateToReader: (storyId) => this.openStory(storyId, 0, 0, false),
      shouldInterceptBack: () => {
        if (this.toc && this.toc.isOpen) {
          this.toc.close();
          return true;
        }
        return false;
      }
    });

    this.carousel = new VirtualCarousel({
      viewportEl: /** @type {HTMLElement} */ (document.getElementById('reader-viewport')),
      trackEl: /** @type {HTMLElement} */ (document.getElementById('reader-track')),
      measurerEl: /** @type {HTMLElement} */ (document.getElementById('reader-measurer')),
      toastEl: /** @type {HTMLElement} */ (document.getElementById('reader-toast')),
      fetchAndDecryptChunk: (index) => this.fetchStoryChunk(index),
      onPageChange: (chapterIdx, totalChapters, pageIdx, totalPages) =>
        this.onPageChange(chapterIdx, totalChapters, pageIdx, totalPages),
      onToggleHUD: () => this.toggleHUD()
    });

    this.initEventListeners();
    this.bootstrap();
  }

  /**
   * Initializes top-level UI event listeners.
   */
  initEventListeners() {
    // Passphrase submission
    this.passphraseSubmitBtn.addEventListener('click', () => this.handlePassphraseSubmit());
    this.passphraseInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handlePassphraseSubmit();
    });

    // Reader UI buttons: Exit to Library
    const btnBack = document.getElementById('btn-back-to-library');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        HapticUX.backTrigger();
        this.router.goToLibrary();
      });
    }

    // Toggle Chapters Drawer
    const btnOpenToc = document.getElementById('btn-open-toc');
    if (btnOpenToc) {
      btnOpenToc.addEventListener('click', () => this.toc.toggle());
    }

    // Fullscreen Toggle Button
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        HapticUX.buttonTap();
        this.fullscreen.toggle();
      });
    }

    // Progress slider scrub with debouncing so rapid dragging doesn't flood rendering
    let sliderDebounceTimer = null;
    this.progressSlider.addEventListener('input', (e) => {
      HapticUX.sliderTick();
      const targetInput = /** @type {HTMLInputElement} */ (e.target);
      const targetChapter = parseInt(targetInput.value, 10);
      this.pageProgressText.textContent = `Chapter ${targetChapter + 1} of ${this.currentStoryMeta?.totalChunks || 1}`;
      clearTimeout(sliderDebounceTimer);
      sliderDebounceTimer = setTimeout(() => {
        this.carousel.goToChapter(targetChapter, 0);
      }, 60);
    });

    // WakeLock Visibility listener
    WakeLockManager.initVisibilityListener(() => this.readerViewEl.classList.contains('active'));

    // Disable standard text copy & context menu to preserve serene distraction-free reading
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Global Keyboard shortcuts & exit mechanisms
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.toc && this.toc.isOpen) {
          this.toc.close();
        } else if (this.hudContainerEl.classList.contains('hud-visible')) {
          this.hideHUD();
        } else if (this.readerViewEl.classList.contains('active')) {
          HapticUX.backTrigger();
          this.router.goToLibrary();
        }
      }

      if ((e.ctrlKey || e.metaKey) && ['c', 'p', 's', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
  }

  /**
   * Handles fullscreen state change to update HUD icons and reflow reader.
   * @param {boolean} active
   */
  handleFullscreenChange(active) {
    const iconEl = document.getElementById('icon-fullscreen');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', active ? 'minimize' : 'maximize');
      createIcons({ icons });
    }
    if (this.carousel) {
      this.carousel.showToast(active ? 'Fullscreen Mode' : 'Standard View');
      this.carousel.recalculatePages(false);
    }
  }

  toggleHUD() {
    this.hudContainerEl.classList.toggle('hud-visible');
  }

  hideHUD() {
    this.hudContainerEl.classList.remove('hud-visible');
  }

  async bootstrap() {
    createIcons({ icons });

    if (!this.passphrase) {
      this.showPassphraseModal();
    } else {
      await this.loadCatalog(this.passphrase);
    }
  }

  showPassphraseModal() {
    this.passphraseModal.style.display = 'flex';
    this.passphraseInput.focus();
  }

  async handlePassphraseSubmit() {
    const inputPass = this.passphraseInput.value.trim();
    if (!inputPass) return;

    this.passphraseError.style.display = 'none';
    this.passphraseSubmitBtn.disabled = true;

    try {
      await this.loadCatalog(inputPass);
      this.passphrase = inputPass;
      Store.setPassphrase(inputPass, true);
      HapticUX.selected();
      this.passphraseModal.style.display = 'none';
    } catch (err) {
      HapticUX.pageEnd();
      this.passphraseError.textContent = 'Incorrect passphrase or unable to decrypt catalog.';
      this.passphraseError.style.display = 'block';
    } finally {
      this.passphraseSubmitBtn.disabled = false;
    }
  }

  /**
   * Fetches and decrypts story catalog.
   * @param {string} passphrase
   */
  async loadCatalog(passphrase) {
    const res = await fetch('catalog.json.enc');
    if (!res.ok) {
      throw new Error('Catalog file not found. Ensure stories are encrypted.');
    }
    const buffer = await res.arrayBuffer();
    this.catalog = await verifyAndDecryptCatalog(buffer, passphrase);
    this.library.render(this.catalog);
  }

  /**
   * Opens story at specified chapter and page.
   * @param {string} storyId
   * @param {number} [startChapterIndex=0]
   * @param {number} [startPageIndex=0]
   * @param {boolean} [updateHistory=true]
   */
  async openStory(storyId, startChapterIndex = 0, startPageIndex = 0, updateHistory = true) {
    this.currentStoryId = storyId;
    this.currentStoryMeta = this.catalog.find(s => s.id === storyId);

    if (!this.currentStoryMeta) {
      console.error('Story not found in catalog:', storyId);
      return;
    }

    if (updateHistory) {
      this.router.goToReader(storyId);
    }

    this.storyTitleHeader.textContent = this.currentStoryMeta.title;
    this.libraryViewEl.classList.remove('active');
    this.readerViewEl.classList.add('active');
    this.hideHUD();

    // Fetch and decrypt Table of Contents
    await this.fetchToc(storyId);

    // Initialize progress slider bounds for chapters
    this.progressSlider.max = Math.max(0, this.currentStoryMeta.totalChunks - 1).toString();
    this.progressSlider.value = startChapterIndex.toString();

    // Request Wake Lock & enter Fullscreen mode
    WakeLockManager.request();
    this.fullscreen.enter();

    // Load into dynamic single-page carousel reader
    await this.carousel.loadStory(this.currentStoryMeta.totalChunks, startChapterIndex, startPageIndex);
  }

  /**
   * Fetches and decrypts Table of Contents for the story.
   * @param {string} storyId
   */
  async fetchToc(storyId) {
    try {
      const res = await fetch(`stories/${storyId}/toc.json.enc`);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const json = await decryptEncPayload(buffer, this.passphrase);
        this.currentToc = JSON.parse(json);
      } else {
        this.currentToc = [];
      }
    } catch (err) {
      console.warn('Failed to load ToC:', err);
      this.currentToc = [];
    }
    this.toc.render(this.currentToc, 0);
  }

  /**
   * Fetches and decrypts a specific chapter chunk.
   * @param {number} chapterIndex
   * @returns {Promise<string>}
   */
  async fetchStoryChunk(chapterIndex) {
    if (!this.currentStoryId) return '';
    try {
      const res = await fetch(`stories/${this.currentStoryId}/chunk-${chapterIndex}.enc`);
      if (!res.ok) return '';
      const buffer = await res.arrayBuffer();
      return await decryptEncPayload(buffer, this.passphrase);
    } catch (err) {
      console.error(`Failed to decrypt chapter ${chapterIndex}:`, err);
      return '<p style="color:#D32F2F;">[Error decrypting page content]</p>';
    }
  }

  /**
   * Handles progress update from reader engine.
   * @param {number} chapterIndex
   * @param {number} totalChapters
   * @param {number} pageIndex
   * @param {number} totalPages
   */
  onPageChange(chapterIndex, totalChapters, pageIndex, totalPages) {
    this.pageProgressText.textContent = `Ch. ${chapterIndex + 1}/${totalChapters} · Page ${pageIndex + 1}/${totalPages}`;
    this.progressSlider.value = chapterIndex.toString();

    // Save reading progress to localStorage
    if (this.currentStoryId) {
      Store.setStoryProgress(
        this.currentStoryId,
        chapterIndex,
        pageIndex,
        this.currentStoryMeta?.title || ''
      );
    }

    // Update active item in chapter drawer
    this.toc.render(this.currentToc, chapterIndex);
  }

  /**
   * Clean exit mechanism back to Library view.
   */
  showLibraryView() {
    this.readerViewEl.classList.remove('active');
    this.libraryViewEl.classList.add('active');
    this.carousel.clear();
    this.currentStoryId = null;
    this.currentStoryMeta = null;
    WakeLockManager.release();
    this.fullscreen.exit();
    this.toc.close();
    this.hideHUD();
    this.library.render(this.catalog);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
