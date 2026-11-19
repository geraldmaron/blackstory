/**
 * The lead form's own checks, run in the browser as a reader fills it in. They mirror the
 * intake's rules (`lead-intake.ts` and the quarantine's HTTPS-source rule) so a reader learns
 * what to fix before sending, not after; the server still decides.
 */
import {
  EMAIL_MESSAGE,
  URL_MESSAGE,
  fieldText,
  isEmail,
  isHttpsUrl,
} from '../../components/forms/validators';
import type { FieldErrors } from '../../components/forms/use-field-errors';

export const MIN_WHY_LENGTH = 10;

export function validateLeadForm(data: FormData): FieldErrors {
  const errors: Record<string, string> = {};
  const url = fieldText(data, 'url');
  if (url.length === 0) {
    errors.url =
      'Add the link where this lives online. A lead without one cannot be checked; if there is no link, write instead.';
  } else if (!isHttpsUrl(url)) {
    errors.url = URL_MESSAGE;
  }
  const description = fieldText(data, 'description');
  if (description.length > 4000) errors.description = 'Shorten this to 4,000 characters or fewer.';
  const why = fieldText(data, 'whyItMatters');
  if (why.length < MIN_WHY_LENGTH) {
    errors.whyItMatters = `Say in a sentence why this should be researched. It needs at least ${MIN_WHY_LENGTH} characters.`;
  } else if (why.length > 4000) {
    errors.whyItMatters = 'Shorten this to 4,000 characters or fewer.';
  }
  if (fieldText(data, 'location').length > 200) errors.location = 'Shorten this to 200 characters.';
  if (fieldText(data, 'era').length > 200) errors.era = 'Shorten this to 200 characters.';
  const contact = fieldText(data, 'contact');
  if (contact.length > 0 && !isEmail(contact)) errors.contact = EMAIL_MESSAGE;
  return errors;
}

/** The intake names some fields differently from the form; the quarantine says `sourceUrls`. */
export function leadIssueField(field: string): string {
  return field === 'sourceUrls' ? 'url' : field;
}
