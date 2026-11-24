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
import {
  LEAD_FIELD_LIMITS,
  MIN_WHY_IT_MATTERS_LENGTH,
  leadOverLength,
  leadTooLongMessage,
  tooLongMessage,
} from './lead-intake';

/** `writeTo` is the address a reader with no link is sent to; the page supplies it. */
export function validateLeadForm(data: FormData, writeTo: string): FieldErrors {
  const errors: Record<string, string> = {};
  const url = fieldText(data, 'url');
  if (url.length === 0) {
    errors.url = `Add the link where this lives online. A lead without one cannot be checked. If there is no link, write to ${writeTo} instead.`;
  } else if (!isHttpsUrl(url)) {
    errors.url = URL_MESSAGE;
  }
  const why = fieldText(data, 'whyItMatters');
  if (why.length < MIN_WHY_IT_MATTERS_LENGTH) {
    errors.whyItMatters = `Say in a sentence why this should be researched. It needs at least ${MIN_WHY_IT_MATTERS_LENGTH} characters.`;
  }
  const contact = fieldText(data, 'contact');
  if (contact.length > 0 && !isEmail(contact)) errors.contact = EMAIL_MESSAGE;
  for (const [field, what, max] of LEAD_FIELD_LIMITS) {
    if (fieldText(data, field).length > max) errors[field] = tooLongMessage(what, max);
  }
  // The intake caps the whole composed lead too, so it is measured the way the intake builds it.
  if (errors.whyItMatters === undefined) {
    const over = leadOverLength({
      description: fieldText(data, 'description') || undefined,
      whyItMatters: why,
      location: fieldText(data, 'location') || undefined,
      era: fieldText(data, 'era') || undefined,
      attestation: data.get('attestation') === 'on',
    });
    if (over > 0) errors.whyItMatters = leadTooLongMessage(over);
  }
  return errors;
}

/** The intake names some fields differently from the form; the quarantine says `sourceUrls`. */
export function leadIssueField(field: string): string {
  return field === 'sourceUrls' ? 'url' : field;
}
