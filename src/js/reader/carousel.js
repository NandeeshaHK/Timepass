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
   * Splits text into complete sentences based on terminal punctuation (. ! ? । ॥)
   * while keeping quotation marks and closing brackets attached to their respective sentence.
   * @param {string} text
   * @returns {string[]}
   */
  splitIntoSentences(text) {
    if (!text) return [];
    const trimmed = text.trim();
    if (!trimmed) return [];

    // Match sentences ending with . ! ? । ॥ and optional trailing quotes/brackets
    // Any remaining trailing text without punctuation is captured as the final sentence
    const regex = /[^.!?।॥]+(?:[.!?।॥]+["'»”’)}\]]*|$)/gu;
    const matches = trimmed.match(regex);
    if (!matches || matches.length === 0) {
      return [trimmed];
    }

    const sentences = [];
    for (const match of matches) {
      const s = match.trim();
      if (s) {
        sentences.push(s);
      }
    }
    return sentences.length > 0 ? sentences : [trimmed];
  }

  /**
   * Emergency fallback to split words across pages when a single sentence exceeds the entire page height.
   * @param {string[]} words
   * @param {number} safeAvailableHeight
   * @param {boolean} [isContinuation=false]
   * @returns {HTMLElement[]}
   */
  splitWordsToPages(words, safeAvailableHeight, isContinuation = false) {
    const resultNodes = [];
    let remWords = words;

    while (remWords.length > 0) {
      this.measurerEl.innerHTML = '';
      const testP = document.createElement('p');
      if (isContinuation || resultNodes.length > 0) testP.className = 'continuation';
      this.measurerEl.appendChild(testP);

      let low = 1;
      let high = remWords.length;
      let best = 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        testP.textContent = remWords.slice(0, mid).join(' ');
        if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const p = document.createElement('p');
      if (isContinuation || resultNodes.length > 0) p.className = 'continuation';
      p.textContent = remWords.slice(0, best).join(' ');
      resultNodes.push(p);
      remWords = remWords.slice(best);
    }

    return resultNodes;
  }

  /**
   * Paginates an array of sentences across pages, strictly ending each page on complete sentence boundaries.
   * Falls back to word-splitting ONLY if a single sentence exceeds the entire page height.
   * @param {string[]} sentences
   * @param {HTMLElement[][]} pages
   * @param {HTMLElement[]} currentPageNodes
   * @param {number} safeAvailableHeight
   */
  paginateSentences(sentences, pages, currentPageNodes, safeAvailableHeight) {
    let remSentences = sentences;

    while (remSentences.length > 0) {
      this.measurerEl.innerHTML = '';
      const testP = document.createElement('p');
      testP.className = 'continuation';
      this.measurerEl.appendChild(testP);

      let fitCount = 0;
      for (let i = 1; i <= remSentences.length; i++) {
        testP.textContent = remSentences.slice(0, i).join(' ');
        if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
          fitCount = i;
        } else {
          break;
        }
      }

      this.measurerEl.innerHTML = '';

      if (fitCount >= remSentences.length) {
        // All remaining sentences fit on this page!
        const finalP = document.createElement('p');
        finalP.className = 'continuation';
        finalP.textContent = remSentences.join(' ');
        currentPageNodes.push(finalP);
        this.measurerEl.appendChild(finalP.cloneNode(true));
        break;
      } else if (fitCount > 0) {
        // A subset of sentences fit on this page
        const sliceP = document.createElement('p');
        sliceP.className = 'continuation';
        sliceP.textContent = remSentences.slice(0, fitCount).join(' ');
        pages.push([sliceP]);
        remSentences = remSentences.slice(fitCount);
      } else {
        // Rare edge case: A single sentence exceeds the entire height of an empty page
        const singleSentenceWords = remSentences[0].split(/\s+/).filter(Boolean);
        const wordSlices = this.splitWordsToPages(singleSentenceWords, safeAvailableHeight, true);
        for (let w = 0; w < wordSlices.length - 1; w++) {
          pages.push([wordSlices[w]]);
        }
        const lastSlice = wordSlices[wordSlices.length - 1];
        if (remSentences.length === 1) {
          currentPageNodes.push(lastSlice);
          this.measurerEl.appendChild(lastSlice.cloneNode(true));
        } else {
          pages.push([lastSlice]);
        }
        remSentences = remSentences.slice(1);
      }
    }
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
          const sentences = this.splitIntoSentences(node.textContent);
          let bestSentences = 0;

          // If current page already has content, test how many sentences fit in remaining space
          if (currentPageNodes.length > 0) {
            const testP = document.createElement('p');
            this.measurerEl.appendChild(testP);

            for (let i = 1; i <= sentences.length; i++) {
              testP.textContent = sentences.slice(0, i).join(' ');
              if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
                bestSentences = i;
              } else {
                break;
              }
            }
            this.measurerEl.removeChild(testP);
          }

          if (bestSentences > 0) {
            // First slice of sentences fits on current page
            const fitP = document.createElement('p');
            fitP.textContent = sentences.slice(0, bestSentences).join(' ');
            currentPageNodes.push(fitP);

            // Flush current page at sentence boundary
            pages.push(currentPageNodes);
            currentPageNodes = [];
            this.measurerEl.innerHTML = '';

            const remainingSentences = sentences.slice(bestSentences);
            this.paginateSentences(remainingSentences, pages, currentPageNodes, safeAvailableHeight);
          } else {
            // Not enough space for any sentence on current page; flush to start fresh page
            if (currentPageNodes.length > 0) {
              pages.push(currentPageNodes);
              currentPageNodes = [];
            }
            this.measurerEl.innerHTML = '';

            this.measurerEl.appendChild(node);
            if (this.measurerEl.offsetHeight <= safeAvailableHeight) {
              currentPageNodes.push(node.cloneNode(true));
            } else {
              this.measurerEl.removeChild(node);
              this.paginateSentences(sentences, pages, currentPageNodes, safeAvailableHeight);
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
