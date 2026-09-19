import { assertContract, type ResearchExecutionPlan, type ResearchTaskSpec } from './contracts.js';
import { scoreFrontierTask } from './policy.js';

/** Validate the complete work graph before creating a run or spending a provider budget. */
export function validateExecutionPlan(value: unknown): ResearchExecutionPlan {
  const plan = assertContract('ResearchExecutionPlan', value);
  const { run, profile } = plan;
  if (JSON.stringify(plan).length > 1_000_000) throw new Error('Execution plan exceeds 1 MB');
  if (run.profileId !== profile.id || run.profileVersion !== profile.version) {
    throw new Error('Run must pin the supplied profile identity and version');
  }
  if (run.status !== 'pending' || run.completedAt !== null || run.costUsd !== 0) {
    throw new Error('New runs must be pending with zero cost and no completion time');
  }
  if (Object.values(run.counts).some((count) => count !== 0)) {
    throw new Error('New run counters must be zero');
  }
  if (!profile.modelPolicies.some((policy) => policy.mode === run.mode)) {
    throw new Error('Run mode is absent from its profile');
  }
  if (profile.modelPolicies.find((policy) => policy.mode === run.mode)?.requiresBenchmark) {
    throw new Error(
      'This mode needs recorded benchmark admission before dispatch; a version label is insufficient',
    );
  }
  const questions = uniqueById(plan.questions, 'question');
  const needs = uniqueById(plan.needs, 'evidence need');
  const tasks = uniqueById(
    plan.tasks.map((spec) => spec.frontier),
    'task',
  );
  for (const question of questions.values()) {
    if (question.caseId !== run.caseId || question.status !== 'open') {
      throw new Error('Questions must be open and belong to the run case');
    }
  }
  for (const need of needs.values()) {
    if (!questions.has(need.questionId) || need.status !== 'open') {
      throw new Error('Evidence needs must be open and reference a question in the plan');
    }
    if (need.mandatory && !plan.tasks.some((task) => task.evidenceNeedId === need.id)) {
      throw new Error(`Mandatory need ${need.id} has no task`);
    }
  }
  if (
    profile.stopping.requireContradictionSearch &&
    !plan.tasks.some((task) => {
      const need = task.evidenceNeedId === null ? undefined : needs.get(task.evidenceNeedId);
      return need?.contradictionSearch && task.frontier.taskType === 'contradictionSearch';
    })
  )
    throw new Error('The profile requires an explicit contradiction-search task and need');

  const budget = profile.budgets[plan.budgetClass];
  let queries = 0;
  let captures = 0;
  let candidateReservations = 0;
  let cost = 0;
  for (const spec of plan.tasks) {
    const task = spec.frontier;
    if (spec.input.executor === 'builtin') {
      const input = assertContract('ResearchWorkerInput', spec.input);
      if (input.operation === 'search') {
        if (
          !['query', 'contradictionSearch'].includes(task.taskType) ||
          spec.outputContract !== 'ResearchSearchResult'
        )
          throw new Error('Search execution requires a search task and result contract');
        candidateReservations += input.limit * spec.maxAttempts;
      } else if (input.operation === 'acquire') {
        if (task.taskType !== 'capture' || spec.outputContract !== 'ResearchAcquisitionResult')
          throw new Error('Acquisition requires a capture task and acquisition result contract');
        captures += (input.limit - 1) * spec.maxAttempts;
        candidateReservations += input.urls.length * spec.maxAttempts;
      } else {
        if (
          !['SubjectExtraction', 'RelationshipHypothesisExtraction', 'ResearchTaskReport'].includes(
            spec.outputContract,
          )
        )
          throw new Error('Synthesis requires an evidence-attached proposal contract');
        if (input.model === null && spec.outputContract !== 'ResearchTaskReport')
          throw new Error('Deterministic synthesis produces an evidence inventory report');
        if (input.model) {
          const policy = profile.modelPolicies.find((p) => p.mode === run.mode)!;
          if (run.mode === 'deterministic' || !policy.modelIds.includes(input.model.id))
            throw new Error('Worker model must be admitted by the pinned profile mode');
          const bound =
            (input.model.maxPromptBytes * input.model.promptUsdPerMillion +
              input.model.maxTokens * input.model.completionUsdPerMillion) /
            1_000_000;
          if (bound > spec.maxCostUsdPerAttempt)
            throw new Error('Worker model price limits exceed the reserved attempt budget');
        }
      }
    }
    if (task.caseId !== run.caseId || task.status !== 'pending') {
      throw new Error('Tasks must be pending and belong to the run case');
    }
    if (spec.evidenceNeedId !== null && !needs.has(spec.evidenceNeedId)) {
      throw new Error(`Task ${task.id} references an unknown evidence need`);
    }
    if (task.score !== scoreFrontierTask(task) || !Number.isFinite(task.score)) {
      throw new Error(`Task ${task.id} has an inconsistent priority score`);
    }
    if (task.hop > budget.relationshipHops) throw new Error('Relationship hop budget exceeded');
    for (const dependency of spec.dependsOn) {
      if (!tasks.has(dependency)) throw new Error(`Unknown task dependency ${dependency}`);
    }
    if (task.taskType === 'query' || task.taskType === 'contradictionSearch')
      queries += spec.maxAttempts;
    if (task.taskType === 'capture') captures += spec.maxAttempts;
    cost += spec.maxCostUsdPerAttempt * spec.maxAttempts;
  }
  if (!Number.isFinite(cost) || cost > budget.paidModelUsd)
    throw new Error('Model budget exceeded');
  if (queries > budget.queries) throw new Error('Query budget exceeded');
  if (captures > budget.fullCaptures) throw new Error('Capture budget exceeded');
  if (candidateReservations > budget.candidateUrls)
    throw new Error('Candidate URL reservations exceed the budget');

  const byId = new Map(plan.tasks.map((task) => [task.frontier.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (spec: ResearchTaskSpec): void => {
    if (visiting.has(spec.frontier.id)) throw new Error('Task dependency cycle');
    if (visited.has(spec.frontier.id)) return;
    visiting.add(spec.frontier.id);
    for (const dependency of spec.dependsOn) visit(byId.get(dependency)!);
    visiting.delete(spec.frontier.id);
    visited.add(spec.frontier.id);
  };
  for (const task of plan.tasks) visit(task);
  return plan;
}

function uniqueById<T extends { readonly id: string }>(
  values: readonly T[],
  kind: string,
): Map<string, T> {
  const map = new Map(values.map((value) => [value.id, value]));
  if (map.size !== values.length) throw new Error(`Duplicate ${kind} identity`);
  return map;
}
