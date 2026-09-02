'use server';

/**
 * Save or publish an article cover package. Publish is fail-closed and does
 * not activate a public release.
 */
import { coverPackageInputFromFields, evaluateCoverPackage } from '@repo/domain';
import { readVerifiedAdminIdentity } from '../../../../auth/supabase-server';
import { isCoverArticleSlug } from '../../../../stories/cover-article-catalog';
import { COVER_PUBLISH_BLOCKED, COVER_PUBLISH_READY } from '../../../../stories/cover-package-copy';
import { attemptCoverPackagePublish } from '../../../../stories/cover-package-publish';
import { saveCoverDraft } from '../../../../stories/cover-package-store';
import { COVER_FORM_INITIAL, type CoverFormState } from './form-state';

function fieldsFromForm(formData: FormData) {
  const plate = formData.get('plate');
  const uploadedName = plate instanceof File && plate.size > 0 ? plate.name : '';
  const storedName = String(formData.get('plateAssetName') ?? '').trim();
  return coverPackageInputFromFields({
    situation: String(formData.get('situation') ?? ''),
    metaphor: String(formData.get('metaphor') ?? ''),
    refuse: String(formData.get('refuse') ?? ''),
    recipe: String(formData.get('recipe') ?? ''),
    plateAssetName: uploadedName || storedName,
    plateLockCite: String(formData.get('plateLockCite') ?? ''),
    plateSourceUrl: String(formData.get('plateSourceUrl') ?? ''),
    plateAlt: String(formData.get('plateAlt') ?? ''),
    kicker: String(formData.get('kicker') ?? ''),
    headline: String(formData.get('headline') ?? ''),
  });
}

export async function saveCoverPackage(
  _previous: CoverFormState = COVER_FORM_INITIAL,
  formData: FormData,
): Promise<CoverFormState> {
  const identity = await readVerifiedAdminIdentity();
  if (!identity) {
    return { status: 'error', message: 'Sign in required.' };
  }
  const slug = String(formData.get('slug') ?? '').trim();
  if (!isCoverArticleSlug(slug)) {
    return { status: 'error', message: 'That article slug is not valid.' };
  }
  const draft = fieldsFromForm(formData);
  saveCoverDraft(slug, draft);
  const evaluation = evaluateCoverPackage(draft);
  if (!evaluation.ok) {
    return {
      status: 'saved',
      message: 'Draft saved. Publish stays blocked until the cover package is valid.',
    };
  }
  return { status: 'saved', message: 'Draft saved. The package is valid and can be published.' };
}

export async function publishCoverPackage(
  _previous: CoverFormState = COVER_FORM_INITIAL,
  formData: FormData,
): Promise<CoverFormState> {
  const identity = await readVerifiedAdminIdentity();
  if (!identity) {
    return { status: 'error', message: 'Sign in required.' };
  }
  const slug = String(formData.get('slug') ?? '').trim();
  if (!isCoverArticleSlug(slug)) {
    return { status: 'error', message: 'That article slug is not valid.' };
  }

  const result = attemptCoverPackagePublish({
    slug,
    package: fieldsFromForm(formData),
    role: identity.role,
  });

  if (!result.ok) {
    return {
      status: 'blocked',
      message: result.issues.length > 0 ? COVER_PUBLISH_BLOCKED : result.message,
      issues: result.issues,
    };
  }

  return {
    status: 'cover_ready',
    message: COVER_PUBLISH_READY,
    cover: result.cover,
  };
}
