/**
 * Public read/search/location API entrypoint (Cloud Run target).
 * Surface separation and hardening land in BB-021+.
 */
import { parseNodeEnv } from '@black-book/config';

export function health() {
  return {
    service: 'api-public',
    status: 'ok' as const,
    env: parseNodeEnv(process.env.NODE_ENV),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(health()));
}
