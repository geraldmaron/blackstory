/**
 * Reads Internet Archive SPN2 S3 keys from env. Missing or blank keys mean Wayback
 * anchoring is skipped; local capture still runs.
 */
import type { SpnCredentials } from '@repo/domain';

export const INTERNET_ARCHIVE_ACCESS_KEY_ENV = 'INTERNET_ARCHIVE_ACCESS_KEY' as const;
export const INTERNET_ARCHIVE_SECRET_KEY_ENV = 'INTERNET_ARCHIVE_SECRET_KEY' as const;

/** Returns SPN credentials when both env keys are non-empty; otherwise undefined. */
export function waybackCredentialsFromEnv(
  env: Record<string, string | undefined>,
): SpnCredentials | undefined {
  const accessKey = env[INTERNET_ARCHIVE_ACCESS_KEY_ENV]?.trim() ?? '';
  const secretKey = env[INTERNET_ARCHIVE_SECRET_KEY_ENV]?.trim() ?? '';
  if (!accessKey || !secretKey) return undefined;
  return { accessKey, secretKey };
}
