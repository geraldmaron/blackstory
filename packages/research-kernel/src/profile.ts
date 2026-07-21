import blackHistoryProfileValue from '../profiles/black-history.v1.json' with { type: 'json' };
import { assertContract, type ModelPolicy, type ResearchProfile } from './contracts.js';

const parsedBlackHistoryProfile = assertContract('ResearchProfile', blackHistoryProfileValue);

export const blackHistoryProfile: ResearchProfile = Object.freeze(
  structuredClone(parsedBlackHistoryProfile),
);

export function modelPolicyFor(profile: ResearchProfile, mode: ModelPolicy['mode']): ModelPolicy {
  const policy = profile.modelPolicies.find((candidate) => candidate.mode === mode);
  if (policy === undefined) throw new Error(`No model policy is registered for mode ${mode}`);
  return policy;
}

export function assertModelAdmitted(
  profile: ResearchProfile,
  mode: ModelPolicy['mode'],
  modelId: string,
  benchmarkPassed: boolean,
): ModelPolicy {
  const policy = modelPolicyFor(profile, mode);
  if (!policy.modelIds.includes(modelId)) {
    throw new Error(`Model ${modelId} is not admitted for ${mode}`);
  }
  if (policy.requiresBenchmark && !benchmarkPassed) {
    throw new Error(`Model ${modelId} has no passing benchmark for ${mode}`);
  }
  return policy;
}
