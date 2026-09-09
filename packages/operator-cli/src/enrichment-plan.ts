/**
 * Turning a deficit into research.
 *
 * This is the difference between enrichment and prose rewriting, and it is worth stating
 * plainly because the repository has been calling the second one the first. `enrichment-run` is
 * 21 lines: it awaits `runEditorialJudge` and relabels the result. Its input type is an alias of
 * the editorial input type, the CLI dispatches both through one case body, and it fetches
 * nothing — a subject with no `sourceSnippets` can only ever come back `needs_evidence`,
 * because the judge is told its citations must come from the snippets it was handed.
 *
 * Rewriting prose over the same evidence cannot make a record better researched. It can only
 * make it read as though it were.
 *
 * What deep enrichment needs first is a statement of what is MISSING, specific enough to search
 * for. That is what this module produces: deficits in, evidence needs and bounded queries out.
 * Every step here is deterministic — no model call decides what research is needed, because
 * "this claim rests on one lineage" is counting, and a model asked to invent research questions
 * will invent plausible ones rather than the ones this record actually lacks.
 *
 * A query here is a LEAD. Nothing it returns is evidence until it has been independently
 * resolved and fetched through the safe-fetch path. That boundary is the reason this module
 * emits query strings rather than results.
 */
import type { ResearchDeficit, ResearchDeficitCode, ResearchMaturity } from '@repo/domain';

/**
 * The kernel's EvidenceNeed, built here rather than imported so this module stays free of a
 * research-kernel dependency it would only use for one type. The shape is asserted against the
 * real contract in the test, so a schema change fails loudly rather than drifting.
 */
export type PlannedEvidenceNeed = {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly questionId: string;
  readonly claimClass: string;
  readonly description: string;
  readonly mandatory: boolean;
  readonly contradictionSearch: boolean;
  readonly status: 'open';
};

export type PlannedQuestion = {
  readonly schemaVersion: '1.0.0';
  readonly id: string;
  readonly caseId: string;
  readonly question: string;
  readonly priority: number;
  readonly status: 'open';
};

/** A bounded search to run. Results are leads, never evidence. */
export type PlannedQuery = {
  readonly needId: string;
  readonly query: string;
  /** What kind of document this query is trying to reach. */
  readonly seeking: string;
};

export type EnrichmentPlan = {
  readonly entityId: string;
  readonly currentMaturity: ResearchMaturity;
  readonly targetMaturity: ResearchMaturity;
  readonly questions: readonly PlannedQuestion[];
  readonly evidenceNeeds: readonly PlannedEvidenceNeed[];
  readonly queries: readonly PlannedQuery[];
  /** Deficits with no planned remedy, named rather than silently dropped. */
  readonly unaddressedDeficits: readonly ResearchDeficitCode[];
};

type NeedTemplate = {
  /** The question a researcher is actually trying to answer. */
  readonly question: (subject: string) => string;
  readonly claimClass: string;
  readonly description: (subject: string) => string;
  /** Mandatory needs block `deep_research` and `reference` until satisfied or explicitly blocked. */
  readonly mandatory: boolean;
  readonly contradictionSearch: boolean;
  /**
   * Bounded queries, built from the subject. Deliberately few: a need that generates twenty
   * queries is a need nobody will finish, and the budget is spent on breadth instead of depth.
   */
  readonly queries: (subject: string, context: PlanContext) => readonly PlannedQuery[];
};

export type PlanContext = {
  readonly subjectName: string;
  /** Where the subject worked or lived, when known — narrows archival and place queries. */
  readonly placeHint?: string | undefined;
  /** Patent numbers already attached, so a technical query does not re-fetch what is held. */
  readonly knownPatentNumbers?: readonly string[] | undefined;
  /** True for records whose subject matter is invention or technology. */
  readonly inventionContext?: boolean | undefined;
};

const q = (needId: string, query: string, seeking: string): PlannedQuery => ({
  needId,
  query,
  seeking,
});

/**
 * What to go and find, per deficit.
 *
 * Only deficits that a SEARCH can close appear here. `missing_creation_or_publication_date` is
 * real and important and is not in this table, because no amount of searching fixes the absence
 * of a column to store the answer in — that is a schema task, and pretending a query could
 * resolve it would put an unclosable need in every plan forever.
 */
