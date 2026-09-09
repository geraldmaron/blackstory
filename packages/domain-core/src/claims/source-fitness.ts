/**
 * Claim-relative source fitness: whether a KIND of document can support a KIND of assertion.
 *
 * The research profile has declared a (sourceClass, claimClass) -> fitness table since the
 * kernel shipped, and nothing has ever read it at scoring time. Authority was a property of the
 * host alone: a `.gov` URL scored 0.95 for every claim ever attached to it. That is the defect
 * this module closes, and the reason it matters is easiest to see on a patent.
 *
 * A patent specification is the best possible evidence that particular people filed a
 * particular mechanism on a particular date. It is NOT evidence that any of them was Black —
 * the Patent Office did not record inventor race, which is exactly why Henry E. Baker had to
 * identify Black inventors through correspondence and professional networks. It is not evidence
 * that the device sold, mattered, or came first. Same document, same host, same authority score
 * under the old rule; five different answers under this one.
 *
 * Fitness is not a score. It is a statement about what a document can be asked. Callers turn it
 * into a number with `sourceAuthorityForFitness`, and `unfit` is a floor of zero rather than a
 * small number, because a patent contributes nothing at all toward a racial-identity claim and
 * should not be able to accumulate into one alongside other unfit sources.
 */

/**
 * Kinds of document, as evidence.
 *
 * These describe what a document IS, which is not the same as who published it. A patent
 * specification is a patent specification whether it is read at the Patent Office or at a
 * mirror, and an institutional biography on a museum site is not the museum's object record.
 */
