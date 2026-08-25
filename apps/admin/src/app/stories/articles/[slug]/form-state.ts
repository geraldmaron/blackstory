/**
 * Server-action state for saving or publishing an article cover package.
 */
import type { CoverPackage, CoverPackageIssue } from '@repo/domain';

export type CoverFormState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved'; readonly message: string }
  | {
      readonly status: 'blocked';
      readonly message: string;
      readonly issues: readonly CoverPackageIssue[];
    }
  | {
      readonly status: 'cover_ready';
      readonly message: string;
      readonly cover: CoverPackage;
    }
  | { readonly status: 'error'; readonly message: string };

export const COVER_FORM_INITIAL: CoverFormState = { status: 'idle' };
