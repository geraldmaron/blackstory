/** Browser-safe contracts shared by the work inbox, API and agent clients. */
import { z } from 'zod/v4';
import { assertContract, contractSchema, type ManagementProposal } from '@repo/research-kernel';

const text = z.string().trim().min(1);
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
export const workRequestSchema = z
  .object({
    request: text.max(12000),
    idempotencyKey: text.max(200),
    sessionId: text.max(200),
    harness: text.max(100),
  })
  .strict();
export const workProposalSchema = {
  parse: (value: unknown) => assertContract('ManagementProposal', value),
};
export const workDecisionSchema = z
  .object({
    version: z.number().int().positive(),
    proposalHash: digest,
    action: z.enum(['approve', 'request_changes', 'hold']),
    entityIds: z.array(text).max(25),
    reason: text.max(12000),
    sessionId: text.max(200),
    delegationId: text.optional(),
    idempotencyKey: text.max(200),
  })
  .strict();
export type WorkRequest = z.infer<typeof workRequestSchema>;
export type WorkProposal = ManagementProposal;
export type RecordChange = WorkProposal['changes'][number];
export type WorkDecision = z.infer<typeof workDecisionSchema>;
export type WorkState =
  | 'queued'
  | 'researching'
  | 'awaiting_review'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'held'
  | 'failed'
  | 'verification_failed';
export type WorkItem = {
  id: string;
  ownerId: string;
  request: WorkRequest;
  state: WorkState;
  version: number;
  proposal: WorkProposal | null;
  proposalHash: string | null;
  approvedEntityIds: string[];
  outcome: Record<string, unknown> | null;
  error: string | null;
  dispatchStatus: 'pending' | 'dispatching' | 'accepted' | 'failed';
  createdAt: string;
  updatedAt: string;
  leaseExpiresAt?: string | null;
};

export const workProposalJsonSchema = contractSchema('ManagementProposal');
