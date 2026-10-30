/**
 * Footprint: where the published archive stands, state by state, and how complete its records
 * are. A server component with no client JS; every count links to the catalog records it counts,
 * through the same state attribution the catalog filter uses (footprint-attribution.ts).
 *
 * The map is decorative. The table carries the same information and is the accessible content.
 */
import Link from 'next/link';
import { DeskTitleBar, Panel, StatGrid, StatTile } from '../../../admin/design-system/ui';
import { readPostgresOrDegrade } from '../../../admin/lib/canonical-postgres-client';
import { entityQueryHref } from '../../../admin/lib/entity-query-params';
import { FOOTPRINT_STATES, UNASSIGNED_STATE } from '../../../admin/lib/footprint-attribution';
import { readFootprint } from '../../../admin/lib/footprint-store';
import './footprint.css';

export const dynamic = 'force-dynamic';

const CATALOG_PATH = '/admin/catalog';

/** The canvas is 960 x 500, so 100 units wide is 52.083 tall; percent coordinates map straight across. */
const CANVAS_HEIGHT = (500 / 960) * 100;
const MIN_RADIUS = 0.45;
const MAX_RADIUS = 2.4;

function catalogHref(state: string): string {
  return entityQueryHref(CATALOG_PATH, {}, { state });
}

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%';
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

export default async function FootprintPage() {
  const outcome = await readPostgresOrDegrade(() => readFootprint(), 'footprint');

  if (outcome.status === 'degraded') {
    return (
      <main className="ds-container ds-page" id="main">
        <DeskTitleBar eyebrow="Catalog" title="Footprint" />
        <p className="story-review__alert" role="alert">
          The catalog database did not answer, so this page is showing nothing rather than waiting.
          Reload to retry. <span className="ds-mono">{outcome.reason}</span>
        </p>
      </main>
    );
  }

  const footprint = outcome.value;
  const drawn = footprint.mapBins.reduce((sum, bin) => sum + bin.count, 0);
  const maxBin = footprint.mapBins.reduce((max, bin) => Math.max(max, bin.count), 1);
  // Area, not radius, tracks the count, so a bin with four times the records is twice as wide.
  const radiusFor = (count: number): number =>
    Math.min(MAX_RADIUS, MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(count / maxBin));

  return (
    <main className="ds-container ds-page footprint" id="main">
      <DeskTitleBar
        eyebrow="Catalog"
        title="Footprint"
        meta={<span>{footprint.publishedTotal.toLocaleString()} published records</span>}
        description="Where the published archive stands, state by state, and how complete its records are. Every count links to the catalog records it counts."
      />

      <StatGrid label="Footprint totals">
        <StatTile label="Published records" value={footprint.publishedTotal.toLocaleString()} />
        <StatTile
          label="States covered"
          value={`${footprint.states.length} of ${FOOTPRINT_STATES.length}`}
        />
        <StatTile
          label="No state assigned"
          value={footprint.unassigned.toLocaleString()}
          href={catalogHref(UNASSIGNED_STATE)}
          tone={footprint.unassigned > 0 ? 'attention' : 'muted'}
        />
        <StatTile
          label="Not in the active release"
          value={footprint.unpublishedCanonical.toLocaleString()}
        />
        <StatTile
          label="Minimum-record share"
          value={percent(footprint.minimumRecordTotal, footprint.publishedTotal)}
          hint="of all published records"
        />
      </StatGrid>

      <Panel title="Map">
        <div className="footprint__map" aria-hidden="true">
          <span className="footprint__ground" />
          <svg
            className="footprint__bins"
            viewBox={`0 0 100 ${CANVAS_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {footprint.mapBins.map((bin) => (
              <circle
                key={`${bin.x}:${bin.y}`}
                className="footprint__bin"
                cx={bin.x}
                cy={(bin.y / 100) * CANVAS_HEIGHT}
                r={radiusFor(bin.count)}
              />
            ))}
          </svg>
        </div>
        <p className="footprint__caption">
          {drawn.toLocaleString()} records drawn; {footprint.offMap.toLocaleString()} have no
          position on this map. Positions are held to city precision.
        </p>
      </Panel>

      {/* The explanation is the panel's description, not the table caption: a caption scrolls
          sideways with a wide table and is cut off on a phone. Screen readers keep a caption. */}
      <Panel
        title="By state"
        description="Published records by state, with their record maturity. Share at minimum is the part of a state's records still at the minimum record."
        flush
      >
        <table className="footprint__table">
          <caption className="ds-visually-hidden">
            Published records by state and record maturity
          </caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              <th scope="col" className="footprint__num">
                Records
              </th>
              <th scope="col" className="footprint__num">
                Minimum record
              </th>
              <th scope="col" className="footprint__num">
                Partial enrichment
              </th>
              <th scope="col" className="footprint__num">
                Other
              </th>
              <th scope="col" className="footprint__num">
                Share at minimum
              </th>
            </tr>
          </thead>
          <tbody>
            {footprint.states.map((state) => (
              <tr key={state.postalCode}>
                <th scope="row">
                  <Link href={catalogHref(state.postalCode)}>{state.name}</Link>
                </th>
                <td className="footprint__num">{state.total.toLocaleString()}</td>
                <td className="footprint__num">{state.minimumRecord.toLocaleString()}</td>
                <td className="footprint__num">{state.partialEnrichment.toLocaleString()}</td>
                <td className="footprint__num">{state.otherMaturity.toLocaleString()}</td>
                <td className="footprint__num">{percent(state.minimumRecord, state.total)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">
                <Link href={catalogHref(UNASSIGNED_STATE)}>No state assigned</Link>
              </th>
              <td className="footprint__num">{footprint.unassigned.toLocaleString()}</td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="No published records">
        {footprint.emptyStates.length === 0 ? (
          <p>Every state has at least one published record.</p>
        ) : (
          <ul className="footprint__chips">
            {footprint.emptyStates.map((state) => (
              <li key={state.postalCode}>
                <Link href={catalogHref(state.postalCode)}>{state.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="By kind">
        <ul className="footprint__kinds">
          {footprint.kinds.map((entry) => (
            <li key={entry.kind}>
              <span>{titleCase(entry.kind)}</span>
              <span className="footprint__num">{entry.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
