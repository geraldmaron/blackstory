/**
 * First-paint pin disc sizes. Values mirror `--ds-first-paint-pin-*` custom properties in
 * `first-paint-pin-plate.css`. Tests import this module to catch CSS drift.
 */
export const FIRST_PAINT_PIN_SIZE_REM = {
  national: {
    record: '0.4375rem',
    link: '0.5rem',
    walk: '0.5625rem',
    focus: '0.875rem',
  },
} as const;

/** MapLibre HTML hit-target — matches largest first-paint walk disc (`0.5625rem` @ 16px). */
export const MAP_ENTITY_MARKER_HIT_PX = 9;

/** Record locator inset pin — copper ring at city-precision honesty scale. */
export const RECORD_LOCATOR_PIN_PX = 11;
