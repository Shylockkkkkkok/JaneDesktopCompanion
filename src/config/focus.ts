export const FOCUS_CONFIG = {
  // Preset durations offered in the tray menu (minutes).
  presetMinutes: [25, 50, 90] as const,
  defaultMinutes: 25,
  // Timer tick interval (ms).
  tickIntervalMs: 1000,
  // How long the completion reaction holds (ms) — a restrained burst.
  completionReactionMs: 1500,
  // How long the completion popup image stays visible (ms).
  completionPopupMs: 3000,
  // After the completion popup closes, the character shows the focus_com
  // reward image for this long before returning to the normal look.
  completionPhotoMs: 3000,
} as const;
