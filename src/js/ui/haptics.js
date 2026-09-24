/**
 * HapticUX: A semantic haptics library for web interfaces.
 * Maps UI interactions to distinct physical tactile feedback patterns using navigator.vibrate.
 */
export const HapticUX = {
  /**
   * Checks if the current client platform supports the Web Vibration API.
   * @returns {boolean}
   */
  isSupported: () => typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator,

  /**
   * Core trigger wrapper safely handling browser permission limits.
   * @param {number | number[]} pattern - Vibration duration in ms or pattern array [vibrate, pause, vibrate...].
   */
  play: (pattern) => {
    if (HapticUX.isSupported()) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Silently ignore if permissions policy or user gesture restrictions block vibration
      }
    }
  },

  // --- THE CHARACTERS (Semantic Mappings) ---

  /** 1. Buttons: Crisp, confident, single tactile drop. */
  buttonTap: () => HapticUX.play([15]),

  /** 2. Menus: A soft expansion feel. Like opening a physical drawer. */
  menuOpen: () => HapticUX.play([10, 30, 15]),

  /** Soft collapse feel for closing drawers/modals. */
  menuClose: () => HapticUX.play([15, 20, 10]),

  /** 3. Slide Bars (Sliders): Extremely subtle, continuous "ticks" as the value changes. */
  sliderTick: () => HapticUX.play([5]),

  /** 4. Start / Page Start: An ascending, welcoming pulse. "Waking up." */
  pageStart: () => HapticUX.play([10, 50, 20, 50, 30]),

  /** 5. Ending / Page End: A dull, definitive thud hitting the bottom. "Boundary reached." */
  pageEnd: () => HapticUX.play([40]),

  /** 6. Back Trigger: A sharp, quick snap. Reversing an action. */
  backTrigger: () => HapticUX.play([20, 20, 20]),

  /** 7. Selected (Toggles/Checkboxes): A satisfying, locking double-click. "Success." */
  selected: () => HapticUX.play([15, 50, 15]),

  /** 8. Hovering: Micro-interaction (primarily for touch-drag transitions). */
  hover: () => HapticUX.play([2]),

  /** 9. Changing Fonts/Themes: A playful, distinct rumble to acknowledge a global state change. */
  fontChange: () => HapticUX.play([20, 40, 10, 40, 20])
};
