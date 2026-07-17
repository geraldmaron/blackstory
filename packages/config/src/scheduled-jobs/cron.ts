
/**
 * Minimal structural cron validation for the scheduled-job registry. Deliberately not a full
 * cron semantics engine (day-of-month overflow, leap years, etc.) needs to catch
 * malformed registry entries at register-time, not schedule real dispatches (no live GCP
 * mutation happens from this package; infra/gcp/scheduler/ is the declarative mirror actual
 * Cloud Scheduler jobs are built from after human review).
 */

const CRON_FIELD = /^(\*|\d+)(-\d+)?(\/\d+)?(,(\*|\d+)(-\d+)?(\/\d+)?)*$/;

/** Mirrors infra/firebase/backup/export-schedule.md's `firestore-export-on-release` pattern:
 * a job primarily triggered by a Pub/Sub event rather than wall-clock cron. */
export const EVENT_DRIVEN_CADENCE_SENTINEL = 'event-driven';

export function isValidCronExpression(expression: string): boolean {
  if (expression === EVENT_DRIVEN_CADENCE_SENTINEL) {
    return true;
  }
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every((field) => CRON_FIELD.test(field));
}

export function assertValidCronExpression(expression: string): void {
  if (!isValidCronExpression(expression)) {
    throw new Error(
      `Invalid cron expression "${expression}": expected 5 space-separated fields or the literal "${EVENT_DRIVEN_CADENCE_SENTINEL}"`,
    );
  }
}
