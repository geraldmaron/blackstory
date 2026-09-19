/** Browser-safe normalization and exact-source Wayback pointer validation. */
export function normalizeCitationUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.protocol = parsed.protocol.toLowerCase();
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseWaybackCaptureUrl(
  raw: string,
  targetUrl?: string,
): { url: string; timestamp: string; sourceUrl: string; capturedAt: string } | null {
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname !== 'web.archive.org' ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const match = /^\/web\/(\d{14})(?:id_|if_|im_)?\/(https?:\/\/.+)$/.exec(
      url.pathname + url.search,
    );
    if (!match) return null;
    const timestamp = match[1]!;
    const iso = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}.000Z`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.toISOString() !== iso) return null;
    const rawSource = new URL(match[2]!);
    if (rawSource.username || rawSource.password) return null;
    const source = normalizeCitationUrl(rawSource.toString());
    if (source === null) return null;
    if (targetUrl !== undefined && source !== normalizeCitationUrl(targetUrl)) return null;
    url.protocol = 'https:';
    return { url: url.toString(), timestamp, sourceUrl: source, capturedAt: iso };
  } catch {
    return null;
  }
}