const NEED_TEMPLATES: Partial<Record<ResearchDeficitCode, NeedTemplate>> = {
  wikipedia_only_summary_claim: {
    question: (s) => `What does the underlying work behind the reference article say about ${s}?`,
    claimClass: 'historical-assertion',
    description: (s) =>
      `Public summary prose about ${s} rests on a reference bridge. Find the institution, archive or original work the bridge is itself citing.`,
    mandatory: true,
    contradictionSearch: false,
    queries: (s, ctx) => [
      q('', `"${s}" archive collection`, 'archival record'),
      q('', `"${s}" site:si.edu OR site:loc.gov OR site:nps.gov`, 'institutional account'),
      ...(ctx.placeHint !== undefined
        ? [q('', `"${s}" "${ctx.placeHint}" historical society`, 'local institutional account')]
        : []),
    ],
  },
  bridge_only_entity: {
    question: (s) => `What primary or institutional record documents ${s} at all?`,
    claimClass: 'historical-assertion',
    description: (s) =>
      `Every source on ${s} is a reference bridge, so nothing on the record is corroborated.`,
    mandatory: true,
    contradictionSearch: false,
    queries: (s) => [
      q('', `"${s}" papers finding aid`, 'archival finding aid'),
      q('', `"${s}" manuscript collection`, 'archival manuscript'),
      q('', `"${s}" biography site:.edu`, 'institutional biography'),
    ],
  },
  single_lineage_high_impact_claim: {
    question: (s) =>
      `Is there a second, independently created record that supports the attribution made about ${s}?`,
    claimClass: 'high-impact-attribution',
    description: (s) =>
      `A high-impact claim about ${s} rests on one lineage. Find a source tracing to a DIFFERENT underlying work, not another host carrying the same one.`,
    mandatory: true,
    contradictionSearch: true,
    queries: (s, ctx) => [
      q('', `"${s}" scholarship history of technology`, 'peer-reviewed scholarship'),
      q('', `"${s}" contemporaneous newspaper account`, 'period reporting'),
      ...(ctx.inventionContext === true
        ? [q('', `"${s}" patent dispute OR interference`, 'priority adjudication')]
        : []),
    ],
  },
  superlative_without_institutional_support: {
    question: (s) => `Who researched the ordering that the firstness claim about ${s} asserts?`,
    claimClass: 'superlative',
    description: (s) =>
      `A firstness or only-ness claim about ${s} has no source fit to establish an ordering. Find an institution or scholar that states the same scope, or bound the claim to "first known".`,
    mandatory: true,
    contradictionSearch: true,
    queries: (s, ctx) => [
      q('', `"${s}" first documented scholarship`, 'scholarship on priority'),
      q('', `earlier than "${s}" history`, 'prior claimant'),
      ...(ctx.inventionContext === true
        ? [
            q('', `"${s}" prior art`, 'prior art'),
            q('', `"${s}" interference proceeding`, 'priority adjudication'),
          ]
        : []),
    ],
  },
  no_primary_or_archival_receipt: {
    question: (s) => `What archival or period record exists for ${s}?`,
    claimClass: 'historical-assertion',
    description: (s) =>
      `${s} rests entirely on synthesis. Pursue the archival or technical record the secondary sources are themselves working from.`,
    mandatory: false,
    contradictionSearch: false,
    queries: (s, ctx) => [
      q('', `"${s}" finding aid`, 'archival finding aid'),
      q('', `"${s}" correspondence`, 'archival manuscript'),
      ...(ctx.placeHint !== undefined
        ? [q('', `"${s}" "${ctx.placeHint}" newspaper archive`, 'period newspaper')]
        : []),
    ],
  },
  missing_identity_receipt: {
    question: (s) => `What authoritative historical source establishes that ${s} was Black?`,
    claimClass: 'community-identity',
    description: (s) =>
      `Nothing attached establishes that ${s} belongs in a Black-history corpus. The Patent Office did not record inventor race, so no technical record can answer this. Baker-era compilations, USPTO and Smithsonian historical biographies, NPS and Library of Congress accounts, archival correspondence, credible contemporary Black press and scholarship can.`,
    mandatory: true,
    contradictionSearch: false,
    queries: (s) => [
      q('', `"${s}" Henry Baker Black inventor`, 'Baker-era compilation'),
      q('', `"${s}" African American inventor site:uspto.gov`, 'USPTO historical biography'),
      q('', `"${s}" site:si.edu OR site:nps.gov`, 'institutional biography'),
      q('', `"${s}" Black press`, 'contemporary Black press'),
    ],
  },
  invention_claim_without_technical_receipt: {
    question: (s) => `What primary technical record documents what ${s} actually does?`,
    claimClass: 'technical-scope',
    description: (s) =>
      `${s} describes a technical contribution with no source fit to establish the mechanism. Where no patent exists, an archival, institutional or museum object record substitutes; where none exists at all, record that as a blocker rather than widening the prose.`,
    mandatory: true,
    contradictionSearch: false,
    queries: (s, ctx) => [
      ...(ctx.knownPatentNumbers ?? []).map((number) =>
        q('', `"${number}" patent full text`, 'patent specification'),
      ),
      q('', `"${s}" patent`, 'patent specification'),
      q('', `"${s}" technical report`, 'government technical report'),
      q('', `"${s}" museum object record`, 'museum object record'),
    ],
  },
  inventor_team_or_coinventor_unresolved: {
    question: (s) => `Who else is named on the record alongside ${s}?`,
    claimClass: 'high-impact-attribution',
    description: (s) =>
      `A sole-inventor attribution to ${s} has not been checked against the document's own inventor list. Centring one contributor is editorial; erasing the others is an error.`,
    mandatory: true,
    contradictionSearch: false,
    queries: (s) => [
      q('', `"${s}" co-inventor`, 'patent specification'),
      q('', `"${s}" collaborator patent`, 'patent specification'),
    ],
  },
  invention_scope_broader_than_patent: {
    question: (s) => `What does the patent behind the claim about ${s} actually cover?`,
    claimClass: 'technical-scope',
    description: (s) =>
      `Public wording about ${s} claims more than its patent receipt covers. Either find a source that researched priority for the wider claim, or bound the sentence to the improvement the patent records.`,
    mandatory: true,
    contradictionSearch: true,
    queries: (s, ctx) => [
      ...(ctx.knownPatentNumbers ?? []).map((number) =>
        q('', `"${number}" claims specification`, 'patent specification'),
      ),
      q('', `"${s}" what the patent covers`, 'institutional account of scope'),
      q('', `history of the technology before "${s}"`, 'prior art'),
    ],
  },
  missing_place_receipt: {
    question: (s) => `Where did the work associated with ${s} actually happen?`,
    claimClass: 'place',
    description: (s) =>
      `No evidence-backed place anchor for ${s}. A filing or mailing address is evidence of an address, not of a workshop.`,
    mandatory: false,
    contradictionSearch: false,
    queries: (s) => [
      q('', `"${s}" workshop OR laboratory`, 'development site'),
      q('', `"${s}" demonstration`, 'demonstration site'),
      q('', `"${s}" factory OR works`, 'production facility'),
    ],
  },
  high_impact_attribution_without_prior_art_search: {
    question: (s) => `Did anyone get there before ${s}, and did anyone contest it?`,
    claimClass: 'high-impact-attribution',
    description: (s) =>
      `An attribution or firstness claim about ${s} has had no prior-art or alternative-attribution search.`,
    mandatory: true,
    contradictionSearch: true,
    queries: (s) => [
      q('', `"${s}" prior art`, 'prior art'),
      q('', `"${s}" patent lawsuit OR dispute`, 'court or interference record'),
      q('', `who invented before "${s}"`, 'competing claimant'),
    ],
  },
  unresolved_contradiction: {
    question: (s) => `Which account of ${s} does the better evidence support?`,
    claimClass: 'historical-assertion',
    description: (s) =>
      `Fit sources disagree about ${s} and the disagreement is neither reconciled nor disclosed. Do not average them.`,
    mandatory: true,
    contradictionSearch: true,
    queries: (s) => [
      q('', `"${s}" correction OR retraction`, 'correction'),
      q('', `"${s}" disputed`, 'contrary account'),
    ],
  },
  source_type_monoculture: {
    question: (s) => `What DIFFERENT kind of record exists for ${s}?`,
    claimClass: 'historical-assertion',
    description: (s) =>
      `Every source on ${s} is the same kind of document, so they share the same blind spots. Another of the same kind does not help.`,
    mandatory: false,
    contradictionSearch: false,
    queries: (s) => [
      q('', `"${s}" newspaper archive`, 'period newspaper'),
      q('', `"${s}" oral history`, 'oral history'),
      q('', `"${s}" scholarship`, 'peer-reviewed scholarship'),
    ],
  },
  importer_source_monoculture: {
    question: (s) => `What source for ${s} did the import lane NOT hand us?`,
    claimClass: 'historical-assertion',
    description: (s) =>
      `Every source on ${s} came from one importer. A bulk import is one source family however many rows it produced.`,
    mandatory: false,
    contradictionSearch: false,
    queries: (s) => [
      q('', `"${s}" archive`, 'archival record'),
      q('', `"${s}" scholarship`, 'peer-reviewed scholarship'),
    ],
  },
};

