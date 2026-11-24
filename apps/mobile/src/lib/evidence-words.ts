/**
 * An evidence grade in words (docs/ui/PROTECTED-EXPERIENCES.md, DESIGN.md section 7.3: a grade is
 * words and a glyph, never a letter). The phrases are the web's `confidenceTierPhrase`
 * (apps/web/src/lib/evidence/confidence-language.ts); a test holds the two together.
 *
 * shortcut: the shared `@repo/public-contracts/evidence` labels still print "Grade A", which the
 * web splits apart for its fixed citation string. Move these phrases there, and delete this
 * file, when the web can take the change in the same commit.
 */
const PHRASE: Readonly<Record<string, string>> = {
  high: 'Well evidenced',
  medium: 'Partly evidenced',
  low: 'Thinly evidenced',
};

function withSources(head: string, separator: string, sourceCount?: number): string {
  if (typeof sourceCount !== 'number' || !Number.isFinite(sourceCount) || sourceCount < 0) {
    return head;
  }
  return `${head}${separator}${sourceCount === 1 ? '1 source' : `${sourceCount} sources`}`;
}

/** The visible label: "Well evidenced · 2 sources", or "Not graded". */
export function evidenceLabel(tier: string, sourceCount?: number): string {
  return withSources(PHRASE[tier] ?? 'Not graded', ' · ', sourceCount);
}

/** The spoken label: "Well evidenced, 2 sources". */
export function evidenceMeterLabel(tier: string, sourceCount?: number): string {
  return withSources(PHRASE[tier] ?? 'Not graded', ', ', sourceCount);
}
