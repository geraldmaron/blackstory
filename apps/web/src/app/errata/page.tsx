/**
 * Public errata log: one dated row per published change, newest first. Companion feeds at
 * /errata/feed.json and /errata/feed.xml, built from the same entry list as this page.
 *
 * `?type=` narrows the log to one kind of change through ordinary links, so the filter works
 * without JavaScript and every narrowing has its own address.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Chip, PageHeader } from '@repo/ui';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import {
  PublishingPrinciplesJsonLdScript,
  TrustSiteJsonLdScript,
  TrustLinks,
  TrustMast,
  TrustSheet,
} from '../../components/trust/index';
import { listErrataEntries } from '../../lib/trust/errata-seed';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import {
  ERRATA_CHANGE_TYPES,
  ERRATA_CHANGE_TYPE_LABELS,
  isErrataChangeType,
} from '../../lib/trust/domain-trust';
import { loadRecordsCatalog } from '../../lib/records/records-catalog';
import { parentCrumb, Room } from '../../components/room';
import { ErrataSections } from './ErrataSections';
import { errataDate } from './errata-headline';
import { resolveErrataRecordHrefs, type CatalogName } from './errata-records';
import '../reading-room.css';
import '../../components/trust/trust.css';
import './errata.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/errata',
  title: 'Errata',
  description:
    'Reverse-chronological log of corrections, clarifications, updates, and editor notes on published BlackStory records. Every change keeps its date.',
});

type ErrataPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PLURAL: Readonly<Record<string, string>> = {
  correction: 'Corrections',
  clarification: 'Clarifications',
  update: 'Updates',
  editors_note: 'Editor’s notes',
};

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function ErrataPage({ searchParams }: ErrataPageProps) {
  const query = await searchParams;
  const type =
    typeof query.type === 'string' && isErrataChangeType(query.type) ? query.type : undefined;
  const all = listErrataEntries();
  const entries = type === undefined ? all : all.filter((entry) => entry.changeType === type);

  // A catalog outage leaves the log readable, only without record links.
  const catalog = await loadRecordsCatalog()
    .then(({ data }) => data as readonly CatalogName[])
    .catch(() => [] as readonly CatalogName[]);
  const recordHrefs = resolveErrataRecordHrefs(entries, catalog);

  const latest = all[0];
  const dek =
    latest === undefined
      ? 'Every change to a published record lands here, with its date. Nothing on this site is edited quietly.'
      : `${all.length} published changes, the latest on ${MONTH.format(new Date(errataDate(latest.timestamp)))}. Nothing on this site is edited quietly.`;

  const present = ERRATA_CHANGE_TYPES.filter((kind) =>
    all.some((entry) => entry.changeType === kind),
  );

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast
          tone="copper"
          numeral={
            all.length === 0
              ? undefined
              : {
                  value: all.length.toLocaleString('en-US'),
                  label: 'published changes, none of them quiet',
                  decorative: true,
                }
          }
        >
          <PageHeader
            display
            crumb={parentCrumb('/errata')}
            linkAs={Link}
            title="Every mistake, published"
            dek={dek}
          />
        </TrustMast>
      }
    >
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript pagePath={TRUST_PATHS.errata} pageTitle="Errata" />
      <TrustSheet>
        <nav className="ds-errata__kinds" aria-label="Show one kind of change">
          {/* The total is the dek's; the kinds keep their own counts. */}
          <Chip href="/errata" selected={type === undefined}>
            All
          </Chip>
          {present.map((kind) => (
            <Chip key={kind} href={`/errata?type=${kind}`} selected={type === kind}>
              {PLURAL[kind] ?? ERRATA_CHANGE_TYPE_LABELS[kind]}{' '}
              {all.filter((entry) => entry.changeType === kind).length}
            </Chip>
          ))}
        </nav>

        <ErrataSections entries={entries} recordHrefs={recordHrefs} />

        <p className="ds-errata__feeds">
          Follow the log by <a href="/errata/feed.xml">RSS</a> or{' '}
          <a href="/errata/feed.json">JSON Feed</a>.
        </p>

        <TrustLinks
          links={[
            {
              href: '/corrections',
              title: 'Request a correction',
              line: 'A person reads it, and you get a receipt code. Nothing publishes on arrival.',
            },
            {
              href: '/methodology#how-a-record-gets-in',
              title: 'How a correction is handled',
              line: 'A fix is appended. The earlier reading stays readable.',
            },
          ]}
        />
      </TrustSheet>
    </Room>
  );
}
