/**
 * FullscreenManager: Clean, cross-browser wrapper for Fullscreen API.
 * Provides seamless immersive reading experience with safe fallbacks.
 */
export class FullscreenManager {
  /**
   * @param {Object} [options]
   * @param {(isFullscreen: boolean) => void} [options.onChange]
   */
  constructor(options = {}) {
    this.onChange = options.onChange;
    this.initListener();
  }

  /**
   * Checks if fullscreen is supported on the current device/browser.
   * @returns {boolean}
   */
  static isSupported() {
    return typeof document !== 'undefined' && (
      document.fullscreenEnabled ||
      // @ts-ignore
      document.webkitFullscreenEnabled ||
      false
    );
  }

  /**
   * Checks if the document is currently in fullscreen mode.
   * @returns {boolean}
   */
  static isFullscreen() {
    return typeof document !== 'undefined' && !!(
      document.fullscreenElement ||
      // @ts-ignore
      document.webkitFullscreenElement
    );
  }

  /**
   * Enters fullscreen mode on document element.
   * @returns {Promise<void>}
   */
  async enter() {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (
        // @ts-ignore
        docEl.webkitRequestFullscreen
      ) {
        // @ts-ignore
        await docEl.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen entry prevented:', err);
    }
  }

  /**
   * Exits fullscreen mode.
   * @returns {Promise<void>}
   */
  async exit() {
    try {
      if (document.exitFullscreen) {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } else if (
        // @ts-ignore
        document.webkitExitFullscreen
      ) {
        // @ts-ignore
        if (document.webkitFullscreenElement) {
          // @ts-ignore
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen exit error:', err);
    }
  }

  /**
   * Toggles between fullscreen and normal mode.
   * @returns {Promise<void>}
   */
  async toggle() {
    if (FullscreenManager.isFullscreen()) {
      await this.exit();
    } else {
      await this.enter();
    }
  }

  /**
   * Listens for fullscreen state changes across vendors.
   */
  initListener() {
    const handleEvent = () => {
      const active = FullscreenManager.isFullscreen();
      if (this.onChange) {
        this.onChange(active);
      }
    };

    document.addEventListener('fullscreenchange', handleEvent);
    document.addEventListener('webkitfullscreenchange', handleEvent);
  }
}
