/**
 * Corrections and contribution intake API entrypoint (Cloud Run target).
 * Quarantine and promotion boundaries land in BB-029 / BB-032.
 */
import { parseNodeEnv } from '@black-book/config';

export function health() {
  return {
    service: 'api-submissions',
    status: 'ok' as const,
    env: parseNodeEnv(process.env.NODE_ENV),
  };
}
