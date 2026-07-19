/**
 * Candidate URL chain for entity mast photos when the published URL fails.
 * Tries extension swaps on GCS primary.* paths, then gives up for the record mark.
 */

const PRIMARY_BASENAME = /\/primary\.(jpe?g|png|webp|gif|avif)$/i;

/** Preferred alternate extensions after the published one (jpeg normalized to jpg). */
const EXTENSION_FALLBACKS = ['jpg', 'png', 'webp'] as const;

function normalizeExt(ext: string): string {
  const lower = ext.toLowerCase();
  return lower === 'jpeg' ? 'jpg' : lower;
}

/**
 * Build ordered unique URLs to attempt for a published primary image.
 * Empty / whitespace URLs yield an empty list (caller shows the record mark).
 */
export function buildEntityMastImageCandidates(primaryUrl: string): readonly string[] {
  const trimmed = primaryUrl.trim();
  if (!trimmed) {
    return [];
  }

  const out: string[] = [trimmed];
  const match = PRIMARY_BASENAME.exec(trimmed);
  if (!match) {
    return out;
  }

  const currentExt = normalizeExt(match[1]!);
  const base = `${trimmed.slice(0, match.index)}/primary.`;

  for (const ext of EXTENSION_FALLBACKS) {
    if (ext === currentExt) {
      continue;
    }
    const candidate = `${base}${ext}`;
    if (!out.includes(candidate)) {
      out.push(candidate);
    }
  }

  return out;
}
