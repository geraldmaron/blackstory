/**
 * The Turn: one question per column that a reader answers before seeing the record.
 * Design and limits: docs/research/lives-structure-decision.md §5. Review status and what may ship:
 * docs/methodology/lives-across-decades.md, "Community review".
 *
 * ONLY FORM 3 SHIPS: a question about a rule or about what the census form asked. No group appears
 * in the question, so no reader is asked to estimate, or is corrected about, any group's outcome.
 * Form 2 (one group's figure, then against now) is not placed: `LivesCell` carries no structured
 * universe or source identity, and the pair the structure decision sketched (2000 against 2020)
 * compares a full census count with a survey estimate. Form 1 needs state-level spread in the
 * bundle. Both also wait for community review.
 *
 * Every reveal restates a record that is already published and cited on this page: a law or case
 * record's own summary, or a published count note. A Turn adds no fact of its own. It never scores,
 * streaks, stores, logs, or shows other readers' answers.
 */
import type { LivesSourceRef } from '@repo/domain/statistics/lives';
import type { LivesMilestoneKey } from './lives-milestones';

export type LivesTurnOption = { readonly id: string; readonly label: string };

export type LivesTurn = {
  readonly form: 3;
  /** The era panel it sits in. It renders only when that panel does. */
  readonly eraId: string;
  readonly prompt: string;
  readonly options: readonly [LivesTurnOption, LivesTurnOption, LivesTurnOption];
  readonly answerId: string;
  readonly reveal: string;
  /** The published records or notes the reveal restates. */
  readonly records: readonly { readonly label: string; readonly href: string }[];
  readonly citations?: readonly LivesSourceRef[];
  /**
   * The ship gate, answered in writing: would this be harmful projected in a mixed classroom with
   * no facilitator? A Turn about a rule or a census question passes; one about a group's outcome
   * rate does not.
   */
  readonly classroomTest: string;
};

