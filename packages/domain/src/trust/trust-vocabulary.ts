/**
 * Editorial trust vocabulary for Trust Project indicator schema properties (CC-BY-SA
 * vocabulary, never the trademarked program name or badge) and IFCN commitment text published as
 * "aligned with" (the signatory badge requires paid membership; the commitment language is public).
 */

/** Eight transparency indicators mapped to schema.org properties on NewsMediaOrganization. */
export const TRUST_PROJECT_INDICATORS = [
  {
    id: 'best_practices',
    schemaProperty: 'publishingPrinciples',
    title: 'Best practices',
    summary:
      'Editorial standards, verification steps, and correction policy are published and linked from every record.',
  },
  {
    id: 'type_of_work',
    schemaProperty: 'genre',
    title: 'Type of work',
    summary:
      'Labels distinguish historical facts, entity profiles, methodology notes, and third-party claim reviews.',
  },
  {
    id: 'citations_references',
    schemaProperty: 'citation',
    title: 'Citations and references',
    summary:
      'Every published fact carries structured citations with archived captures, retrieval dates, and supporting excerpts.',
  },
  {
    id: 'methods',
    schemaProperty: 'publishingPrinciples',
    title: 'Methods',
    summary:
      'Verification, triangulation, and source-hierarchy rules are documented on the methodology page.',
  },
  {
    id: 'locally_sourced',
    schemaProperty: 'contentLocation',
    title: 'Locally sourced',
    summary:
      'Place-connected records name the jurisdiction and precision tier of every geographic anchor.',
  },
  {
    id: 'diverse_voices',
    schemaProperty: 'knowsAbout',
    title: 'Diverse voices',
    summary: 'Inclusion rubrics require documented community significance, not popularity alone.',
  },
  {
    id: 'actionable_feedback',
    schemaProperty: 'actionableFeedbackPolicy',
    title: 'Actionable feedback',
    summary:
      'Readers can challenge records through a public corrections lane with receipt tracking.',
  },
  {
    id: 'no_hidden_agenda',
    schemaProperty: 'ownershipFundingInfo',
    title: 'No hidden agenda',
    summary:
      'Funding sources, editorial independence, and masthead roles are disclosed on the methodology page.',
  },
] as const;

export type TrustProjectIndicator = (typeof TRUST_PROJECT_INDICATORS)[number];

/** IFCN five commitments verbatim public text, published as editorial alignment, not signatory status. */
export const IFCN_COMMITMENTS = [
  {
    id: 'nonpartisanship',
    title: 'Nonpartisanship and fairness',
    body: 'Signatories do not unduly favor one side. We publish the same verification standards for every record regardless of subject.',
  },
  {
    id: 'sources',
    title: 'Sources',
    body: 'Signatories identify sources transparently, with links and archived captures wherever a web source exists.',
  },
  {
    id: 'transparency',
    title: 'Transparency of funding and organization',
    body: 'Signatories disclose ownership, funding, and organizational structure. Our methodology page carries that disclosure.',
  },
  {
    id: 'methodology',
    title: 'Transparency of methodology',
    body: 'Signatories explain the methods by which claims are verified. Our verification and triangulation section is that explanation.',
  },
  {
    id: 'corrections',
    title: 'Corrections',
    body: 'Signatories correct errors promptly and transparently. Corrections are logged publicly, timestamped, and never silently edited.',
  },
] as const;

export type IfcnCommitment = (typeof IFCN_COMMITMENTS)[number];

/** Pre-bunking copy naming manipulation techniques, never people or groups. */
export const PREBUNK_TECHNIQUE_FRAMES = [
  {
    id: 'out_of_context',
    technique: 'Quoting a source out of context',
    readerAction: 'Compare the cited excerpt to the full archived document linked on the record.',
  },
  {
    id: 'single_official_document',
    technique:
      'Demanding a single official document for events that were deliberately never documented',
    readerAction:
      'Check whether the record lists multiple independent primary sources and states known gaps plainly.',
  },
  {
    id: 'shoot_the_messenger',
    technique: 'Attacking the messenger instead of the evidence',
    readerAction:
      'Follow the citation chain — every claim should trace to a named source, not to editorial opinion.',
  },
] as const;
