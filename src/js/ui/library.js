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

  renderContinueCard(catalog) {
    const lastRead = Store.getLastRead();
    if (!lastRead || !lastRead.storyId) {
      this.continueContainer.innerHTML = '';
      return;
    }

    const storyMeta = catalog.find(s => s.id === lastRead.storyId);
    if (!storyMeta) return;

    this.continueContainer.innerHTML = `
      <div class="continue-card" id="btn-continue-reading">
        <div class="continue-badge">Continue Reading</div>
        <div class="continue-title">${storyMeta.title}</div>
        <div class="continue-meta">Page ${lastRead.chunkIndex + 1} of ${storyMeta.totalChunks} · By ${storyMeta.author}</div>
      </div>
    `;

    document.getElementById('btn-continue-reading').addEventListener('click', () => {
      if (this.onSelectStory) {
        this.onSelectStory(storyMeta.id, lastRead.chunkIndex);
      }
    });
  }

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

      card.innerHTML = `
        <div class="story-card-title">${story.title}</div>
        <div class="story-card-synopsis">${story.synopsis || 'A serene short story to pass the time.'}</div>
        <div class="story-card-footer">
          <span>By ${story.author}</span>
          <span>${savedProg > 0 ? `Page ${savedProg + 1}/${story.totalChunks}` : `${story.estimatedMinutes} min read`}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.onSelectStory) {
          this.onSelectStory(story.id, savedProg);
        }
      });

      this.listContainer.appendChild(card);
    });
  }
}
