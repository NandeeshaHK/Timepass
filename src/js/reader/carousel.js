import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Dynamic Multi-Column E-Reader Engine with Touch Gestures,
 * Instant Column Pagination (Zero Line Cut-off), Pre-fetching, and Seamless Chapter Transitions.
 */
export class VirtualCarousel {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.viewportEl - Viewport container element.
   * @param {HTMLElement} options.frameEl - Sized reading frame that clips non-active columns.
   * @param {HTMLElement} options.contentEl - Inner content element where multi-column CSS flow is applied.
   * @param {HTMLElement} [options.toastEl] - Toast element for boundary notices.
   * @param {(chapterIndex: number) => Promise<string>} options.fetchAndDecryptChunk - Chunk decryptor.
   * @param {(chapterIndex: number, totalChapters: number, pageIndex: number, totalPages: number) => void} options.onPageChange - Progress callback.
   * @param {() => void} [options.onToggleHUD] - HUD visibility toggle callback.
   */
  constructor({
    viewportEl,
    frameEl,
    contentEl,
    toastEl,
    fetchAndDecryptChunk,
    onPageChange,
    onToggleHUD
  }) {
    this.viewportEl = viewportEl;
    this.frameEl = frameEl;
    this.contentEl = contentEl;
    this.toastEl = toastEl || document.getElementById('reader-toast');
    this.fetchAndDecryptChunk = fetchAndDecryptChunk;
    this.onPageChange = onPageChange;
    this.onToggleHUD = onToggleHUD;

    this.currentChapterIndex = 0;
    this.totalChapters = 1;
    this.currentPageIndex = 0;
    this.totalPages = 1;
    this.pageWidth = 0;
    this.pageGap = 32;

    this.chapterRequestId = 0;
    this.isLoadingChapter = false;
    /** @type {Map<number, string>} */
    this.chapterCache = new Map();
    this.toastTimer = null;

    this.initGestureEvents();
    this.initResizeObserver();
  }

