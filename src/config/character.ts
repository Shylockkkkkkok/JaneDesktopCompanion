/**
 * Central place for tunable constants. Avoid scattering magic numbers.
 * Times are in milliseconds unless noted otherwise.
 */
export const CHARACTER_CONFIG = {
  windowWidth: 380,
  windowHeight: 450,

  // Character display height in px at 100% scale. The image keeps its
  // original aspect ratio; width is derived automatically.
  defaultHeight: 306,

  minScale: 0.8,
  maxScale: 1.5,
  defaultScale: 1.0,

  // How long the cursor must hover before a hover dialogue may appear.
  hoverDialogueDelay: 2000,

  // Speech bubble auto-hide window.
  speechDurationMin: 3000,
  speechDurationMax: 5000,

  // Rapid-click counter resets after this much inactivity.
  rapidClickResetTime: 2500,

  // Idle animation scheduling window (randomised).
  idleIntervalMin: 8000,
  idleIntervalMax: 20000,
  idleAnimationDurationMin: 500,
  idleAnimationDurationMax: 2000,

  // Duration of a click reaction (must match the CSS animation length).
  reactionDuration: 700,

  // Mouse movement (CSS px) before a mousedown becomes a window drag rather
  // than a click. Distinguishes drag from click.
  dragThreshold: 5,

  // Cross-fade duration when the pose/look photo changes (restrained).
  crossFadeMs: 250,

  // Vertical offset of the speech bubble's bottom relative to the character's
  // top edge, in px. Negative = below the top (bubble sits a bit lower).
  bubbleOffsetY: -20,

  // Status toast (mode switch indicator) duration.
  statusToastDuration: 1000,
} as const;
