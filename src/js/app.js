import { decryptEncPayload, verifyAndDecryptCatalog } from './crypto/decryptor.js';
import { Store } from './storage/store.js';
import { SettingsManager } from './ui/settings.js';
import { LibraryView } from './ui/library.js';
import { Router } from './ui/router.js';
import { VirtualCarousel } from './reader/carousel.js';
import { TocDrawer } from './reader/toc.js';
import { WakeLockManager } from './reader/wakelock.js';
import { createIcons, icons } from 'lucide';

class App {
  constructor() {
    this.catalog = [];
    this.passphrase = Store.getPassphrase();
    this.currentStoryId = null;
    this.currentStoryMeta = null;
    this.currentToc = [];

    // UI Elements
    this.libraryViewEl = document.getElementById('view-library');
    this.readerViewEl = document.getElementById('view-reader');
    this.hudContainerEl = document.getElementById('hud-container');
    this.passphraseModal = document.getElementById('passphrase-modal');
    this.passphraseInput = document.getElementById('passphrase-input');
    this.passphraseSubmitBtn = document.getElementById('btn-submit-passphrase');
    this.passphraseError = document.getElementById('passphrase-error');
    this.storyTitleHeader = document.getElementById('story-header-title');
    this.pageProgressText = document.getElementById('page-progress-text');
    this.progressSlider = document.getElementById('progress-slider');

    // Sub-systems
    this.settings = new SettingsManager();
    this.library = new LibraryView({
      onSelectStory: (id, startChunk) => this.openStory(id, startChunk)
    });

    this.toc = new TocDrawer({
      onSelectChapter: (chunkIndex) => {
        this.carousel.goToPage(chunkIndex);
      }
    });

    this.router = new Router({
      onNavigateToLibrary: () => this.showLibraryView(),
      onNavigateToReader: (storyId) => this.openStory(storyId, 0, false)
    });

    this.carousel = new VirtualCarousel({
      containerEl: document.getElementById('carousel-viewport'),
      fetchAndDecryptChunk: (index) => this.fetchStoryChunk(index),
      onPageChange: (current, total) => this.onPageChange(current, total)
    });

    this.initEventListeners();
    this.bootstrap();
  }

  initEventListeners() {
    // Passphrase Submission
    this.passphraseSubmitBtn.addEventListener('click', () => this.handlePassphraseSubmit());
    this.passphraseInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handlePassphraseSubmit();
    });

    // Reader UI buttons
    document.getElementById('btn-back-to-library').addEventListener('click', () => {
      this.router.goToLibrary();
    });

    document.getElementById('btn-open-toc').addEventListener('click', () => {
      this.toc.toggle();
    });

    // Tap Zones (20% Left = Prev, 60% Center = HUD Toggle, 20% Right = Next)
    document.getElementById('tap-left').addEventListener('click', () => {
      this.carousel.prev();
    });
    document.getElementById('tap-right').addEventListener('click', () => {
      this.carousel.next();
    });
    document.getElementById('tap-center').addEventListener('click', () => {
      this.toggleHUD();
    });

    // Progress slider scrub
    this.progressSlider.addEventListener('input', (e) => {
      const targetChunk = parseInt(e.target.value, 10);
      this.carousel.goToPage(targetChunk);
    });

    // WakeLock Visibility
    WakeLockManager.initVisibilityListener(() => this.readerViewEl.classList.contains('active'));

    // Disable standard text copy & context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'p', 's', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
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
      this.passphraseModal.style.display = 'none';
    } catch (err) {
      this.passphraseError.textContent = 'Incorrect passphrase or unable to decrypt catalog.';
      this.passphraseError.style.display = 'block';
    } finally {
      this.passphraseSubmitBtn.disabled = false;
    }
  }

  async loadCatalog(passphrase) {
    const res = await fetch('catalog.json.enc');
    if (!res.ok) {
      throw new Error('Catalog file not found. Ensure stories are encrypted.');
    }
    const buffer = await res.arrayBuffer();
    this.catalog = await verifyAndDecryptCatalog(buffer, passphrase);
    this.library.render(this.catalog);
  }

  async openStory(storyId, startChunkIndex = 0, updateHistory = true) {
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

    // Initialize progress slider bounds
    this.progressSlider.max = (this.currentStoryMeta.totalChunks - 1).toString();
    this.progressSlider.value = startChunkIndex.toString();

    // Request Wake Lock
    WakeLockManager.request();

    // Load into virtual carousel
    await this.carousel.loadStory(this.currentStoryMeta.totalChunks, startChunkIndex);
  }

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

  async fetchStoryChunk(chunkIndex) {
    if (!this.currentStoryId) return '';
    try {
      const res = await fetch(`stories/${this.currentStoryId}/chunk-${chunkIndex}.enc`);
      if (!res.ok) return '';
      const buffer = await res.arrayBuffer();
      return await decryptEncPayload(buffer, this.passphrase);
    } catch (err) {
      console.error(`Failed to decrypt chunk ${chunkIndex}:`, err);
      return '<p style="color:#D32F2F;">[Error decrypting page content]</p>';
    }
  }

  onPageChange(chunkIndex, totalChunks) {
    this.pageProgressText.textContent = `Page ${chunkIndex + 1} of ${totalChunks}`;
    this.progressSlider.value = chunkIndex.toString();
    
    // Save reading progress
    Store.setStoryProgress(this.currentStoryId, chunkIndex, this.currentStoryMeta?.title || '');
    
    // Update active item in chapter drawer
    this.toc.render(this.currentToc, chunkIndex);
  }

  showLibraryView() {
    this.readerViewEl.classList.remove('active');
    this.libraryViewEl.classList.add('active');
    this.carousel.clear();
    this.currentStoryId = null;
    this.currentStoryMeta = null;
    WakeLockManager.release();
    this.library.render(this.catalog);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
