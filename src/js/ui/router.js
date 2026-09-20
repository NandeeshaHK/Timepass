/**
 * History API Router to intercept hardware Back Button & gesture navigation
 */

export class Router {
  constructor({ onNavigateToLibrary, onNavigateToReader }) {
    this.onNavigateToLibrary = onNavigateToLibrary;
    this.onNavigateToReader = onNavigateToReader;

    this.currentView = 'library';
    this.initHistoryListener();
  }

  initHistoryListener() {
    // Replace initial state with library
    window.history.replaceState({ view: 'library' }, '', '#library');

    window.addEventListener('popstate', (event) => {
      const state = event.state;
      if (!state || state.view === 'library') {
        this.currentView = 'library';
        if (this.onNavigateToLibrary) this.onNavigateToLibrary();
      } else if (state.view === 'reader') {
        this.currentView = 'reader';
        if (this.onNavigateToReader) this.onNavigateToReader(state.storyId);
      }
    });
  }

  goToReader(storyId) {
    this.currentView = 'reader';
    window.history.pushState({ view: 'reader', storyId }, '', `#reading?id=${storyId}`);
  }

  goToLibrary() {
    if (this.currentView === 'reader') {
      window.history.back(); // Triggers popstate listener to handle cleanup
    } else {
      this.currentView = 'library';
      if (this.onNavigateToLibrary) this.onNavigateToLibrary();
    }
  }
}
