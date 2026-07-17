/**
 * Safe Content-Disposition header builder (BB-028).
 * Prevents header injection and path traversal in downloaded filenames.
 */

const CONTROL_OR_SEPARATOR = /[\u007F\\/:"<>|?*]/g;

function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f) return true;
  }
  return false;
}

/** Sanitize a filename for Content-Disposition (no path segments or control chars). */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'download';
  const withoutControl = [...base]
    .filter((char) => char.charCodeAt(0) > 0x1f)
    .join('');
  const stripped = withoutControl.replace(CONTROL_OR_SEPARATOR, '_').trim();
  const collapsed = stripped.replace(/_+/g, '_');
  return collapsed.length > 0 ? collapsed.slice(0, 255) : 'download';
}

export type ContentDispositionOptions = {
  inline?: boolean;
};

/**
 * Build a safe Content-Disposition header value.
 * Uses quoted filename plus RFC 5987 filename* for UTF-8 names.
 */
export function buildSafeContentDisposition(
  filename: string,
  options: ContentDispositionOptions = {},
): string {
  const safeName = sanitizeFilename(filename);
  const disposition = options.inline ? 'inline' : 'attachment';
  const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, '_');
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

/** Reject values that could break out of the header (CRLF injection). */
export function assertSafeContentDispositionValue(value: string): void {
  if (value.includes('\r') || value.includes('\n') || containsControlCharacters(value)) {
    throw new Error('Content-Disposition value must not contain CR or LF.');
  }
}