export const LIVES_TURNS: Readonly<Record<LivesMilestoneKey, LivesTurn>> = {
  home: {
    form: 3,
    eraId: '1940-1960',
    prompt:
      'Refusing to sell or rent a home to someone because of their race became illegal under federal law in which year?',
    options: [
      { id: '1948', label: '1948' },
      { id: '1968', label: '1968' },
      { id: '1977', label: '1977' },
    ],
    answerId: '1968',
    reveal:
      '1968. The Fair Housing Act, enacted that April, banned discrimination in the sale, rental, and financing of housing. Twenty years earlier, in Shelley v. Kraemer, the Supreme Court had only stopped courts from enforcing deed clauses that barred sales by race. It left the clauses themselves alone. The 1977 law is the Community Reinvestment Act, which is about bank lending.',
    records: [
      { label: 'Fair Housing Act of 1968', href: '/entity/ent_law_fair_housing_act_1968' },
      { label: 'Shelley v. Kraemer', href: '/entity/ent_case_shelley_v_kraemer_1948' },
      {
        label: 'Community Reinvestment Act of 1977',
        href: '/entity/ent_law_community_reinvestment_act_1977',
      },
    ],
    classroomTest:
      'Asks for the year a federal rule began. No group is named and nobody’s outcome is estimated.',
  },
  place: {
    form: 3,
    eraId: '1870-1890',
    prompt:
      'In 1875 Congress banned racial discrimination in inns, theaters, and public transportation. How long did that ban last?',
    options: [
      { id: 'eight', label: '8 years' },
      { id: 'forty', label: 'About 40 years' },
      { id: 'still', label: 'It’s still in force' },
    ],
    answerId: 'eight',
    reveal:
      '8 years. The Civil Rights Act of 1875 was signed on March 1, 1875. In 1883 the Supreme Court struck it down in the Civil Rights Cases, holding that the Thirteenth and Fourteenth Amendments didn’t empower Congress to outlaw discrimination by private individuals. The five cases were brought by Black plaintiffs who had been turned away from theaters, hotels, and transit. Congress didn’t pass another law like it until 1964.',
    records: [
      { label: 'Civil Rights Act of 1875', href: '/entity/ent_law_civil_rights_act_1875' },
      { label: 'The Civil Rights Cases', href: '/entity/ent_case_civil_rights_cases_1883' },
    ],
    classroomTest:
      'Asks how long a law lasted. The question names no group; the reveal names the plaintiffs as people who sued.',
  },
  school: {
    form: 3,
    eraId: '1870-1890',
    prompt:
      'In 1896 the Supreme Court approved the idea of “separate but equal.” What was that case about?',
    options: [
      { id: 'schools', label: 'Public schools' },
      { id: 'railcars', label: 'Railroad cars' },
      { id: 'voting', label: 'Voting booths' },
    ],
    answerId: 'railcars',
    reveal:
      'Railroad cars. Plessy v. Ferguson upheld Louisiana’s Separate Car Act, 7 to 1, on May 18, 1896. The Court ruled that racially segregated facilities were constitutional if they were “separate but equal.” That doctrine reached far past trains: it legitimized Jim Crow segregation until Brown v. Board of Education in 1954.',
    records: [{ label: 'Plessy v. Ferguson', href: '/entity/ent_case_plessy_v_ferguson_1896' }],
    classroomTest:
      'Asks what a famous case was about. No group is named and the answer corrects a belief about a court case, not about people.',
  },
  education: {
    form: 3,
    eraId: '1970-1980',
    prompt:
      'In 1974 the Supreme Court ruled on a plan to bus students between Detroit and its suburbs. What did it decide?',
    options: [
      { id: 'proceed', label: 'The plan could go ahead' },
      {
        id: 'proof',
        label: 'Not unless the suburban districts had broken the law themselves',
      },
      { id: 'never', label: 'Busing was unconstitutional everywhere' },
    ],
    answerId: 'proof',
    reveal:
      'Not unless the suburban districts had broken the law themselves. Milliken v. Bradley was decided 5 to 4 on July 25, 1974. The Court barred the lower court’s plan to bus students across Detroit’s city and suburb district lines. It ruled that a remedy reaching across districts needs proof that the suburban districts committed a constitutional violation of their own.',
    records: [{ label: 'Milliken v. Bradley', href: '/entity/ent_case_milliken_v_bradley_1974' }],
    classroomTest:
      'Asks what a court decided about district lines. No group is named and nobody’s outcome is estimated.',
  },
  work: {
    form: 3,
    eraId: '1970-1980',
    prompt:
      'In 1971 the Supreme Court looked at a company’s diploma and testing requirements for jobs. What did it hold about rules like those?',
    options: [
      { id: 'everyone', label: 'They’re legal as long as they apply to everyone' },
      {
        id: 'ability',
        label: 'They’re illegal if they shut people out by race and don’t measure the job',
      },
      { id: 'notests', label: 'Employers may never test applicants' },
    ],
    answerId: 'ability',
    reveal:
      'They’re illegal if they shut people out by race and don’t measure the job. In Griggs v. Duke Power Co., the Court held that Title VII bars practices that are fair in form but discriminatory in operation when they exclude people by race and don’t measure the ability to perform the job. Duke Power had confined its Black employees to its Labor Department before it added the diploma and testing requirements.',
    records: [
      { label: 'Griggs v. Duke Power Co.', href: '/entity/ent_case_griggs_v_duke_power_1971' },
    ],
    classroomTest:
      'Asks what a court held about hiring rules. The question names no group; the reveal states what the employer did.',
  },
  count: {
    form: 3,
    eraId: '1990-2000',
    prompt:
      'The 2000 census let people do something on the race question that no census before it had allowed. What was it?',
    options: [
      { id: 'multi', label: 'Mark more than one race' },
      { id: 'skip', label: 'Skip the question' },
      { id: 'either', label: 'Answer for race or for origin, but not both' },
    ],
    answerId: 'multi',
    reveal:
      'Mark more than one race. For the first time, people could choose more than one. The question about Hispanic origin also moved ahead of the race question. The Census Bureau says race figures from 2000 aren’t directly comparable with 1990.',
    records: [],
    citations: [
      {
        label: 'Census 2000 Brief, Overview of Race and Hispanic Origin',
        url: 'https://www2.census.gov/library/publications/decennial/2000/briefs/c2kbr01-01.pdf',
      },
    ],
    classroomTest:
      'Asks what changed on the census form. It is about the question, not about any group’s answers.',
  },
};

export function livesTurnFor(key: LivesMilestoneKey, eraId: string): LivesTurn | null {
  const turn = LIVES_TURNS[key];
  return turn.eraId === eraId ? turn : null;
}
