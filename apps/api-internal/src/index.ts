/**
 * Internal publication, promotion, and control API (not internet-facing).
 * Must remain inaccessible from public ingress (BB-021).
 */
import { parseNodeEnv } from '@black-book/config';

export function health() {
  return {
    service: 'api-internal',
    status: 'ok' as const,
    env: parseNodeEnv(process.env.NODE_ENV),
  };
}
