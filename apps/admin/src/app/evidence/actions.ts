/**
 * Attach evidence proposals to a research case via operator-cli prepare + optional commit.
 */
'use server';

import { randomUUID } from 'node:crypto';
import {
  commitOperatorIntake,
  prepareEvidenceAttachmentIntake,
  type OperatorIntakeAccepted,
} from '@repo/operator-cli';
import { createAdminAtomicStore, createServerFirebaseApp } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';

export type EvidenceAttachState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly error: string }
  | {
      readonly status: 'prepared';
      readonly submissionId: string;
      readonly researchCaseId: string;
    }
  | {
      readonly status: 'committed';
      readonly submissionId: string;
      readonly researchCaseId: string;
      readonly auditEventId: string;
    };

export const EVIDENCE_ATTACH_INITIAL: EvidenceAttachState = { status: 'idle' };

export async function submitEvidenceAttach(
  _previous: EvidenceAttachState,
  formData: FormData,
): Promise<EvidenceAttachState> {
  const researchCaseId = String(formData.get('researchCaseId') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
  const operatorId = String(formData.get('operatorId') ?? '').trim();
  const shouldCommit = formData.get('commit') === '1';

  if (!researchCaseId) return { status: 'error', error: 'Research case id is required.' };
  if (!description) return { status: 'error', error: 'Description is required.' };
  if (!sourceUrl) return { status: 'error', error: 'Source URL is required.' };
  if (!operatorId) {
    return { status: 'error', error: 'Operator id is required to stamp this proposal for audit.' };
  }

  const privacyPepper = process.env.OPERATOR_CLI_PRIVACY_PEPPER;
  if (!privacyPepper) {
    return { status: 'error', error: 'Server is missing OPERATOR_CLI_PRIVACY_PEPPER.' };
  }

  try {
    const outcome = prepareEvidenceAttachmentIntake(
      {
        researchCaseId,
        description,
        sourceUrls: [sourceUrl],
      },
      {
        identity: {
          operatorId,
          sessionId: randomUUID(),
          source: 'admin_console',
        },
        privacyPepper,
      },
    );

    if (!outcome.accepted) {
      return {
        status: 'error',
        error: outcome.rejection.issues
          .map((issue: { readonly message: string }) => issue.message)
          .join('; ') || 'Rejected',
      };
    }

    if (shouldCommit) {
      const { app } = createServerFirebaseApp(process.env);
      const store = createAdminAtomicStore(getFirestore(app));
      const commitResult = await commitOperatorIntake(
        store,
        outcome as OperatorIntakeAccepted,
      );
      return {
        status: 'committed',
        submissionId: outcome.submission.id,
        researchCaseId,
        auditEventId: commitResult.eventId,
      };
    }

    return {
      status: 'prepared',
      submissionId: outcome.submission.id,
      researchCaseId,
    };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}
