/**
 * `/sources` body: the publishers the released catalog cites, with how many records cite each,
 * then how a URL becomes a citation and the kinds of publisher the archive weighs differently.
 */
import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, RoomJump, RoomSection } from '../../components/room';
import { TrustFlow } from '../../components/trust';
import { SOURCE_LINEAGE_STAGES, SOURCE_PUBLISHER_KINDS } from '../methodology/methodology-copy';
import type { SourceLibrary } from './source-library';
import { SourcesTable } from './SourcesTable';

void React;

const SOURCES_JUMP = [
  { id: 'publishers', label: 'Publishers' },
  { id: 'citation-chain', label: 'Citation chain' },
  { id: 'publisher-kinds', label: 'Kinds of publisher' },
] as const;

const count = (value: number) => value.toLocaleString('en-US');

function dekFor(library: SourceLibrary | undefined): string {
  if (library === undefined) {
    return 'Every public claim on BlackStory traces to a publisher someone can open.';
  }
  const citing =
    library.citingRecords === library.totalRecords
      ? 'every published record'
      : `${count(library.citingRecords)} of the ${count(library.totalRecords)} published records`;
  return `${count(library.rows.length)} publishers, cited by ${citing}.`;
}

export function SourcesSections({ library }: { readonly library: SourceLibrary | undefined }) {
  return (
    <>
      <PageHeader
        crumb={parentCrumb('/sources')}
        linkAs={Link}
        title="Where the evidence comes from"
        dek={dekFor(library)}
      />

      <RoomJump sections={SOURCES_JUMP} />

      <RoomSection id="publishers" title="Publishers">
        {library === undefined ? (
          <p className="ds-trust-note" role="status">
            <strong>The publisher list could not be loaded just now.</strong> Every record page
            still lists its own sources. Reload this page in a minute, or{' '}
            <Link href="/records">browse the records</Link>.
          </p>
        ) : library.rows.length === 0 ? (
          <p className="ds-trust-note" role="status">
            No published record cites a source yet.
          </p>
        ) : (
          <SourcesTable rows={library.rows} />
        )}
        <p className="ds-trust-note">
          Kind is read from the web address (.gov, .edu, .org), not from a review of the publisher.
          Wikipedia is listed when a record cites it, and it never counts as one of the two
          independent sources a grade needs. How a grade reads these sources is on the{' '}
          <Link href="/methodology#evidence-grades">methodology page</Link>.
        </p>
      </RoomSection>

      <RoomSection id="citation-chain" title="How a URL becomes a citation">
        <p className="ds-trust-lead">
          A source is captured when it is found, so the reading survives even if the page does not.
        </p>
        <TrustFlow caption="From a research run to a record" steps={SOURCE_LINEAGE_STAGES} />
      </RoomSection>

      <RoomSection id="publisher-kinds" title="Kinds of publisher">
        <p className="ds-trust-lead">
          A government archive is not the same kind of source as a newsroom or a crowd-edited wiki,
          and a news or reference source never corroborates a claim alone.
        </p>
        <dl className="ds-trust-dl ds-trust-dl--split" aria-label="Kinds of publisher">
          {SOURCE_PUBLISHER_KINDS.map((entry) => (
            <div key={entry.kind}>
              <dt>{entry.kind}</dt>
              <dd>{entry.body}</dd>
              <dd>For example: {entry.examples}.</dd>
            </div>
          ))}
        </dl>
      </RoomSection>
    </>
  );
}
