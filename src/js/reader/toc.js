/**
 * Pre-computed Chapter Table of Contents Drawer Controller
 */

export class TocDrawer {
  constructor({ onSelectChapter }) {
    this.onSelectChapter = onSelectChapter;
    this.drawerEl = document.getElementById('toc-drawer');
    this.listEl = document.getElementById('toc-list');
    this.closeBtn = document.getElementById('btn-close-toc');
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.drawerEl.addEventListener('click', (e) => {
      if (e.target === this.drawerEl) {
        this.close();
      }
    });
  }

  render(tocItems, currentChunkIndex) {
    this.listEl.innerHTML = '';
    
    if (!tocItems || tocItems.length === 0) {
      this.listEl.innerHTML = '<li class="toc-item">No chapters available</li>';
      return;
    }

    tocItems.forEach((item) => {
      const li = document.createElement('li');
      li.className = `toc-item ${item.level === 2 ? 'level-2' : ''}`;
      
      // Determine if current chunk falls inside this chapter
      if (item.chunkIndex === currentChunkIndex) {
        li.classList.add('active');
      }

      li.innerHTML = `
        <span>${item.title}</span>
        <span style="font-size: 0.85rem; color: var(--text-muted)">p. ${item.chunkIndex + 1}</span>
      `;

      li.addEventListener('click', () => {
        this.close();
        if (this.onSelectChapter) {
          this.onSelectChapter(item.chunkIndex);
        }
      });

      this.listEl.appendChild(li);
    });
  }

  open() {
    this.isOpen = true;
    this.drawerEl.classList.add('open');
  }

  close() {
    this.isOpen = false;
    this.drawerEl.classList.remove('open');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
