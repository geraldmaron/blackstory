/**
 * Word-level voice checks for narrative prose, shared by every surface written under
 * docs/content/neo-voice.md (chapters, articles, Lives readings and accounts).
 *
 * The voice document has long said "a grep gate enforces" contractions and em dashes. This module
 * is that gate. It checks only what a pattern can decide without judgment: the never-list's
 * word-level items and the standalone-prose rule. Register, claim typing and the three structural
 * laws stay with prose review.
 *
 * Quoted material is never checked. A quotation is testimony and stays verbatim, so text inside
 * double quotation marks (curly or straight) is removed before any pattern runs.
 */

export type ProseVoiceFinding = {
  /** Stable id for the rule, for tests and reports. */
  readonly rule: 'em-dash' | 'expanded-contraction' | 'self-reference' | 'page-pointer';
  readonly label: string;
  /** The offending text with a little context on each side. */
  readonly excerpt: string;
};

/**
 * Publisher self-reference and sibling-chapter navigation. Moved here unchanged from the article
 * gate so articles and Lives answer to one list.
 */
export const SELF_REFERENCE_PATTERNS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
}[] = [
  { label: 'names the publishing surface', pattern: /\bthis (?:site|website|project|page)\b/i },
  {
    label: 'names the publishing surface',
    pattern: /\b(?:on|across|throughout) (?:the|our) site\b/i,
  },
  {
    label: 'cross-references a sibling chapter',
    pattern: /\b(?:another|the other|a sibling|the next|the previous) chapters?\b/i,
  },
  { label: 'cross-references a sibling chapter', pattern: /\bchapters? (?:here|on this)\b/i },
  {
    label: 'cross-references a sibling chapter',
    pattern: /\bthe (?:wealth|redlining|housing|voting|sentencing) chapter\b/i,
  },
  {
    label: "speaks in the publisher's first person",
    pattern: /\b(?:we|our) (?:are telling|tell|show|summari[sz]e|built|collected|assembled)\b/i,
  },
  {
    label: "speaks in the publisher's first person",
    pattern: /\b(?:our summary|needs us in order|we are telling you)\b/i,
  },
];

/**
 * Prose that steers the reader around the page ("the percentages below", "pictured above",
 * "before reading the figures"). Standalone prose describes history, not layout.
 */
const PAGE_POINTER_PATTERNS: readonly RegExp[] = [
  /\b(?:percentages?|figures?|numbers?|categories|tables?|charts?|panels?|sections?|students|people|pictured|shown|listed) (?:pictured |shown |listed )?(?:below|above)\b/i,
  /\bbefore reading\b/i,
];

/** Negative contractions only: the set the voice document names, and the set with no false positives. */
const EXPANDED_CONTRACTION =
  /\b(?:(?:do|does|did|is|are|was|were|has|have|had|will|would|could|should) not|cannot|can not)\b/i;

const EM_DASH = /—/;

/** Removes quoted spans so testimony is never held to the narrator's rules. */
export function stripQuotedSpans(text: string): string {
  return stripCurlyQuotedSpans(text).replace(/"[^"]*"/g, ' ');
}

/**
 * Same result as replacing /“[^”]*”/g, by index scan. The regex rescans to the end of the text from
 * every unclosed opening mark, which is quadratic on a run of them (CodeQL js/polynomial-redos).
 * An opening mark still reaches the first closing mark after it, so a quotation that reopens on
 * each paragraph and closes once is stripped whole.
 */
function stripCurlyQuotedSpans(text: string): string {
  let stripped = '';
  let cursor = 0;
  for (;;) {
    const open = text.indexOf('“', cursor);
    const close = open === -1 ? -1 : text.indexOf('”', open + 1);
    if (close === -1) return stripped + text.slice(cursor);
    stripped += `${text.slice(cursor, open)} `;
    cursor = close + 1;
  }
}

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  return text
    .slice(start, index + length + 40)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every word-level voice finding in one passage of narrative prose. Empty means clean. */
export function findProseVoiceIssues(text: string): readonly ProseVoiceFinding[] {
  const narrated = stripQuotedSpans(text);
  const findings: ProseVoiceFinding[] = [];

  const dash = EM_DASH.exec(narrated);
  if (dash) {
    findings.push({
      rule: 'em-dash',
      label: 'uses an em dash in narrative prose',
      excerpt: excerptAround(narrated, dash.index, 1),
    });
  }

  const contraction = EXPANDED_CONTRACTION.exec(narrated);
  if (contraction) {
    findings.push({
      rule: 'expanded-contraction',
      label: 'expands a contraction the voice says aloud',
      excerpt: excerptAround(narrated, contraction.index, contraction[0].length),
    });
  }

  for (const { label, pattern } of SELF_REFERENCE_PATTERNS) {
    const match = pattern.exec(narrated);
    if (!match) continue;
    findings.push({
      rule: 'self-reference',
      label,
      excerpt: excerptAround(narrated, match.index, match[0].length),
    });
    break;
  }

  for (const pattern of PAGE_POINTER_PATTERNS) {
    const match = pattern.exec(narrated);
    if (!match) continue;
    findings.push({
      rule: 'page-pointer',
      label: 'points the reader around the page instead of at the history',
      excerpt: excerptAround(narrated, match.index, match[0].length),
    });
    break;
  }

  return findings;
}
