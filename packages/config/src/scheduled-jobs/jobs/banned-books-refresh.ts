/**
 * REAL roster entry: quarterly banned-books listing refresh. Pure/testable job body that
 * re-validates curated `BannedBookRecord` rows and purchase-link reachability via an injected
 * `checkUrl` port. Never auto-publishes entities (`publicEffect: 'none'`). Research worker
 * wiring (`dataset_refresh.refresh_banned_books_listing`) loads the seed catalog and persists
 * snapshot proposals; this module is the TypeScript policy layer the roster dispatches through.
 */
import {
  markPurchaseLinkValidation,
  validateBannedBookRecord,
  type BannedBookCitation,
  type BannedBookPurchaseLink,
  type BannedBookRecord,
} from '@repo/domain';
import { completeJobRun, failJobRun, startJobRun, type JobRunRecord } from '../run-record.js';

export const BANNED_BOOKS_REFRESH_JOB_ID = 'external-dataset-refresh-banned-books';

export type BannedBooksUrlCheckResult = {
  readonly ok: boolean;
  readonly status?: number;
};

export type BannedBooksCheckUrl = (url: string) => Promise<BannedBooksUrlCheckResult>;

export type BannedBooksRefreshJobInput = {
  readonly jobRunId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly books: readonly BannedBookRecord[];
  readonly checkUrl: BannedBooksCheckUrl;
};

export type BannedBooksValidationError = {
  readonly bookId: string;
  readonly errors: readonly string[];
};

export type BannedBooksRefreshJobResult = {
  readonly run: JobRunRecord;
  readonly booksValidated: number;
  readonly linksChecked: number;
  readonly linksValid: number;
  readonly linksInvalid: number;
  readonly validationErrors: readonly BannedBooksValidationError[];
  readonly updatedBooks: readonly BannedBookRecord[];
};

function collectCitationUrls(book: BannedBookRecord): readonly BannedBookCitation[] {
  const citations: BannedBookCitation[] = [...book.citations];
  for (const challenge of book.challenges) {
    citations.push(challenge.citation);
  }
  return citations;
}

async function checkPurchaseLinks(
  links: readonly BannedBookPurchaseLink[],
  checkUrl: BannedBooksCheckUrl,
  validatedAt: string,
): Promise<{
  readonly updatedLinks: readonly BannedBookPurchaseLink[];
  readonly linksChecked: number;
  readonly linksValid: number;
  readonly linksInvalid: number;
  readonly invalidHrefs: readonly string[];
}> {
  const updatedLinks: BannedBookPurchaseLink[] = [];
  let linksChecked = 0;
  let linksValid = 0;
  let linksInvalid = 0;
  const invalidHrefs: string[] = [];

  for (const link of links) {
    const result = await checkUrl(link.href);
    linksChecked += 1;
    const status = result.ok ? 'valid' : 'invalid';
    if (result.ok) {
      linksValid += 1;
    } else {
      linksInvalid += 1;
      invalidHrefs.push(link.href);
    }
    updatedLinks.push(markPurchaseLinkValidation(link, status, validatedAt));
  }

  return {
    updatedLinks: Object.freeze(updatedLinks),
    linksChecked,
    linksValid,
    linksInvalid,
    invalidHrefs: Object.freeze(invalidHrefs),
  };
}

async function checkCitationUrls(
  citations: readonly BannedBookCitation[],
  checkUrl: BannedBooksCheckUrl,
): Promise<{
  readonly linksChecked: number;
  readonly linksValid: number;
  readonly linksInvalid: number;
  readonly invalidHrefs: readonly string[];
}> {
  let linksChecked = 0;
  let linksValid = 0;
  let linksInvalid = 0;
  const invalidHrefs: string[] = [];

  for (const citation of citations) {
    const result = await checkUrl(citation.href);
    linksChecked += 1;
    if (result.ok) {
      linksValid += 1;
    } else {
      linksInvalid += 1;
      invalidHrefs.push(citation.href);
    }
  }

  return {
    linksChecked,
    linksValid,
    linksInvalid,
    invalidHrefs: Object.freeze(invalidHrefs),
  };
}

/**
 * Runs one banned-books refresh pass over the supplied catalog rows. Validates structure,
 * checks purchase links and citation URLs through `checkUrl`, and returns updated purchase-link
 * validation metadata without publishing entities.
 */
export async function runBannedBooksRefreshJob(
  input: BannedBooksRefreshJobInput,
): Promise<BannedBooksRefreshJobResult> {
  const started = startJobRun({
    jobId: BANNED_BOOKS_REFRESH_JOB_ID,
    jobRunId: input.jobRunId,
    startedAt: input.startedAt,
  });

  try {
    const validationErrors: BannedBooksValidationError[] = [];
    const updatedBooks: BannedBookRecord[] = [];
    const issues: string[] = [];
    let booksValidated = 0;
    let linksChecked = 0;
    let linksValid = 0;
    let linksInvalid = 0;

    for (const book of input.books) {
      const validation = validateBannedBookRecord(book);
      if (!validation.ok) {
        validationErrors.push({
          bookId: book.id,
          errors: validation.errors,
        });
        issues.push(`${book.id}:validation:${validation.errors[0] ?? 'invalid'}`);
        updatedBooks.push(book);
        continue;
      }

      booksValidated += 1;

      const purchaseOutcome = await checkPurchaseLinks(
        book.purchaseLinks,
        input.checkUrl,
        input.completedAt,
      );
      const citationOutcome = await checkCitationUrls(
        collectCitationUrls(book),
        input.checkUrl,
      );
      const provenanceOutcome = await input.checkUrl(book.provenance.sourceUrl);
      linksChecked +=
        purchaseOutcome.linksChecked + citationOutcome.linksChecked + 1;
      linksValid +=
        purchaseOutcome.linksValid +
        citationOutcome.linksValid +
        (provenanceOutcome.ok ? 1 : 0);
      linksInvalid +=
        purchaseOutcome.linksInvalid +
        citationOutcome.linksInvalid +
        (provenanceOutcome.ok ? 0 : 1);

      for (const href of [
        ...purchaseOutcome.invalidHrefs,
        ...citationOutcome.invalidHrefs,
        ...(provenanceOutcome.ok ? [] : [book.provenance.sourceUrl]),
      ]) {
        issues.push(`${book.id}:link-invalid:${href}`);
      }

      updatedBooks.push(
        Object.freeze({
          ...book,
          purchaseLinks: purchaseOutcome.updatedLinks,
        }),
      );
    }

    const run = completeJobRun(started, {
      completedAt: input.completedAt,
      itemsExpected: input.books.length,
      itemsProcessed: updatedBooks.length,
      costUnits: linksChecked,
      issues,
    });

    return {
      run,
      booksValidated,
      linksChecked,
      linksValid,
      linksInvalid,
      validationErrors: Object.freeze(validationErrors),
      updatedBooks: Object.freeze(updatedBooks),
    };
  } catch (error) {
    const run = failJobRun(started, {
      completedAt: input.completedAt,
      errorSummary: error instanceof Error ? error.message : String(error),
    });
    return {
      run,
      booksValidated: 0,
      linksChecked: 0,
      linksValid: 0,
      linksInvalid: 0,
      validationErrors: Object.freeze([]),
      updatedBooks: Object.freeze([]),
    };
  }
}
