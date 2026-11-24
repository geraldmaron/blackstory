/**
 * The correction form's own checks, run as a reader fills it in. They mirror
 * `correction-intake.ts` so the reader learns what to fix before sending; the server still
 * decides. Messages say how to fix the problem, not only what it is.
 */
import {
  EMAIL_MESSAGE,
  URL_MESSAGE,
  fieldText,
  isEmail,
  isHttpsUrl,
} from '../../components/forms/validators';
import type { FieldErrors } from '../../components/forms/use-field-errors';
import { isCorrectionCategory } from './categories';
import {
  MAX_CONTACT_LENGTH,
  MAX_STATEMENT_LENGTH,
  MAX_TARGET_ID_LENGTH,
  MIN_STATEMENT_LENGTH,
  tooLongMessage,
} from './correction-intake';

export function validateCorrectionForm(data: FormData): FieldErrors {
  const errors: Record<string, string> = {};
  const target = fieldText(data, 'targetRecordId');
  if (target.length === 0) {
    errors.targetRecordId =
      'Name the record, or paste its page address, so the right one gets read.';
  } else if (target.length > MAX_TARGET_ID_LENGTH) {
    errors.targetRecordId = `This is ${target.length} characters and the limit is ${MAX_TARGET_ID_LENGTH}. Paste only the page address, or name the record in a few words.`;
  }
  if (!isCorrectionCategory(fieldText(data, 'category'))) {
    errors.category = 'Choose the closest kind of problem. You can explain the rest below.';
  }
  const statement = fieldText(data, 'statement');
  if (statement.length < MIN_STATEMENT_LENGTH) {
    errors.statement = `Say what it should say instead. It needs at least ${MIN_STATEMENT_LENGTH} characters.`;
  } else if (statement.length > MAX_STATEMENT_LENGTH) {
    errors.statement = tooLongMessage('what it should say', MAX_STATEMENT_LENGTH);
  }
  const source = fieldText(data, 'sourceUrl');
  if (source.length === 0) {
    errors.sourceUrl =
      'Add a link where the right version can be checked. A correction without one cannot be reviewed.';
  } else if (!isHttpsUrl(source)) {
    errors.sourceUrl = URL_MESSAGE;
  }
  const contact = fieldText(data, 'contact');
  if (contact.length > MAX_CONTACT_LENGTH) {
    errors.contact = tooLongMessage('the email address', MAX_CONTACT_LENGTH);
  } else if (contact.length > 0 && !isEmail(contact)) errors.contact = EMAIL_MESSAGE;
  if (data.get('privacyConsent') !== 'on') {
    errors.privacyConsent = 'Tick the box to confirm you have read how a correction is handled.';
  }
  return errors;
}
