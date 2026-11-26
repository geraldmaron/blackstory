/**
 * Deterministic checks on a record's public text before any of it goes to Sol, from findings Sol's
 * text review returned in the 2026-11-25 burn-down pilot. A problem holds the record from the
 * batch; a warning is printed and the record still goes to review. Measured against all live
 * records, only a lowercase display name is reliable enough to hold: a month with no year and an em
 * dash flagged dozens of correct records ("March on Washington", a man named July), so those warn,
 * and the month rule also lives in the drafting prompt.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
// "May" is also a verb, so only its unambiguous month uses count.
const MONTH_PATTERN = new RegExp(
  `\\b(?:${MONTHS.join('|')})\\b|\\b(?:in|of|early|late|mid-)\\s*May\\b`,
  'u',
);
const YEAR_PATTERN = /\b(?:1[5-9]|20)\d{2}\b/u;
const TIME_WORDS = /\b(?:now|currently|today|presently|nowadays)\b/iu;

export type PreReviewText = {
  readonly displayName: string;
  readonly summary: string;
  readonly historicalContext?: string | null;
};

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/u).filter((sentence) => sentence.trim().length > 0);
}

export function preReviewTextCheck(input: PreReviewText): {
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
} {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (/^[a-z]/u.test(input.displayName.trim())) {
    problems.push(`display name starts lowercase: "${input.displayName}"`);
  }
  for (const [field, text] of [
    ['summary', input.summary],
    ['historicalContext', input.historicalContext ?? ''],
  ] as const) {
    // House voice avoids em dashes, but hundreds of live records carry them: warn, never hold.
    if (text.includes('—')) warnings.push(`${field} contains an em dash`);
    // Only a field with no year anywhere: "on March 7" after a sentence naming 1965 is fine.
    const fieldHasYear = YEAR_PATTERN.test(text);
    for (const sentence of sentences(text)) {
      if (!fieldHasYear && MONTH_PATTERN.test(sentence)) {
        warnings.push(`${field} names a month and no year: "${sentence.slice(0, 120)}"`);
      }
      const timeWord = TIME_WORDS.exec(sentence);
      if (timeWord) {
        warnings.push(
          `${field} says "${timeWord[0]}"; check the source is current: "${sentence.slice(0, 120)}"`,
        );
      }
    }
  }
  return { problems, warnings };
}
