/** Field checks shared by the public forms. Each says what is wrong in a way that says how to fix it. */

/** A field's submitted text, trimmed. */
export function fieldText(data: FormData, name: string): string {
  return String(data.get(name) ?? '').trim();
}

/** A full https:// address, which is what the intake accepts as a source. */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Loose on purpose: an @ with something either side and a dot in the domain. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const URL_MESSAGE =
  'Use the full address, starting with https://. Copy it from the browser’s address bar.';

export const EMAIL_MESSAGE =
  'Check the email address. It needs an @ and a domain, like name@example.org. Or leave it blank.';
