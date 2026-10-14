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
import { createPostgresAtomicStore } from '@repo/data-access';
import { getPostgresPool } from '../../../admin/lib/canonical-postgres-client';
import { readVerifiedAdminIdentity } from '../../../admin/auth/supabase-server';
import { staffRoleHasPermission } from '../../../admin/auth/staff-permissions';

import type { EvidenceAttachState } from './form-state';

export async function submitEvidenceAttach(
  _previous: EvidenceAttachState,
  formData: FormData,
): Promise<EvidenceAttachState> {
  const identity = await readVerifiedAdminIdentity();
  if (!identity || !staffRoleHasPermission(identity.role, 'research:write')) {
    return { status: 'error', error: 'A staff session with research permission is required.' };
  }

  const researchCaseId = String(formData.get('researchCaseId') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
  const operatorId = identity.uid;
  const shouldCommit = formData.get('commit') === '1';

  if (!researchCaseId) return { status: 'error', error: 'Research case id is required.' };
  if (!description) return { status: 'error', error: 'Description is required.' };
  if (!sourceUrl) return { status: 'error', error: 'Source URL is required.' };

  const privacyPepper = process.env.SUBMISSION_PRIVACY_PEPPER;
  if (!privacyPepper) {
    return { status: 'error', error: 'Server is missing SUBMISSION_PRIVACY_PEPPER.' };
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
        error:
          outcome.rejection.issues
            .map((issue: { readonly message: string }) => issue.message)
            .join('; ') || 'Rejected',
      };
    }

    if (shouldCommit) {
      const store = createPostgresAtomicStore(getPostgresPool());
      const commitResult = await commitOperatorIntake(store, outcome as OperatorIntakeAccepted);
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
