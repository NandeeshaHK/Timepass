import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Robust 3-Container Virtual DOM Carousel with Directional Touch Gestures,
 * Tap Zones, and Immediate Rapid-Tap / Scrub Queue Discarding.
 */
export class VirtualCarousel {
  constructor({ containerEl, onPageChange, fetchAndDecryptChunk }) {
    this.container = containerEl;
    this.onPageChange = onPageChange;
    this.fetchAndDecryptChunk = fetchAndDecryptChunk;

    this.currentIndex = 0;
    this.totalChunks = 1;
    this.isRendering = false;
    this.pageRequestId = 0; // Incremented on every page change request to cancel queued transitions

    this.initDOM();
    this.initGestureEvents();
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

    this.centerCarousel(false);
  }

  centerCarousel(smooth = false) {
    const pageWidth = this.container.clientWidth;
    this.container.scrollTo({
      left: pageWidth,
      behavior: smooth ? 'smooth' : 'instant'
    });
  }

  initGestureEvents() {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let scrollTimeout = null;

    // Direct touch gesture handling for responsive left/right swiping
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }
    }, { passive: true });

    this.container.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        const elapsed = Date.now() - startTime;

        // Detect horizontal swipe (left or right swipe, ignoring vertical movement)
        if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && elapsed < 500) {
          if (deltaX < 0) {
            // Swiped left -> Next page
            this.next();
          } else {
            // Swiped right -> Previous page
            this.prev();
          }
          return;
        }
      }
    }, { passive: true });

    // CSS Scroll snap end handler
    this.container.addEventListener('scroll', () => {
      if (this.isRendering) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.handleScrollEnd();
      }, 80);
    }, { passive: true });
  }

  async handleScrollEnd() {
    if (this.isRendering) return;
    const pageWidth = this.container.clientWidth;
    const scrollLeft = this.container.scrollLeft;
    const threshold = pageWidth * 0.35;

    // Swiped leftwards to see next container
    if (scrollLeft > pageWidth + threshold && this.currentIndex < this.totalChunks - 1) {
      await this.goToPage(this.currentIndex + 1);
    }
    // Swiped rightwards to see prev container
    else if (scrollLeft < pageWidth - threshold && this.currentIndex > 0) {
      await this.goToPage(this.currentIndex - 1);
    } else {
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

    // Increment request ID to cancel any outdated previous loads
    const currentRequestId = ++this.pageRequestId;
    this.currentIndex = targetIndex;
    this.isRendering = true;

    // 1. Fetch & decrypt active center page immediately
    try {
      const currentMarkdown = await this.fetchAndDecryptChunk(this.currentIndex);
      // If a newer navigation happened while awaiting, drop this stale result
      if (currentRequestId !== this.pageRequestId) return;

      this.pageCurr.innerHTML = DOMPurify.sanitize(marked.parse(currentMarkdown || ''));
      // Scroll center content to top
      this.pageCurr.scrollTop = 0;
    } catch (err) {
      if (currentRequestId === this.pageRequestId) {
        this.pageCurr.innerHTML = '<p style="color:#D32F2F;">[Error displaying page content]</p>';
      }
    }

    // Instantly snap carousel to center position
    this.centerCarousel(false);
    this.isRendering = false;

    if (this.onPageChange) {
      this.onPageChange(this.currentIndex, this.totalChunks);
    }

    // 2. Pre-fetch and decrypt Prev & Next in the background without blocking UI
    if (this.currentIndex > 0) {
      this.fetchAndDecryptChunk(this.currentIndex - 1).then(prevMd => {
        if (currentRequestId === this.pageRequestId) {
          this.pagePrev.innerHTML = DOMPurify.sanitize(marked.parse(prevMd || ''));
          this.pagePrev.scrollTop = 0;
        }
      });
    } else {
      this.pagePrev.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:40%;">— Beginning of Story —</div>';
    }

    if (this.currentIndex < this.totalChunks - 1) {
      this.fetchAndDecryptChunk(this.currentIndex + 1).then(nextMd => {
        if (currentRequestId === this.pageRequestId) {
          this.pageNext.innerHTML = DOMPurify.sanitize(marked.parse(nextMd || ''));
          this.pageNext.scrollTop = 0;
        }
      });
    } else {
      this.pageNext.innerHTML = '<div style="text-align:center;color:var(--text-muted);margin-top:40%;">— End of Story —</div>';
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
    this.pageRequestId++;
    this.pagePrev.innerHTML = '';
    this.pageCurr.innerHTML = '';
    this.pageNext.innerHTML = '';
  }
}
