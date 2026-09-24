/**
 * History API Router to intercept hardware Back Button & gesture navigation.
 * Provides clean back-button hierarchies (closing open drawers first before exiting reader).
 */
export class Router {
  /**
   * @param {Object} options
   * @param {() => void} options.onNavigateToLibrary
   * @param {(storyId: string) => void} options.onNavigateToReader
   * @param {() => boolean} [options.shouldInterceptBack] - Returns true if back gesture was consumed (e.g. drawer closed).
   */
  constructor({ onNavigateToLibrary, onNavigateToReader, shouldInterceptBack }) {
    this.onNavigateToLibrary = onNavigateToLibrary;
    this.onNavigateToReader = onNavigateToReader;
    this.shouldInterceptBack = shouldInterceptBack;

    this.currentView = 'library';
    this.currentStoryId = null;
    this.initHistoryListener();
  }

  initHistoryListener() {
    // Replace initial state with library
    window.history.replaceState({ view: 'library' }, '', '#library');

    window.addEventListener('popstate', (event) => {
      // If a drawer or modal is open, intercept back to close it instead of leaving
      if (this.shouldInterceptBack && this.shouldInterceptBack()) {
        if (this.currentStoryId) {
          window.history.pushState({ view: 'reader', storyId: this.currentStoryId }, '', `#reading?id=${this.currentStoryId}`);
        }
        return;
      }

      const state = event.state;
      if (!state || state.view === 'library') {
        this.currentView = 'library';
        this.currentStoryId = null;
        if (this.onNavigateToLibrary) this.onNavigateToLibrary();
      } else if (state.view === 'reader') {
        this.currentView = 'reader';
        this.currentStoryId = state.storyId;
        if (this.onNavigateToReader) this.onNavigateToReader(state.storyId);
      }
    });
  }

  /**
   * @param {string} storyId
   */
  goToReader(storyId) {
    this.currentView = 'reader';
    this.currentStoryId = storyId;
    window.history.pushState({ view: 'reader', storyId }, '', `#reading?id=${storyId}`);
  }

  goToLibrary() {
    if (this.currentView === 'reader') {
      this.currentView = 'library';
      this.currentStoryId = null;
      window.history.back();
    } else {
      this.currentView = 'library';
      this.currentStoryId = null;
      if (this.onNavigateToLibrary) this.onNavigateToLibrary();
    }
  }
}
