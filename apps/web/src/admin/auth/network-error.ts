/**
 * Browser fetch failures that never reached a server. Each engine words them differently, and
 * supabase-js passes the raw text through, so without this the login form shows "Failed to fetch".
 */
const NETWORK_FAILURE_MESSAGES = [
  /failed to fetch/i, // Chromium
  /networkerror when attempting to fetch resource/i, // Firefox
  /^load failed$/i, // Safari
  /network request failed/i,
];

export const ADMIN_NETWORK_FAILURE_MESSAGE =
  'Could not reach the sign-in service. Check your connection, and turn off any content ' +
  'blocker or VPN that might block supabase.co, then try again.';

export function isNetworkFailureMessage(message: string | undefined | null): boolean {
  const text = message?.trim();
  if (!text) return false;
  return NETWORK_FAILURE_MESSAGES.some((pattern) => pattern.test(text));
}
