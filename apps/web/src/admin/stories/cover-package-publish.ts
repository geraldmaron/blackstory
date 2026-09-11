/**
 * Publish attempt for an article cover package. Fail closed. Does not activate
 * a public release.
 */
import {
  assertCoverPackageForPublish,
  CoverPackagePublishError,
  type CoverPackage,
  type CoverPackageInput,
  type CoverPackageIssue,
} from '@repo/domain';
import type { StaffRole } from '../auth/role-mutation';
import { StaffPermissionDeniedError, assertStaffPermission } from '../auth/staff-permissions';
import { markCoverReady } from './cover-package-store';

export type CoverPublishResult =
  | { readonly ok: true; readonly cover: CoverPackage; readonly published: false }
  | {
      readonly ok: false;
      readonly published: false;
      readonly issues: readonly CoverPackageIssue[];
      readonly message: string;
    };

export function attemptCoverPackagePublish(input: {
  readonly slug: string;
  readonly package: CoverPackageInput;
  readonly role: StaffRole;
}): CoverPublishResult {
  try {
    assertStaffPermission(input.role, 'publication:publish');
  } catch (error) {
    if (error instanceof StaffPermissionDeniedError) {
      return {
        ok: false,
        published: false,
        issues: [],
        message: `Role ${error.role} cannot publish. Publication or admin must submit the cover.`,
      };
    }
    throw error;
  }

  try {
    const cover = assertCoverPackageForPublish(input.package);
    markCoverReady(input.slug, cover);
    return { ok: true, cover, published: false };
  } catch (error) {
    if (error instanceof CoverPackagePublishError) {
      return {
        ok: false,
        published: false,
        issues: error.issues,
        message: error.message,
      };
    }
    throw error;
  }
}
