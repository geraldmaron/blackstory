/** Validates cadence metadata; this module neither installs nor dispatches schedules. */

const CRON_FIELD = /^(\*|\d+)(-\d+)?(\/\d+)?(,(\*|\d+)(-\d+)?(\/\d+)?)*$/;

/** Marks a job triggered by an explicit event rather than a clock. */
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
