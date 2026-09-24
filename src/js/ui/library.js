import { Store } from '../storage/store.js';

export class LibraryView {
  constructor({ onSelectStory }) {
    this.onSelectStory = onSelectStory;
    this.listContainer = document.getElementById('story-list');
    this.continueContainer = document.getElementById('continue-section');
  }

  render(catalog) {
    this.renderContinueCard(catalog);
    this.renderStoryList(catalog);
  }

  /**
   * @param {Array<Object>} catalog
   */
  renderContinueCard(catalog) {
    const lastRead = Store.getLastRead();
    if (!lastRead || !lastRead.storyId) {
      this.continueContainer.innerHTML = '';
      return;
    }

    const storyMeta = catalog.find(s => s.id === lastRead.storyId);
    if (!storyMeta) return;

    const chapterNum = (lastRead.chapterIndex ?? lastRead.chunkIndex ?? 0) + 1;
    const pageNum = (lastRead.pageIndex ?? 0) + 1;

    this.continueContainer.innerHTML = `
      <div class="continue-card" id="btn-continue-reading">
        <div class="continue-badge">Continue Reading</div>
        <div class="continue-title">${storyMeta.title}</div>
        <div class="continue-meta">Chapter ${chapterNum} of ${storyMeta.totalChunks} (Page ${pageNum}) · By ${storyMeta.author}</div>
      </div>
    `;

    document.getElementById('btn-continue-reading').addEventListener('click', () => {
      if (this.onSelectStory) {
        this.onSelectStory(storyMeta.id, lastRead.chapterIndex ?? lastRead.chunkIndex ?? 0, lastRead.pageIndex ?? 0);
      }
    });
  }

  /**
   * @param {Array<Object>} catalog
   */
  renderStoryList(catalog) {
    this.listContainer.innerHTML = '';

    if (!catalog || catalog.length === 0) {
      this.listContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;">No stories available in library.</p>';
      return;
    }

    catalog.forEach(story => {
      const card = document.createElement('div');
      card.className = 'story-card';
      const savedProg = Store.getStoryProgress(story.id);

      const hasRead = savedProg.chapterIndex > 0 || savedProg.pageIndex > 0;
      const progressLabel = hasRead
        ? `Chapter ${savedProg.chapterIndex + 1}/${story.totalChunks}`
        : `${story.estimatedMinutes} min read`;

      card.innerHTML = `
        <div class="story-card-title">${story.title}</div>
        <div class="story-card-synopsis">${story.synopsis || 'A serene short story to pass the time.'}</div>
        <div class="story-card-footer">
          <span>By ${story.author}</span>
          <span>${progressLabel}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.onSelectStory) {
          this.onSelectStory(story.id, savedProg.chapterIndex, savedProg.pageIndex);
        }
      });

      this.listContainer.appendChild(card);
    });
  }
}
