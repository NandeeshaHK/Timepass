import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * 3-Container Virtual DOM Carousel with Ephemeral Decryption
 * Maintains only: [Slot 0: Prev], [Slot 1: Current], [Slot 2: Next]
 */
export class VirtualCarousel {
  constructor({ containerEl, onPageChange, fetchAndDecryptChunk }) {
    this.container = containerEl;
    this.onPageChange = onPageChange;
    this.fetchAndDecryptChunk = fetchAndDecryptChunk;

    this.currentIndex = 0;
    this.totalChunks = 1;
    this.isRendering = false;

    // Cache of loaded plaintext for the current window only (immediately cleared on shift)
    this.windowData = {
      prev: null,
      current: null,
      next: null
    };

    this.initDOM();
    this.initScrollEvents();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="carousel-page" id="page-prev">
        <div class="page-content"></div>
      </div>
      <div class="carousel-page" id="page-curr">
        <div class="page-content"></div>
      </div>
      <div class="carousel-page" id="page-next">
        <div class="page-content"></div>
      </div>
    `;

    this.pagePrev = this.container.querySelector('#page-prev .page-content');
    this.pageCurr = this.container.querySelector('#page-curr .page-content');
    this.pageNext = this.container.querySelector('#page-next .page-content');

    // Scroll directly to center container initially
    this.centerCarousel(false);
  }

  centerCarousel(smooth = false) {
    const pageWidth = this.container.clientWidth;
    this.container.scrollTo({
      left: pageWidth,
      behavior: smooth ? 'smooth' : 'instant'
    });
  }

  initScrollEvents() {
    let scrollTimeout = null;

    this.container.addEventListener('scroll', () => {
      if (this.isRendering) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.handleScrollEnd();
      }, 100);
    }, { passive: true });
  }

  async handleScrollEnd() {
    const pageWidth = this.container.clientWidth;
    const scrollLeft = this.container.scrollLeft;
    const threshold = pageWidth * 0.4;

    // Swiped to Left (Previous Page)
    if (scrollLeft < pageWidth - threshold && this.currentIndex > 0) {
      await this.goToPage(this.currentIndex - 1);
    }
    // Swiped to Right (Next Page)
    else if (scrollLeft > pageWidth + threshold && this.currentIndex < this.totalChunks - 1) {
      await this.goToPage(this.currentIndex + 1);
    } else {
      // Re-center if incomplete swipe
      this.centerCarousel(true);
    }
  }

  async loadStory(totalChunks, initialIndex = 0) {
    this.totalChunks = totalChunks;
    await this.goToPage(initialIndex, true);
  }

  async goToPage(targetIndex, force = false) {
    if (targetIndex < 0 || targetIndex >= this.totalChunks) return;
    if (targetIndex === this.currentIndex && !force) return;

    this.isRendering = true;
    this.currentIndex = targetIndex;

    // 1. Decrypt target center chunk
    const currentMarkdown = await this.fetchAndDecryptChunk(this.currentIndex);
    this.pageCurr.innerHTML = DOMPurify.sanitize(marked.parse(currentMarkdown || ''));

    // 2. Pre-fetch and decrypt Prev chunk in background
    if (this.currentIndex > 0) {
      this.fetchAndDecryptChunk(this.currentIndex - 1).then(prevMd => {
        this.pagePrev.innerHTML = DOMPurify.sanitize(marked.parse(prevMd || ''));
      });
    } else {
      this.pagePrev.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:40%;">— Beginning of Story —</div>';
    }

    // 3. Pre-fetch and decrypt Next chunk in background
    if (this.currentIndex < this.totalChunks - 1) {
      this.fetchAndDecryptChunk(this.currentIndex + 1).then(nextMd => {
        this.pageNext.innerHTML = DOMPurify.sanitize(marked.parse(nextMd || ''));
      });
    } else {
      this.pageNext.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:40%;">— End of Story —</div>';
    }

    // Instantly reset scroll position to center container
    this.centerCarousel(false);
    this.isRendering = false;

    if (this.onPageChange) {
      this.onPageChange(this.currentIndex, this.totalChunks);
    }
  }

  async next() {
    if (this.currentIndex < this.totalChunks - 1) {
      await this.goToPage(this.currentIndex + 1);
    }
  }

  async prev() {
    if (this.currentIndex > 0) {
      await this.goToPage(this.currentIndex - 1);
    }
  }

  // Wipes all text from DOM when leaving reader
  clear() {
    this.pagePrev.innerHTML = '';
    this.pageCurr.innerHTML = '';
    this.pageNext.innerHTML = '';
  }
}
