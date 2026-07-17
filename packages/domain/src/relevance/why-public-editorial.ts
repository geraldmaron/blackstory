/**
 * editorial check: passive-euphemism scan for public "why this appears" prose (
 * Deliver #3). Mirrors the existing, adjacent editorial-guard pattern already used for advisory
 * copy (`PROHIBITED_ADVISORY_LANGUAGE` `assertProceduralAdvisoryLanguage`,../advisory.js) and
 * identity-attribute framing (`assertNoIdentityAttributeFraming`,../disclaimers.js), but targets
 * a different failure mode: agentless, euphemistic phrasing that launders documented harm
 * (violence, enslavement, discrimination) into vague language with no named actor or action
 * ("an incident occurred", "tensions arose") rather than describing what is actually documented.
 * `../advisory.js`'s `PROHIBITED_ADVISORY_LANGUAGE` targets danger-framing tone; this list targets
 * passive-voice euphemism specifically and is checked separately because the two failure modes
 * (and their approved-language fixes) are different.
 */

/**
 * Non-exhaustive by design a coarse, reviewable phrase list rather than a passive-voice parser.
 * False negatives (an euphemism this list misses) are the accepted failure mode; the list is
 * extended as editorial review finds new instances, the same discipline `unsupportedProceduralLanguage`
 * (packages/schemas/constitution/policy.v1.json) uses for its own banned-phrase list.
 */
export const PASSIVE_EUPHEMISM_PHRASES = [
  'an incident occurred',
  'an incident took place',
  'tensions arose',
  'tensions escalated',
  'the situation escalated',
  'an altercation took place',
  'an altercation occurred',
  'unrest occurred',
  'unrest broke out',
  'was affected by',
  'was impacted by',
  'was let go',
  'faced difficulties',
  'underwent hardship',
  'was involved in an incident',
  'encountered resistance from authorities',
  'was subjected to treatment',
  'events took a turn',
  'circumstances arose',
] as const;

export type PassiveEuphemismPhrase = (typeof PASSIVE_EUPHEMISM_PHRASES)[number];

export type EditorialFinding = {
  readonly phrase: PassiveEuphemismPhrase;
  readonly index: number;
};

/** Non-throwing scan returns every matched phrase and its position, for review tooling and
 * tests. Case-insensitive; matches are reported against the original (non-lowercased) `text`. */
export function findPassiveEuphemisms(text: string): readonly EditorialFinding[] {
  const normalized = text.toLowerCase();
  const findings: EditorialFinding[] = [];
  for (const phrase of PASSIVE_EUPHEMISM_PHRASES) {
    const index = normalized.indexOf(phrase);
    if (index !== -1) {
      findings.push({ phrase, index });
    }
  }
  return findings;
}

/** Fails closed: throws on the first passive-euphemism match found. Public "why this appears"
 * prose must name the documented actor/action rather than launder it into agentless phrasing. */
export function assertNoPassiveEuphemisms(text: string): void {
  const findings = findPassiveEuphemisms(text);
  if (findings.length > 0) {
    const phrases = findings.map((finding) => `"${finding.phrase}"`).join(', ');
    throw new Error(
      `Public "why this appears" prose must not use passive-euphemism phrasing (found ${phrases}) — ` +
        'name the documented actor and action instead of laundering it into agentless language.',
    );
  }
}
