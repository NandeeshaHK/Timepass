import { WebHaptics } from 'web-haptics';

/**
 * Singleton WebHaptics instance supporting native Taptic Engine on iOS
 * and navigator.vibrate on Android / desktop.
 */
const haptics = typeof window !== 'undefined' ? new WebHaptics() : null;

/**
 * HapticUX: Semantic haptics library for web interfaces.
 * Maps UI interactions to distinct physical tactile feedback patterns.
 */
export const HapticUX = {
  /**
   * Checks if the client platform supports tactile feedback.
   * @returns {boolean}
   */
  isSupported: () => typeof window !== 'undefined' && (WebHaptics.isSupported || 'vibrate' in navigator),

  /**
   * Core trigger wrapper safely handling both navigator.vibrate and WebHaptics fallbacks.
   * @param {number[]} pattern - Vibration pattern array for Android/Chrome.
   * @param {'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'selection' | 'success' | 'error' | 'nudge'} [preset='light'] - Preset for iOS WebHaptics.
   */
  play: (pattern, preset = 'light') => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
      haptics?.trigger(preset);
    } catch {
      // Silently ignore if device/browser restrictions prevent vibration
    }
  },

  // --- THE CHARACTERS (Semantic Mappings) ---

  /** 1. Buttons: Crisp, confident, single tactile drop. */
  buttonTap: () => HapticUX.play([15], 'light'),

  /** 2. Menus: Soft expansion feel when opening drawers. */
  menuOpen: () => HapticUX.play([10, 30, 15], 'medium'),

  /** Soft collapse feel when closing drawers. */
  menuClose: () => HapticUX.play([15, 20, 10], 'soft'),

  /** 3. Slide Bars: Subtle continuous ticks as progress changes. */
  sliderTick: () => HapticUX.play([5], 'selection'),

  /** 4. Start / Page Start: An ascending, welcoming pulse. "Waking up." */
  pageStart: () => HapticUX.play([10, 50, 20, 50, 30], 'success'),

  /** 5. Ending / Page End: A dull, definitive thud hitting the bottom. "Boundary reached." */
  pageEnd: () => HapticUX.play([40], 'rigid'),

  /** 6. Back Trigger: A sharp, quick snap. Reversing an action. */
  backTrigger: () => HapticUX.play([20, 20, 20], 'medium'),

  /** 7. Selected: A satisfying, locking double-click. "Success." */
  selected: () => HapticUX.play([15, 50, 15], 'selection'),

  /** 8. Hover: Micro-interaction for touch drag. */
  hover: () => HapticUX.play([2], 'selection'),

  /** 9. Changing Fonts/Themes: A distinct rumble to acknowledge a global state change. */
  fontChange: () => HapticUX.play([20, 40, 10, 40, 20], 'nudge')
};
