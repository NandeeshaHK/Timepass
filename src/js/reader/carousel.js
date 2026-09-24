import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { HapticUX } from '../ui/haptics.js';

/**
 * Single-Page Horizontal Carousel Reader Engine.
 * Dynamically partitions chapter content into exact-fit non-overflowing pages
 * measured in the client DOM. Guarantees ZERO line cut-off, NO side-by-side columns,
 * and buttery-smooth horizontal swipe transitions.
 */
export class VirtualCarousel {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.viewportEl - Viewport container element.
   * @param {HTMLElement} options.trackEl - Horizontal sliding track for reader pages.
   * @param {HTMLElement} options.measurerEl - Off-screen measuring container.
   * @param {HTMLElement} [options.toastEl] - Toast notification element.
   * @param {(chapterIndex: number) => Promise<string>} options.fetchAndDecryptChunk - Chunk decryptor.
   * @param {(chapterIndex: number, totalChapters: number, pageIndex: number, totalPages: number) => void} options.onPageChange - Progress callback.
   * @param {() => void} [options.onToggleHUD] - HUD toggle callback.
   */
  constructor({
    viewportEl,
    trackEl,
    measurerEl,
    toastEl,
    fetchAndDecryptChunk,
    onPageChange,
    onToggleHUD
  }) {
    this.viewportEl = viewportEl;
    this.trackEl = trackEl;
    this.measurerEl = measurerEl;
    this.toastEl = toastEl || document.getElementById('reader-toast');
    this.fetchAndDecryptChunk = fetchAndDecryptChunk;
    this.onPageChange = onPageChange;
    this.onToggleHUD = onToggleHUD;

    this.currentChapterIndex = 0;
    this.totalChapters = 1;
    this.currentPageIndex = 0;
    this.totalPages = 1;

    this.currentMarkdown = '';
    this.chapterRequestId = 0;
    this.isLoadingChapter = false;
    /** @type {Map<number, string>} */
    this.chapterCache = new Map();
    this.toastTimer = null;

    this.initGestureEvents();
    this.initResizeListener();
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

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Follow finger horizontally live during drag
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        const pageWidth = this.viewportEl.clientWidth;
        const baseOffset = this.currentPageIndex * pageWidth;
        let dragDelta = deltaX;
        // Resistance if at boundaries
        if (
          (this.currentPageIndex === 0 && deltaX > 0 && this.currentChapterIndex === 0) ||
          (this.currentPageIndex === this.totalPages - 1 && deltaX < 0 && this.currentChapterIndex === this.totalChapters - 1)
        ) {
          dragDelta = deltaX * 0.35;
        }
        this.trackEl.style.transition = 'none';
        this.trackEl.style.transform = `translateX(-${baseOffset - dragDelta}px)`;
      }
    }, { passive: true });

    this.viewportEl.addEventListener('touchend', (e) => {
      if (!isTouching) return;
      isTouching = false;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const distance = Math.hypot(deltaX, deltaY);
      const elapsed = Date.now() - startTime;
      const pageWidth = this.viewportEl.clientWidth;
      const threshold = Math.min(pageWidth * 0.18, 50);

      // Horizontal Swipe Gesture Detection
      if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && elapsed < 600) {
        if (deltaX < 0) {
          // Swiped Left -> Next page
          this.nextPage();
        } else {
          // Swiped Right -> Previous page
          this.prevPage();
        }
        return;
      }

      // Clean Tap Gesture Detection
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
          HapticUX.buttonTap();
          if (this.onToggleHUD) this.onToggleHUD();
        }
        return;
      }

      // Snap back cleanly to current page if drag was incomplete
      this.updateTransform(true);
    }, { passive: true });

    // 2. Desktop Mouse Click Fallback
    this.viewportEl.addEventListener('click', (e) => {
      if (e.target.closest('#hud-container.hud-visible') || e.target.closest('#toc-drawer.open')) {
        return;
      }
      if (Date.now() - startTime < 450) return;

      const screenWidth = window.innerWidth;
      const clickX = e.clientX;

      if (clickX < screenWidth * 0.22) {
        this.prevPage();
      } else if (clickX > screenWidth * 0.78) {
        this.nextPage();
      } else {
        HapticUX.buttonTap();
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
   * Monitors viewport resize (orientation change or font size scaling).
   */
  initResizeListener() {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.recalculatePages(false);
      }, 100);
    });
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
   * Loads and displays a chapter, paginating its content cleanly into slides.
   * @param {number} chapterIndex
   * @param {number | 'last'} [targetPage=0]
   * @param {'slide-left' | 'slide-right' | null} [transitionDirection=null]
   * @param {boolean} [force=false]
   */
  async goToChapter(chapterIndex, targetPage = 0, transitionDirection = null, force = false) {
    if (chapterIndex < 0 || chapterIndex >= this.totalChapters) return;
    if (chapterIndex === this.currentChapterIndex && !force && targetPage !== 'last') return;

    const currentRequestId = ++this.chapterRequestId;
    this.isLoadingChapter = true;
    this.currentChapterIndex = chapterIndex;

    // Apply chapter transition animation if switching between chapters
    if (transitionDirection) {
      this.trackEl.style.transition = 'opacity 0.16s ease-out';
      this.trackEl.style.opacity = '0';
      await new Promise(r => setTimeout(r, 140));
    }

    // Retrieve markdown from memory cache or fetch and decrypt
    let markdown = this.chapterCache.get(chapterIndex);
    if (!markdown) {
      try {
        markdown = await this.fetchAndDecryptChunk(chapterIndex);
        this.chapterCache.set(chapterIndex, markdown);
      } catch (err) {
        markdown = '### [Error Loading Chapter]\nPlease check your connection or passphrase.';
      }
    }

    // Discard stale request if user rapidly navigated elsewhere
    if (currentRequestId !== this.chapterRequestId) return;

    this.currentMarkdown = markdown;

    // Paginate markdown into non-overflowing DOM slides
    this.buildPagesFromMarkdown(this.currentMarkdown);

    // Determine target page within chapter
    if (targetPage === 'last') {
      this.currentPageIndex = Math.max(0, this.totalPages - 1);
    } else if (typeof targetPage === 'number') {
      this.currentPageIndex = Math.min(Math.max(0, targetPage), this.totalPages - 1);
    }

    this.updateTransform(false);
    this.trackEl.style.opacity = '1';
    this.isLoadingChapter = false;
    this.notifyProgress();

    // Pre-fetch adjacent chapters in background
    this.prefetchAdjacentChapters(chapterIndex);
  }

  /**
   * Paginates chapter markdown into non-overflowing page slides.
   * Measures content height accurately in client DOM so NO text is ever clipped.
   * @param {string} markdown
   */
  buildPagesFromMarkdown(markdown) {
    const rawHtml = DOMPurify.sanitize(marked.parse(markdown || ''));
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;
    const blockElements = Array.from(tempDiv.children);

    const viewportHeight = this.viewportEl.clientHeight || window.innerHeight;
    const viewportWidth = Math.min(this.viewportEl.clientWidth || window.innerWidth, 680);

    // Subtract generous padding & safe areas so text has breathing room and NEVER touches edges
    const safeAvailableHeight = Math.max(260, viewportHeight - 110);
    this.measurerEl.style.width = `${Math.max(260, viewportWidth - 44)}px`;

    const pages = [];
    let currentPageNodes = [];
    this.measurerEl.innerHTML = '';

    for (const child of blockElements) {
      const node = child.cloneNode(true);
      this.measurerEl.appendChild(node);

      if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
        // Fits entirely on current page
        currentPageNodes.push(node.cloneNode(true));
      } else {
        // Exceeds available height
        this.measurerEl.removeChild(node);

        if (node.tagName === 'P') {
          const words = node.textContent.trim().split(/\s+/).filter(Boolean);
          let low = 1;
          let high = words.length;
          let bestWords = 0;

          const testP = document.createElement('p');
          if (currentPageNodes.length > 0) testP.className = 'continuation';
          this.measurerEl.appendChild(testP);

          // Binary search for exact number of words that fit remaining vertical space
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            testP.textContent = words.slice(0, mid).join(' ');
            if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
              bestWords = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          this.measurerEl.removeChild(testP);

          if (bestWords >= 8 && currentPageNodes.length > 0) {
            // First slice fits on current page
            const fitP = document.createElement('p');
            fitP.textContent = words.slice(0, bestWords).join(' ');
            currentPageNodes.push(fitP);

            pages.push(currentPageNodes);
            currentPageNodes = [];
            this.measurerEl.innerHTML = '';

            let remainingWords = words.slice(bestWords);
            while (remainingWords.length > 0) {
              this.measurerEl.innerHTML = '';
              const contP = document.createElement('p');
              contP.className = 'continuation';
              this.measurerEl.appendChild(contP);

              let rLow = 1;
              let rHigh = remainingWords.length;
              let rBest = 0;

              while (rLow <= rHigh) {
                const mid = Math.floor((rLow + rHigh) / 2);
                contP.textContent = remainingWords.slice(0, mid).join(' ');
                if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
                  rBest = mid;
                  rLow = mid + 1;
                } else {
                  rHigh = mid - 1;
                }
              }

              if (rBest === 0 || rBest >= remainingWords.length) {
                const finalP = document.createElement('p');
                finalP.className = 'continuation';
                finalP.textContent = remainingWords.join(' ');
                currentPageNodes.push(finalP);
                this.measurerEl.innerHTML = '';
                this.measurerEl.appendChild(finalP.cloneNode(true));
                break;
              } else {
                const sliceP = document.createElement('p');
                sliceP.className = 'continuation';
                sliceP.textContent = remainingWords.slice(0, rBest).join(' ');
                pages.push([sliceP]);
                remainingWords = remainingWords.slice(rBest);
              }
            }
          } else {
            // Not enough space for split on current page, flush current page
            if (currentPageNodes.length > 0) {
              pages.push(currentPageNodes);
              currentPageNodes = [];
            }
            this.measurerEl.innerHTML = '';

            this.measurerEl.appendChild(node);
            if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
              currentPageNodes.push(node.cloneNode(true));
            } else {
              // Paragraph larger than full page: split across multiple pages
              this.measurerEl.removeChild(node);
              let remWords = words;

              while (remWords.length > 0) {
                this.measurerEl.innerHTML = '';
                const pBlock = document.createElement('p');
                if (pages.length > 0) pBlock.className = 'continuation';
                this.measurerEl.appendChild(pBlock);

                let bLow = 1;
                let bHigh = remWords.length;
                let bBest = 0;

                while (bLow <= bHigh) {
                  const mid = Math.floor((bLow + bHigh) / 2);
                  pBlock.textContent = remWords.slice(0, mid).join(' ');
                  if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
                    bBest = mid;
                    bLow = mid + 1;
                  } else {
                    bHigh = mid - 1;
                  }
                }

                if (bBest === 0 || bBest >= remWords.length) {
                  const finP = document.createElement('p');
                  if (pages.length > 0) finP.className = 'continuation';
                  finP.textContent = remWords.join(' ');
                  currentPageNodes.push(finP);
                  this.measurerEl.innerHTML = '';
                  this.measurerEl.appendChild(finP.cloneNode(true));
                  break;
                } else {
                  const partP = document.createElement('p');
                  if (pages.length > 0) partP.className = 'continuation';
                  partP.textContent = remWords.slice(0, bBest).join(' ');
                  pages.push([partP]);
                  remWords = remWords.slice(bBest);
                }
              }
            }
          }
        } else {
          // Heading or other block: flush current page so chapter/section heading starts at page top
          if (currentPageNodes.length > 0) {
            pages.push(currentPageNodes);
            currentPageNodes = [];
          }
          this.measurerEl.innerHTML = '';
          this.measurerEl.appendChild(node);
          currentPageNodes.push(node.cloneNode(true));
        }
      }
    }

    if (currentPageNodes.length > 0) {
      pages.push(currentPageNodes);
    }

    this.measurerEl.innerHTML = '';
    const finalPages = pages.length > 0 ? pages : [[document.createElement('p')]];

    // Render pages into single-page carousel track
    this.trackEl.innerHTML = '';
    for (const pageNodes of finalPages) {
      const pageEl = document.createElement('div');
      pageEl.className = 'reader-page';
      const bodyEl = document.createElement('div');
      bodyEl.className = 'page-body';
      for (const n of pageNodes) {
        bodyEl.appendChild(n);
      }
      pageEl.appendChild(bodyEl);
      this.trackEl.appendChild(pageEl);
    }

    this.totalPages = finalPages.length;
  }

  /**
   * Re-paginates content on font size or window changes.
   * @param {boolean} [animated=false]
   */
  recalculatePages(animated = false) {
    if (!this.currentMarkdown) return;
    const prevPage = this.currentPageIndex;
    this.buildPagesFromMarkdown(this.currentMarkdown);
    this.currentPageIndex = Math.min(prevPage, this.totalPages - 1);
    this.updateTransform(animated);
    this.notifyProgress();
  }

  /**
   * Applies CSS transform to slide to the active page.
   * @param {boolean} [animated=true]
   */
  updateTransform(animated = true) {
    this.trackEl.style.transition = animated
      ? 'transform 0.24s cubic-bezier(0.2, 0.9, 0.4, 1)'
      : 'none';
    const pageWidth = this.viewportEl.clientWidth;
    this.trackEl.style.transform = `translateX(-${this.currentPageIndex * pageWidth}px)`;
  }

  /**
   * Advances to next page within chapter, or advances to next chapter.
   */
  async nextPage() {
    if (this.isLoadingChapter) return;

    // 1. More pages in current chapter -> slide to next page
    if (this.currentPageIndex < this.totalPages - 1) {
      this.currentPageIndex++;
      this.updateTransform(true);
      this.notifyProgress();
      HapticUX.buttonTap();
      return;
    }

    // 2. At last page of current chapter -> advance to next chapter
    if (this.currentChapterIndex < this.totalChapters - 1) {
      HapticUX.buttonTap();
      await this.goToChapter(this.currentChapterIndex + 1, 0, 'slide-left');
    } else {
      HapticUX.pageEnd();
      this.showToast('— End of Story —');
    }
  }

  /**
   * Moves to previous page within chapter, or moves to previous chapter's last page.
   */
  async prevPage() {
    if (this.isLoadingChapter) return;

    // 1. Prior pages in current chapter -> slide to previous page
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.updateTransform(true);
      this.notifyProgress();
      HapticUX.buttonTap();
      return;
    }

    // 2. At first page of current chapter -> move to previous chapter's last page
    if (this.currentChapterIndex > 0) {
      HapticUX.buttonTap();
      await this.goToChapter(this.currentChapterIndex - 1, 'last', 'slide-right');
    } else {
      HapticUX.pageEnd();
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
    this.trackEl.innerHTML = '';
    this.trackEl.style.transform = 'none';
    this.chapterCache.clear();
    this.currentMarkdown = '';
  }
}
