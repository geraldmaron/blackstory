/**
 * Word-level voice checks for narrative prose, shared by every surface written under
 * docs/content/neo-voice.md (chapters, entries, Lives readings and accounts).
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
  readonly rule:
    | 'em-dash'
    | 'expanded-contraction'
    | 'self-reference'
    | 'page-pointer'
    | 'stock-phrase'
    | 'source-term'
    | 'negate-correct'
    | 'staccato-run';
  readonly label: string;
  /** The offending text with a little context on each side. */
  readonly excerpt: string;
};

/**
 * Publisher self-reference and sibling-chapter navigation. Moved here unchanged from the story
 * gate so stories and Lives answer to one list.
 */
export const SELF_REFERENCE_PATTERNS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
}[] = [
  {
    label: 'names the publishing surface',
    pattern:
      /\bthis (?:site\b(?! (?:of|since|where|in|at|was|that|when|for)\b)|website|project|page)\b/i,
  },
  {
    label: 'names the publishing surface',
    // "on the site of Chambers Hill" and "on the site since 1860" are geography, not the website.
    pattern:
      /\b(?:on|across|throughout) (?:the|our) site\b(?! (?:of|since|where|in|at|was|that|when|for)\b)/i,
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

/**
 * Neo's never-list items 1 and 2 (docs/content/neo-voice.md, "Who's telling it"): poster and
 * nomination-form language. Each pattern is narrow on purpose; "served as mayor" is plain English,
 * "served as the heart of" is a placard.
 */
const STOCK_PHRASES: readonly RegExp[] = [
  /\btrail-?blaz(?:er|ers|ing)\b/i,
  /\bpaved the way\b/i,
  /\bon the shoulders of\b/i,
  /\bbr(?:oke|eaking|eaks) (?:down )?barriers\b/i,
  /\brich (?:history|heritage|legacy|tapestry)\b/i,
  /\blegacy (?:lives|lived) on\b/i,
  /\bindelible\b/i,
  /\btestament to\b/i,
  /\bunsung heroe?s?\b/i,
  /\btapestry\b/i,
  /\bpivotal role\b/i,
  /\bthe (?:beating |commercial |cultural |social |spiritual )?heart of (?:the |a )?(?:Black\b|African American\b|community|neighborhood|city|town|district|movement|life)/i,
  /\b(?:serves|served|serving|stands|stood) as (?:a |an |the )?(?:headquarters|hub|center|centre|anchor|cornerstone|focal point|gathering place|symbol|reminder|beacon|testament)\b/i,
];

/**
 * Never-list item 5: the record keeper's vocabulary used as the narrator's own. Proper names and
 * official titles ("Negro Leagues", "Director of Negro Education") are allowed, so a following
 * capitalized word exempts the match.
 */
const SOURCE_TERMS: readonly RegExp[] = [
  /\b[Nn]egro(?:es)?\b(?!\s+(?:[A-Z]|leagues?\b))/,
  /\bcolored (?:people|persons|man|woman|men|women|children|families|residents|voters|citizens|doctors|teachers|students)\b/,
];

/** Never-list item 7: "He isn't asking for relief. He's naming an asset." */
const NEGATE_CORRECT =
  /\b(?:isn['’]t|wasn['’]t|aren['’]t|weren['’]t)\b[^.!?]{1,80}[.!?]\s+(?:It|He|She|They|That|This)(?:['’]s|['’]re| is| was| are| were)\b/;

/**
 * Never-list item 7: three or more consecutive sentences of two to four words, as a drumbeat.
 * One-word "sentences" are abbreviations and initials ("Dr.", "W. H."), so they break a run.
 */
function findStaccatoRun(text: string): { index: number; length: number } | null {
  // Initials and titles end in a period but don't end a sentence. Same length keeps indexes true.
  const unabbreviated = text.replace(
    /\b(?:[A-Z]|Dr|Mr|Mrs|Ms|Jr|Sr|St|Rev|Gen|Col|Capt|Lt|Sgt|No|Co|Inc|Ave|Mt|Ft|Bros|Vol)\./g,
    (match) => `${match.slice(0, -1)}_`,
  );
  const sentences = [...unabbreviated.matchAll(/[^.!?]+[.!?]+/g)];
  let runStart = -1;
  let runLength = 0;
  for (const [i, sentence] of sentences.entries()) {
    const words = sentence[0].trim().split(/\s+/).filter(Boolean).length;
    if (words >= 2 && words <= 4) {
      if (runLength === 0) runStart = i;
      runLength += 1;
      if (runLength >= 3) {
        const first = sentences[runStart]!;
        const last = sentences[i]!;
        return {
          index: first.index ?? 0,
          length: (last.index ?? 0) + last[0].length - (first.index ?? 0),
        };
      }
    } else {
      runLength = 0;
    }
  }
  return null;
}

/**
 * Removes quoted spans so testimony is never held to the narrator's rules. Single quotes count only
 * when they open after a space or bracket, so an apostrophe inside a word never starts a span.
 */
export function stripQuotedSpans(text: string): string {
  return stripCurlyQuotedSpans(text)
    .replace(/"[^"]*"/g, ' ')
    .replace(/(^|[\s(])['‘][^'‘’\n]{2,240}['’](?=[\s.,;:!?)]|$)/g, '$1 ');
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

  for (const pattern of STOCK_PHRASES) {
    const match = pattern.exec(narrated);
    if (!match) continue;
    findings.push({
      rule: 'stock-phrase',
      label: 'uses poster or nomination-form language instead of saying what happened',
      excerpt: excerptAround(narrated, match.index, match[0].length),
    });
    break;
  }

  for (const pattern of SOURCE_TERMS) {
    const match = pattern.exec(narrated);
    if (!match) continue;
    findings.push({
      rule: 'source-term',
      label: "uses the record keeper's term as the narrator's own; quote it or name the people",
      excerpt: excerptAround(narrated, match.index, match[0].length),
    });
    break;
  }

  const negate = NEGATE_CORRECT.exec(narrated);
  if (negate) {
    findings.push({
      rule: 'negate-correct',
      label: 'negates one claim only to assert another; say the second one plainly',
      excerpt: excerptAround(narrated, negate.index, negate[0].length),
    });
  }

  const staccato = findStaccatoRun(narrated);
  if (staccato) {
    findings.push({
      rule: 'staccato-run',
      label: 'runs three very short sentences together as a drumbeat',
      excerpt: excerptAround(narrated, staccato.index, staccato.length),
    });
  }

  return findings;
}