  /**
   * Initializes touch gesture, mouse click, and keyboard listeners.
   */
  initGestureEvents() {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let startTime = 0;
    let isTouching = false;

    // 1. Touch Gesture Handling on Viewport
    this.viewportEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      // Do not intercept if touch originated from HUD controls or open drawer
      if (e.target.closest('#hud-container.hud-visible') || e.target.closest('#toc-drawer.open')) {
        return;
      }
      isTouching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      currentY = startY;
      startTime = Date.now();
    }, { passive: true });

    this.viewportEl.addEventListener('touchmove', (e) => {
      if (!isTouching || e.touches.length !== 1) return;
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    }, { passive: true });

    this.viewportEl.addEventListener('touchend', (e) => {
      if (!isTouching) return;
      isTouching = false;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const distance = Math.hypot(deltaX, deltaY);
      const elapsed = Date.now() - startTime;

      // Check for horizontal swipe gesture (min 35px horizontal, predominantly horizontal, < 600ms)
      if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && elapsed < 600) {
        if (deltaX < 0) {
          // Swiped Left -> Next page
          this.nextPage();
        } else {
          // Swiped Right -> Previous page
          this.prevPage();
        }
        return;
      }

      // Check for clean Tap gesture (minimal finger movement < 15px, quick tap < 350ms)
      if (distance < 15 && elapsed < 350) {
        const screenWidth = window.innerWidth;
        const tapX = startX;

        if (tapX < screenWidth * 0.22) {
          // Left 22% -> Previous page
          this.prevPage();
        } else if (tapX > screenWidth * 0.78) {
          // Right 22% -> Next page
          this.nextPage();
        } else {
          // Center 56% -> Toggle HUD
          if (this.onToggleHUD) this.onToggleHUD();
        }
      }
    }, { passive: true });

    // 2. Desktop Mouse Click Fallback
    this.viewportEl.addEventListener('click', (e) => {
      if (e.target.closest('#hud-container.hud-visible') || e.target.closest('#toc-drawer.open')) {
        return;
      }
      // Suppress click immediately following touch end
      if (Date.now() - startTime < 450) return;

      const screenWidth = window.innerWidth;
      const clickX = e.clientX;

      if (clickX < screenWidth * 0.22) {
        this.prevPage();
      } else if (clickX > screenWidth * 0.78) {
        this.nextPage();
      } else {
        if (this.onToggleHUD) this.onToggleHUD();
      }
    });

    // 3. Desktop Keyboard Navigation
    window.addEventListener('keydown', (e) => {
      const readerView = document.getElementById('view-reader');
      if (!readerView || !readerView.classList.contains('active')) return;

      if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        this.nextPage();
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        this.prevPage();
      }
    });
  }

  /**
   * Monitors container resize (e.g. orientation change or font resize) to reflow columns cleanly.
   */
  initResizeObserver() {
    let resizeTimer = null;
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.recalculatePages(false);
        }, 60);
      });
      ro.observe(this.frameEl);
    } else {
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.recalculatePages(false);
        }, 60);
      });
    }
  }

  /**
   * Loads story metadata and initializes at specified chapter and page.
   * @param {number} totalChapters
   * @param {number} [initialChapterIndex=0]
   * @param {number} [initialPageIndex=0]
   */
  async loadStory(totalChapters, initialChapterIndex = 0, initialPageIndex = 0) {
    this.totalChapters = totalChapters;
    this.chapterCache.clear();
    await this.goToChapter(initialChapterIndex, initialPageIndex, null, true);
  }

  /**
   * Loads and displays a chapter, calculating its multi-column layout.
   * @param {number} chapterIndex
   * @param {number | 'last'} [targetPage=0] - Page index or 'last' for chapter reverse navigation.
   * @param {'slide-left' | 'slide-right' | null} [transitionDirection=null]
   * @param {boolean} [force=false]
   */
  async goToChapter(chapterIndex, targetPage = 0, transitionDirection = null, force = false) {
    if (chapterIndex < 0 || chapterIndex >= this.totalChapters) return;
    if (chapterIndex === this.currentChapterIndex && !force && targetPage !== 'last') return;

    const currentRequestId = ++this.chapterRequestId;
    this.isLoadingChapter = true;
    this.currentChapterIndex = chapterIndex;

    // Apply immediate chapter exit transition if requested
    if (transitionDirection) {
      this.contentEl.style.transition = 'transform 0.18s ease-in, opacity 0.18s ease-in';
      this.contentEl.style.opacity = '0';
      this.contentEl.style.transform = transitionDirection === 'slide-left'
        ? `translateX(-${this.pageWidth + this.pageGap}px)`
        : `translateX(${this.pageWidth + this.pageGap}px)`;
      await new Promise(r => setTimeout(r, 160));
    }

    // Retrieve markdown from cache or fetch & decrypt
    let markdown = this.chapterCache.get(chapterIndex);
    if (!markdown) {
      try {
        markdown = await this.fetchAndDecryptChunk(chapterIndex);
        this.chapterCache.set(chapterIndex, markdown);
      } catch (err) {
        markdown = '### [Error Loading Chapter]\nPlease check your connection or passphrase.';
      }
    }

    // If newer request occurred while awaiting decryption, discard stale result
    if (currentRequestId !== this.chapterRequestId) return;

    // Render markdown cleanly into content element
    this.contentEl.innerHTML = DOMPurify.sanitize(marked.parse(markdown || ''));

    // Reset styles for layout calculation
    this.contentEl.style.transition = 'none';
    this.contentEl.style.opacity = '1';
    this.contentEl.style.transform = 'none';

    // Calculate dynamic multi-column pages based on current font size & viewport dimensions
    this.recalculatePages(false);

    // Determine target page within chapter
    if (targetPage === 'last') {
      this.currentPageIndex = Math.max(0, this.totalPages - 1);
    } else if (typeof targetPage === 'number') {
      this.currentPageIndex = Math.min(Math.max(0, targetPage), this.totalPages - 1);
    }

    this.updateTransform(false);
    this.isLoadingChapter = false;
    this.notifyProgress();

    // Pre-fetch adjacent chapters in background for instant transitions
    this.prefetchAdjacentChapters(chapterIndex);
  }

  /**
   * Recalculates columns and total pages dynamically without losing text or clipping lines.
   * @param {boolean} [animated=false]
   */
  recalculatePages(animated = false) {
    const frameWidth = this.frameEl.clientWidth;
    if (frameWidth <= 0) return;

    this.pageWidth = frameWidth;
    this.pageGap = 32;

    this.contentEl.style.columnWidth = `${this.pageWidth}px`;
    this.contentEl.style.columnGap = `${this.pageGap}px`;

    // Measure horizontal scroll width to compute exact number of columns
    const scrollWidth = this.contentEl.scrollWidth;
    const step = this.pageWidth + this.pageGap;
    this.totalPages = Math.max(1, Math.round((scrollWidth + this.pageGap) / step));

    // Clamp current page index if font size or window resized
    if (this.currentPageIndex >= this.totalPages) {
      this.currentPageIndex = this.totalPages - 1;
    }

    this.updateTransform(animated);
    this.notifyProgress();
  }

  /**
   * Applies CSS transform to slide to current page column.
   * @param {boolean} [animated=true]
   */
  updateTransform(animated = true) {
    this.contentEl.style.transition = animated
      ? 'transform 0.22s cubic-bezier(0.2, 0.9, 0.4, 1)'
      : 'none';
    const offset = this.currentPageIndex * (this.pageWidth + this.pageGap);
    this.contentEl.style.transform = `translateX(-${offset}px)`;
  }

  /**
   * Advances to next page within chapter, or advances to next chapter.
   */
  async nextPage() {
    if (this.isLoadingChapter) return;

    // 1. More pages in current chapter -> slide to next column
    if (this.currentPageIndex < this.totalPages - 1) {
      this.currentPageIndex++;
      this.updateTransform(true);
      this.notifyProgress();
      return;
    }

    // 2. At last page of current chapter -> advance to next chapter
    if (this.currentChapterIndex < this.totalChapters - 1) {
      await this.goToChapter(this.currentChapterIndex + 1, 0, 'slide-left');
    } else {
      this.showToast('— End of Story —');
    }
  }

  /**
   * Moves to previous page within chapter, or moves to previous chapter's last page.
   */
  async prevPage() {
    if (this.isLoadingChapter) return;

    // 1. Prior pages in current chapter -> slide to prev column
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.updateTransform(true);
      this.notifyProgress();
      return;
    }

    // 2. At first page of current chapter -> move to previous chapter's last page
    if (this.currentChapterIndex > 0) {
      await this.goToChapter(this.currentChapterIndex - 1, 'last', 'slide-right');
    } else {
      this.showToast('— Beginning of Story —');
    }
  }

  /**
   * Pre-fetches and decrypts next and previous chapters in background memory cache.
   * @param {number} chapterIndex
   */
  prefetchAdjacentChapters(chapterIndex) {
    if (chapterIndex + 1 < this.totalChapters && !this.chapterCache.has(chapterIndex + 1)) {
      this.fetchAndDecryptChunk(chapterIndex + 1).then(md => {
        this.chapterCache.set(chapterIndex + 1, md);
      }).catch(() => {});
    }

    if (chapterIndex - 1 >= 0 && !this.chapterCache.has(chapterIndex - 1)) {
      this.fetchAndDecryptChunk(chapterIndex - 1).then(md => {
        this.chapterCache.set(chapterIndex - 1, md);
      }).catch(() => {});
    }
  }

  /**
   * Emits progress update callback.
   */
  notifyProgress() {
    if (this.onPageChange) {
      this.onPageChange(
        this.currentChapterIndex,
        this.totalChapters,
        this.currentPageIndex,
        this.totalPages
      );
    }
  }

  /**
   * Displays an ephemeral status pill toast.
   * @param {string} message
   */
  showToast(message) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 1800);
  }

  /**
   * Clears content and memory cache on exiting reader.
   */
  clear() {
    this.chapterRequestId++;
    this.contentEl.innerHTML = '';
    this.contentEl.style.transform = 'none';
    this.chapterCache.clear();
  }
}
