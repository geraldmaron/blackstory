/**
 * First-paint pin disc sizes. Values mirror `--ds-first-paint-pin-*` custom properties in
 * `first-paint-pin-plate.css`. Tests import this module to catch CSS drift.
 */
export const FIRST_PAINT_PIN_SIZE_REM = {
  national: {
    record: '0.4375rem',
  },
} as const;
