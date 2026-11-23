/**
 * Cite a record or a story through the system share sheet (docs/ui/DESIGN.md section 11), with
 * the strings the web's Cite control builds.
 *
 * OFF by default. The owner has not reviewed the MLA, APA and Chicago formats (DESIGN.md
 * section 15 item 5; section 7.6 gates Cite on that review). Turn this one constant on when
 * they have; nothing else needs to change.
 */
import { Share } from 'react-native';

import { formatStyledCitations, type StyledCitationInput } from './format';

export const CITE_ENABLED: boolean = false;

export type CiteSource = {
  /** The page's title: a record's name, a story's title. */
  readonly title: string;
  /** The page's public address on the web. */
  readonly url: string;
  /** The page's last-revision or publication date, ISO. Never the subject's date. */
  readonly published?: string | undefined;
};

function validDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The three citations as plain text, one style to a paragraph. A share sheet carries no italics,
 * so the italic runs print as plain words; the words and punctuation are the web's.
 */
export function citationText(source: CiteSource, accessed: Date): string {
  const input: StyledCitationInput = {
    title: source.title,
    url: source.url,
    accessed,
    published: validDate(source.published),
  };
  return formatStyledCitations(input)
    .map(
      ({ style, parts }) =>
        `${style}\n${parts.map((part) => (typeof part === 'string' ? part : part.i)).join('')}`,
    )
    .join('\n\n');
}

export type CiteResult = 'shared' | 'dismissed' | 'unavailable';

/** Opens the system share sheet with the citation. The access date is today's. */
export async function shareCitation(source: CiteSource): Promise<CiteResult> {
  try {
    const result = await Share.share({
      message: citationText(source, new Date()),
      title: `Cite ${source.title}`,
    });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'unavailable';
  }
}
