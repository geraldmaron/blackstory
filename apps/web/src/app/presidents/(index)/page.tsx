/**
 * `/presidents`: every president on the record, in term order. A collection, not a story: each
 * entry has the same shape (term, what the presidency did, the personal record, where sources
 * disagree, sources), and the set reads in one natural order. Rows are the Stories list row on the
 * Parked frame's one sheet, so a reader who knows one list knows the other. Works with JavaScript off.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageHeader } from '@repo/ui';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import { listPublicStoryListItems } from '../../../lib/stories/source';
import { storyBasePath } from '../../../lib/stories/story-routes';
import { parentCrumb, PageFrame } from '../../../components/page';
import { TrustMast, TrustSheet } from '../../../components/trust';
import { sortItems } from '../../stories/stories-index';
import { StoryRow } from '../../stories/StoriesIndexParts';
import '../../stories/stories.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/presidents',
  title: 'Presidents',
  description:
    'Every U.S. president, in term order, on slavery, civil rights and Black Americans: what each presidency did, the personal record, where the sources disagree, and the sources for every line.',
});

export default async function PresidentsPage() {
  const { items, source } = await listPublicStoryListItems();
  const presidents = sortItems(
    items.filter((item) => storyBasePath(item) === '/presidents'),
    'collection',
  );

  return (
    <PageFrame
      width="wide"
      className="ds-trust-doc ds-stories ds-presidents"
      masthead={
        <TrustMast
          numeral={
            presidents.length > 0
              ? { value: String(presidents.length), label: 'presidents, in term order' }
              : undefined
          }
        >
          <PageHeader
            display
            crumb={parentCrumb('/presidents')}
            linkAs={Link}
            title="Presidents"
            dek="Every president on slavery, civil rights and Black Americans, with the sources for each line."
          />
        </TrustMast>
      }
    >
      <TrustSheet className="ds-stories-paper">
        {source === 'unavailable' || presidents.length === 0 ? (
          <div className="ds-stories-notice">
            <Notice
              tone={source === 'unavailable' ? 'warning' : 'note'}
              title={
                source === 'unavailable'
                  ? 'The presidents are temporarily unavailable'
                  : 'No entries are published yet'
              }
            >
              {source === 'unavailable'
                ? 'The live record could not be reached, so the list cannot be shown right now. Nothing is lost. Reload or check back shortly.'
                : 'No president entries are published yet.'}
            </Notice>
          </div>
        ) : (
          <ol className="ds-stories-list" aria-label="Presidents in term order">
            {presidents.map((item) => (
              <StoryRow key={item.slug} item={item} />
            ))}
          </ol>
        )}
      </TrustSheet>
    </PageFrame>
  );
}