const MATURITY_ORDER: readonly ResearchMaturity[] = [
  'seeded',
  'grounded',
  'corroborated',
  'contextualized',
  'deep_research',
  'reference',
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 60);
}

/**
 * Build the research plan for one record.
 *
 * Ordering is by deficit severity: correction risks first, because a record whose published
 * prose overstates its evidence is a different kind of problem from a record that is merely
 * thin, and doing the thin one first leaves the wrong sentence up for longer.
 */
export function planEnrichment(input: {
  readonly entityId: string;
  readonly currentMaturity: ResearchMaturity;
  readonly targetMaturity: ResearchMaturity;
  readonly deficits: readonly ResearchDeficit[];
  readonly context: PlanContext;
}): EnrichmentPlan {
  const { entityId, context } = input;
  const subject = context.subjectName;

  const ordered = [...input.deficits].sort((a, b) => {
    if (a.correctionRisk !== b.correctionRisk) return a.correctionRisk ? -1 : 1;
    return a.code.localeCompare(b.code);
  });

  const questions: PlannedQuestion[] = [];
  const evidenceNeeds: PlannedEvidenceNeed[] = [];
  const queries: PlannedQuery[] = [];
  const unaddressed: ResearchDeficitCode[] = [];
  const seenCodes = new Set<ResearchDeficitCode>();

  for (const deficit of ordered) {
    // One need per deficit CODE, not per occurrence: three claims missing a second lineage is
    // one research task with three beneficiaries, not three searches for the same thing.
    if (seenCodes.has(deficit.code)) continue;
    seenCodes.add(deficit.code);

    const template = NEED_TEMPLATES[deficit.code];
    if (template === undefined) {
      unaddressed.push(deficit.code);
      continue;
    }

    const questionId = `q_${entityId}_${slug(deficit.code)}`;
    const needId = `need_${entityId}_${slug(deficit.code)}`;
    questions.push({
      schemaVersion: '1.0.0',
      id: questionId,
      caseId: entityId,
      question: template.question(subject),
      // Correction risks outrank everything. rankFrontierTasks in the kernel sorts descending.
      priority: deficit.correctionRisk ? 100 : template.mandatory ? 50 : 10,
      status: 'open',
    });
    evidenceNeeds.push({
      schemaVersion: '1.0.0',
      id: needId,
      questionId,
      claimClass: template.claimClass,
      description: template.description(subject),
      mandatory: template.mandatory,
      contradictionSearch: template.contradictionSearch,
      status: 'open',
    });
    for (const query of template.queries(subject, context)) {
      queries.push({ ...query, needId });
    }
  }

  return {
    entityId,
    currentMaturity: input.currentMaturity,
    targetMaturity: input.targetMaturity,
    questions,
    evidenceNeeds,
    queries,
    unaddressedDeficits: unaddressed,
  };
}

