import type {
  EvidenceNeed,
  FrontierTask,
  ResearchProfile,
  ReviewDecision,
  StoryResearchPacket,
} from './contracts.js';

export function scoreFrontierTask(
  task: Pick<
    FrontierTask,
    | 'riskWeight'
    | 'expectedEntropyReduction'
    | 'sourceNovelty'
    | 'contradictionValue'
    | 'normalizedCost'
  >,
): number {
  for (const field of [
    'riskWeight',
    'expectedEntropyReduction',
    'sourceNovelty',
    'contradictionValue',
    'normalizedCost',
  ] as const) {
    const value = task[field];
    if (!Number.isFinite(value) || value < 0)
      throw new Error(`${field} must be finite and nonnegative`);
  }
  if (task.normalizedCost <= 0) throw new Error('normalizedCost must be positive');
  const informationValue =
    task.expectedEntropyReduction + task.sourceNovelty + task.contradictionValue;
  return (task.riskWeight * informationValue) / task.normalizedCost;
}

export function rankFrontierTasks(tasks: readonly FrontierTask[]): readonly FrontierTask[] {
  return tasks
    .map((task) => ({ task, score: scoreFrontierTask(task) }))
    .sort((left, right) => right.score - left.score || left.task.id.localeCompare(right.task.id))
    .map(({ task }) => task);
}

export interface StopEvaluationInput {
  readonly profile: ResearchProfile;
  readonly needs: readonly EvidenceNeed[];
  readonly recentCompletedTasks: readonly FrontierTask[];
  readonly unresolvedEscalationTriggers: readonly string[];
  readonly hardCapReached: boolean;
}

export type StopEvaluation =
  | { readonly decision: 'continue'; readonly reason: string }
  | { readonly decision: 'stop'; readonly reason: string }
  | { readonly decision: 'escalate'; readonly reason: string };

export function evaluateStopping(input: StopEvaluationInput): StopEvaluation {
  if (input.unresolvedEscalationTriggers.length > 0) {
    return {
      decision: 'escalate',
      reason: `Unresolved escalation trigger: ${input.unresolvedEscalationTriggers.join(', ')}`,
    };
  }
  if (input.hardCapReached) return { decision: 'stop', reason: 'A hard case cap was reached' };

  const mandatoryIncomplete = input.needs.some(
    (need) => need.mandatory && need.status !== 'satisfied',
  );
  if (input.profile.stopping.requireMandatoryNeedsComplete && mandatoryIncomplete) {
    return { decision: 'continue', reason: 'Mandatory evidence needs remain open' };
  }
  const contradictionIncomplete =
    !input.needs.some((need) => need.contradictionSearch) ||
    input.needs.some((need) => need.contradictionSearch && need.status !== 'satisfied');
  if (input.profile.stopping.requireContradictionSearch && contradictionIncomplete) {
    return { decision: 'continue', reason: 'Contradiction search remains open' };
  }

  const requiredCount = input.profile.stopping.consecutiveTasksBelowThreshold;
  const recent = input.recentCompletedTasks.slice(-requiredCount);
  const stableLowFrontier =
    recent.length === requiredCount &&
    recent.every((task) => scoreFrontierTask(task) < input.profile.stopping.frontierScoreThreshold);
  return stableLowFrontier
    ? { decision: 'stop', reason: 'The frontier remained below threshold' }
    : { decision: 'continue', reason: 'The research frontier remains informative' };
}

export function assertIndependentApproval(decision: ReviewDecision): void {
  if (decision.reviewerActorId === decision.producerActorId) {
    throw new Error('Producer and reviewer must be different actors');
  }
  if (
    decision.reviewerModelFamily !== null &&
    decision.producerModelFamily !== null &&
    decision.reviewerModelFamily === decision.producerModelFamily
  ) {
    throw new Error('Producer and reviewer must use different model families');
  }
}

export function assertStoryPacketReady(packet: StoryResearchPacket): void {
  const report = packet.verificationReport;
  if (report.factualSentenceCount !== report.supportedFactualSentenceCount) {
    throw new Error('Every factual sentence must have accepted claim and evidence coverage');
  }
  if (
    !report.distinctLineageChecked ||
    !report.rightsChecked ||
    !report.entityLinksChecked ||
    !report.legalStatusChecked ||
    !report.plagiarismChecked ||
    !report.styleChecked ||
    report.blockingFindings.length > 0 ||
    !packet.approvalLineageComplete
  ) {
    throw new Error('Story packet verification or approval lineage is incomplete');
  }
}