export const SOURCE_CLASSES = [
  'patent_specification',
  'patent_application',
  'patent_assignment_record',
  'patent_file_wrapper',
  'patent_interference_record',
  'government_technical_report',
  'archival_manuscript',
  'archival_finding_aid',
  'institutional_biography',
  'museum_object_record',
  'museum_curatorial_history',
  'contemporaneous_newspaper',
  'contemporaneous_trade_press',
  'company_record',
  'court_record',
  'census_or_vital_record',
  'oral_history',
  'peer_reviewed_scholarship',
  'scholarly_book_or_history',
  'historical_compilation',
  'modern_reputable_secondary',
  'wikipedia_bridge',
  'wikidata_bridge',
  'search_result_lead',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

/**
 * Kinds of assertion, by what a claim is actually asking the reader to believe.
 *
 * This is deliberately about the CONTENT of the assertion, not its risk tier. The constitution's
 * ClaimClass ('standard' | 'high_impact') answers a different question — how much corroboration
 * a claim needs — and both are needed: `invention_attribution` is high_impact AND is the kind of
 * thing a patent can only partly answer.
 */
export const ASSERTION_CLASSES = [
  /** Names, numbers and dates as a record states them. "US 252,386 was granted in 1882." */
  'record_fact',
  /** That a named person is the person in the record. Technical identity. */
  'technical_identity',
  /** That a person belongs in a Black-history corpus. Never inferable from a technical record. */
  'community_identity',
  /** What a device or process does, and the bounds of that mechanism. */
  'technical_scope',
  /** That a person invented, co-invented, improved or developed something. High impact. */
  'invention_attribution',
  /** First, only, earliest, largest. High impact, and scope-sensitive. */
  'superlative',
  /** That something was adopted, sold, licensed or manufactured at some scale. */
  'commercial_impact',
  /** That something changed society, an industry, or people's lives. */
  'societal_impact',
  /** Ordinary life facts: born, worked, studied, moved. */
  'biographical_fact',
  /** When something happened, and in what order. */
  'chronology',
  /** Where something happened, at the precision claimed. */
  'place',
  /** That two entities stand in a stated relation. */
  'relationship',
  /** What a law, ruling or instrument legally did. */
  'legal_status',
  /** First-person experience and local memory. */
  'lived_experience',
  /** An interpretive account tying evidence into a historical argument. */
  'historical_synthesis',
] as const;
export type AssertionClass = (typeof ASSERTION_CLASSES)[number];

/**
 * How well a source class can answer an assertion class.
 *
 * Matches the vocabulary the research profile already uses, so a profile rule and a code rule
 * say the same words.
 *  authoritative — the document decides the question.
 *  strong        — good evidence; corroboration is a nicety, not a necessity.
 *  conditional   — usable, but its known failure modes apply and must be weighed.
 *  leadOnly      — tells you where to look. Never acceptance on its own.
 *  unfit         — cannot answer this question at all, however many copies there are.
 */
export const FITNESS_LEVELS = [
  'authoritative',
  'strong',
  'conditional',
  'leadOnly',
  'unfit',
] as const;
export type Fitness = (typeof FITNESS_LEVELS)[number];

export type FitnessAssessment = {
  readonly fitness: Fitness;
  /** Why, in one sentence an operator can act on. */
  readonly rationale: string;
  /** Known failure modes that apply even when the fitness is strong. */
  readonly limitations: readonly string[];
};

/** The authority component a source contributes for the claim it is actually attached to. */
export function sourceAuthorityForFitness(fitness: Fitness): number {
  switch (fitness) {
    case 'authoritative':
      return 1;
    case 'strong':
      return 0.85;
    case 'conditional':
      return 0.55;
    case 'leadOnly':
      return 0.2;
    case 'unfit':
      // Zero, not "small". Ten unfit sources must not accumulate into a supported claim.
      return 0;
  }
}

/** True for the kinds of source that may carry a claim but never corroborate one. */
export function isBridgeSourceClass(sourceClass: SourceClass): boolean {
  return (
    sourceClass === 'wikipedia_bridge' ||
    sourceClass === 'wikidata_bridge' ||
    sourceClass === 'search_result_lead'
  );
}

type FitnessRow = Partial<Record<AssertionClass, Fitness>> & { readonly default: Fitness };

const LIMITATIONS: Partial<Record<SourceClass, readonly string[]>> = {
  patent_specification: [
    'Records inventors as filed, which is not always who did the work',
    'Describes the claimed mechanism only; it does not bound the wider technology',
    'The inventor address is an address at filing, not where invention occurred',
  ],
  patent_application: ['An application is not a grant; claims may narrow or be refused'],
  contemporaneous_newspaper: [
    'Period racial prejudice shapes both coverage and omission',
    'Promotional copy is often printed as reporting',
    'Technical detail is frequently misunderstood',
  ],
  contemporaneous_trade_press: [
    'Advertising and editorial are not always separable',
    'Adoption claims may be a manufacturer restating itself',
  ],
  historical_compilation: [
    'Compilations inherit the gaps of the moment they were made',
    'Baker-era lists are known to be incomplete, and the incompleteness is itself evidence',
  ],
  oral_history: ['Identity, chronology, coordination and copying require review'],
  census_or_vital_record: [
    'Enumerator-recorded race reflects the enumerator, and must be handled under the dignity rules',
    'Names, ages and spellings are frequently wrong',
  ],
  institutional_biography: [
    'Synthesises rather than documents; the underlying evidence may not be cited',
    'A superlative here is only as good as the research the institution actually did',
  ],
  museum_curatorial_history: ['Curatorial framing selects for narrative significance'],
  company_record: ['Self-interested on adoption, priority and credit'],
  modern_reputable_secondary: [
    'Frequently restates other secondary sources without checking them',
    'The common carrier of invention myths',
  ],
  wikipedia_bridge: ['A bridge to its own references; never corroboration'],
  wikidata_bridge: ['A discovery graph; an edge is a candidate, not a finding'],
  search_result_lead: ['Tells you where to look and nothing more'],
};

/**
 * The fitness table.
 *
 * Each row gives a default plus the assertion classes where that document kind is better or
 * worse than its default. The rows that carry the most weight are the patent rows, because they
 * are where the difference between "who filed this" and "who was this person" lives.
 */
const FITNESS_TABLE: Readonly<Record<SourceClass, FitnessRow>> = {
  patent_specification: {
    default: 'conditional',
    record_fact: 'authoritative',
    technical_scope: 'authoritative',
    technical_identity: 'strong',
    chronology: 'strong',
    // The Patent Office did not record inventor race. A patent cannot answer this at all.
    community_identity: 'unfit',
    // A patent is a grant, not a finding of priority over the whole field.
    superlative: 'unfit',
    invention_attribution: 'conditional',
    commercial_impact: 'unfit',
    societal_impact: 'unfit',
    // The address on the face of a patent is where the filer was, not where the work happened.
    place: 'leadOnly',
  },
  patent_application: {
    default: 'conditional',
    record_fact: 'strong',
    technical_scope: 'strong',
    community_identity: 'unfit',
    superlative: 'unfit',
    commercial_impact: 'unfit',
    societal_impact: 'unfit',
  },
  patent_assignment_record: {
    default: 'conditional',
    record_fact: 'authoritative',
    relationship: 'strong',
    commercial_impact: 'conditional',
    community_identity: 'unfit',
    superlative: 'unfit',
  },
  patent_file_wrapper: {
    default: 'strong',
    record_fact: 'authoritative',
    invention_attribution: 'strong',
    technical_scope: 'authoritative',
    community_identity: 'unfit',
    superlative: 'conditional',
  },
  patent_interference_record: {
    default: 'strong',
    // An interference is the Patent Office adjudicating priority, which is what a
    // firstness claim is actually about.
    superlative: 'strong',
    invention_attribution: 'strong',
    record_fact: 'authoritative',
    community_identity: 'unfit',
  },
  government_technical_report: {
    default: 'strong',
    record_fact: 'authoritative',
    technical_scope: 'authoritative',
    community_identity: 'leadOnly',
    superlative: 'conditional',
    societal_impact: 'conditional',
  },
  archival_manuscript: {
    default: 'strong',
    lived_experience: 'authoritative',
    biographical_fact: 'strong',
    community_identity: 'strong',
    relationship: 'strong',
    superlative: 'conditional',
    societal_impact: 'conditional',
  },
  archival_finding_aid: {
    default: 'conditional',
    record_fact: 'strong',
    relationship: 'conditional',
    superlative: 'leadOnly',
    technical_scope: 'leadOnly',
  },
  institutional_biography: {
    default: 'strong',
    community_identity: 'strong',
    biographical_fact: 'strong',
    historical_synthesis: 'strong',
    // An institution's own researched superlative counts; this is the class the standing rule
    // means by "institutional support for a superlative".
    superlative: 'conditional',
    technical_scope: 'conditional',
    record_fact: 'conditional',
  },
  museum_object_record: {
    default: 'strong',
    record_fact: 'authoritative',
    technical_scope: 'strong',
    community_identity: 'conditional',
    superlative: 'conditional',
  },
  museum_curatorial_history: {
    default: 'strong',
    historical_synthesis: 'strong',
    community_identity: 'strong',
    superlative: 'conditional',
    technical_scope: 'conditional',
  },
  contemporaneous_newspaper: {
    default: 'conditional',
    chronology: 'strong',
    lived_experience: 'conditional',
    commercial_impact: 'conditional',
    community_identity: 'conditional',
    technical_scope: 'leadOnly',
    superlative: 'leadOnly',
  },
  contemporaneous_trade_press: {
    default: 'conditional',
    commercial_impact: 'strong',
    technical_scope: 'conditional',
    chronology: 'strong',
    superlative: 'leadOnly',
    community_identity: 'leadOnly',
  },
  company_record: {
    default: 'conditional',
    record_fact: 'strong',
    commercial_impact: 'conditional',
    relationship: 'strong',
    superlative: 'unfit',
    community_identity: 'leadOnly',
  },
  court_record: {
    default: 'strong',
    legal_status: 'authoritative',
    record_fact: 'authoritative',
    // Priority disputes are litigated, and the finding is evidence about who was first.
    superlative: 'conditional',
    invention_attribution: 'strong',
    community_identity: 'leadOnly',
  },
  census_or_vital_record: {
    default: 'conditional',
    biographical_fact: 'strong',
    chronology: 'strong',
    place: 'strong',
    community_identity: 'conditional',
    technical_scope: 'unfit',
    superlative: 'unfit',
  },
  oral_history: {
    default: 'conditional',
    lived_experience: 'authoritative',
    community_identity: 'strong',
    relationship: 'conditional',
    chronology: 'leadOnly',
    superlative: 'leadOnly',
    technical_scope: 'leadOnly',
  },
  peer_reviewed_scholarship: {
    default: 'strong',
    historical_synthesis: 'authoritative',
    superlative: 'strong',
    technical_scope: 'strong',
    invention_attribution: 'strong',
    community_identity: 'strong',
    record_fact: 'conditional',
  },
  scholarly_book_or_history: {
    default: 'strong',
    historical_synthesis: 'strong',
    superlative: 'strong',
    invention_attribution: 'strong',
    community_identity: 'strong',
    record_fact: 'conditional',
  },
  historical_compilation: {
    default: 'conditional',
    // Baker's lists are the reason a person is known to have been a Black inventor at all.
    community_identity: 'strong',
    record_fact: 'conditional',
    technical_scope: 'leadOnly',
    superlative: 'leadOnly',
    commercial_impact: 'leadOnly',
  },
  modern_reputable_secondary: {
    default: 'conditional',
    biographical_fact: 'conditional',
    historical_synthesis: 'conditional',
    // The class that carries "invented the light bulb". It may carry the claim; it may not
    // settle attribution or firstness.
    invention_attribution: 'leadOnly',
    superlative: 'leadOnly',
    technical_scope: 'leadOnly',
    community_identity: 'conditional',
  },
  wikipedia_bridge: {
    default: 'leadOnly',
    superlative: 'unfit',
    invention_attribution: 'unfit',
    community_identity: 'leadOnly',
  },
  wikidata_bridge: {
    default: 'leadOnly',
    superlative: 'unfit',
    invention_attribution: 'unfit',
    community_identity: 'unfit',
  },
  search_result_lead: {
    default: 'leadOnly',
    superlative: 'unfit',
    invention_attribution: 'unfit',
    community_identity: 'unfit',
    record_fact: 'unfit',
  },
};

const RATIONALES: Readonly<Record<Fitness, string>> = {
  authoritative: 'This kind of document decides this kind of question',
  strong:
    'Good evidence for this kind of question; corroboration strengthens rather than rescues it',
  conditional: 'Usable for this kind of question, with its known failure modes weighed',
  leadOnly: 'Points at where the evidence would be; not acceptance on its own',
  unfit: 'Cannot answer this kind of question at all, however many copies exist',
};

export function isSourceClass(value: string): value is SourceClass {
  return (SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isAssertionClass(value: string): value is AssertionClass {
  return (ASSERTION_CLASSES as readonly string[]).includes(value);
}

/**
 * How well this source class answers this assertion class.
 *
 * Throws on an unrecognised vocabulary rather than defaulting. A misspelled source class used
 * to score 0.2 silently under the old `CLASSIFICATION_AUTHORITY[x] ?? unknown` lookup, which
 * turned a typo into a quiet downgrade instead of a failure.
 */
export function assessSourceFitness(
  sourceClass: SourceClass,
  assertionClass: AssertionClass,
): FitnessAssessment {
  if (!isSourceClass(sourceClass)) {
    throw new Error(`Unknown source class: ${String(sourceClass)}`);
  }
  if (!isAssertionClass(assertionClass)) {
    throw new Error(`Unknown assertion class: ${String(assertionClass)}`);
  }
  const row = FITNESS_TABLE[sourceClass];
  const fitness = row[assertionClass] ?? row.default;
  return {
    fitness,
    rationale: RATIONALES[fitness],
    limitations: LIMITATIONS[sourceClass] ?? [],
  };
}

/** True when this source can never support this assertion, whatever else is attached. */
export function isUnfitFor(sourceClass: SourceClass, assertionClass: AssertionClass): boolean {
  return assessSourceFitness(sourceClass, assertionClass).fitness === 'unfit';
}

/**
 * Assertion classes that need more than one independent lineage before they can be published
 * as settled, where corroboration is reasonably available.
 */
export const HIGH_IMPACT_ASSERTION_CLASSES: readonly AssertionClass[] = [
  'invention_attribution',
  'superlative',
  'societal_impact',
  'commercial_impact',
  'community_identity',
];

export function isHighImpactAssertion(assertionClass: AssertionClass): boolean {
  return HIGH_IMPACT_ASSERTION_CLASSES.includes(assertionClass);
}