/** True when the target sits above the current state and there is therefore work to do. */
export function targetIsAbove(current: ResearchMaturity, target: ResearchMaturity): boolean {
  return MATURITY_ORDER.indexOf(target) > MATURITY_ORDER.indexOf(current);
}

/**
 * A plan that found nothing to do is still a result.
 *
 * An enrichment run that reports nothing teaches the next run nothing, and the next campaign
 * re-runs the same cheap searches forever. "No remedy is planned for these deficits" is a
 * finding about the deficits, not an absence of output.
 */
export function describePlan(plan: EnrichmentPlan): string {
  if (plan.evidenceNeeds.length === 0) {
    return plan.unaddressedDeficits.length === 0
      ? `${plan.entityId}: no deficits and no research planned at ${plan.currentMaturity}`
      : `${plan.entityId}: ${plan.unaddressedDeficits.length} deficit(s) with no searchable remedy (${plan.unaddressedDeficits.join(', ')})`;
  }
  const mandatory = plan.evidenceNeeds.filter((need) => need.mandatory).length;
  return `${plan.entityId}: ${plan.evidenceNeeds.length} evidence need(s), ${mandatory} mandatory, ${plan.queries.length} bounded queries, ${plan.currentMaturity} -> ${plan.targetMaturity}`;
}
