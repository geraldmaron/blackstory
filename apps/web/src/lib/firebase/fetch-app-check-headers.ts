/**
 * Shared App Check header fetch with a hard timeout so public locate/search flows never
 * hang when reCAPTCHA Enterprise is blocked (CSP) or slow. Fail open to `{}` — server
 * guards run in monitor mode until enforce is deliberately enabled.
 */
import { getToken, type AppCheck } from 'firebase/app-check';

export const APP_CHECK_HEADER_FETCH_TIMEOUT_MS = 8_000;

export type AppCheckTokenFetcher = (
  appCheck: AppCheck,
) => Promise<{ readonly token: string }>;

export async function fetchAppCheckHeaders(
  appCheck: AppCheck | undefined,
  timeoutMs: number = APP_CHECK_HEADER_FETCH_TIMEOUT_MS,
  fetchToken: AppCheckTokenFetcher = getToken,
): Promise<Readonly<Record<string, string>>> {
  if (!appCheck) return {};
  try {
    const result = await Promise.race([
      fetchToken(appCheck),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('app_check_token_timeout')), timeoutMs);
      }),
    ]);
    return { 'X-Firebase-AppCheck': result.token };
  } catch {
    return {};
  }
}
