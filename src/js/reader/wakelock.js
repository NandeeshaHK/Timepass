/**
 * Screen WakeLock Controller to prevent device sleep during reading
 */

let wakeLockSentinel = null;

export const WakeLockManager = {
  async request() {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      } catch (err) {
        console.warn('Wake Lock request ignored/failed:', err);
      }
    }
  },

  async release() {
    if (wakeLockSentinel !== null) {
      try {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      } catch (err) {
        console.warn('Error releasing Wake Lock:', err);
      }
    }
  },

  initVisibilityListener(isReadingActive) {
    document.addEventListener('visibilitychange', async () => {
      if (wakeLockSentinel !== null && document.visibilityState === 'visible' && isReadingActive()) {
        await this.request();
      }
    });
  }
};
