/**
 * First-paint pin disc sizes. Values mirror `--ds-first-paint-pin-*` custom properties in
 * `first-paint-pin-plate.css`. Tests import this module to catch CSS drift.
 */
export const FIRST_PAINT_PIN_SIZE_REM = {
  national: {
    record: '0.4375rem',
  },
} as const;

/** Record locator inset pin — copper ring at city-precision honesty scale. */
export const RECORD_LOCATOR_PIN_PX = 11;
