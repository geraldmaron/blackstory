/**
 * The design-system gallery, generated from the kit (docs/ui/DESIGN.md section 7).
 *
 * It lists what `@repo/ui` exports and nothing else: every exported component is drawn from its
 * entry in `FIXTURES`, and every exported token object is printed from the module itself. A
 * component the kit exports with no fixture is drawn as a named gap, and `gallery.test.tsx` fails
 * on it, so the page cannot fall behind the kit.
 */
'use client';

import React, { useState, type ReactNode } from 'react';
import { BRAND_ASSETS } from '@repo/config';
import * as kit from '@repo/ui';
import { formatStyledCitations } from '../../lib/citation/format';

void React;

const {
  Block,
  Button,
  Chip,
  Citation,
  Cite,
  CommandPalette,
  Confidence,
  DataTable,
  DetailField,
  DetailPanel,
  Dialog,
  DisplayNumeral,
  EmptyState,
  ExhibitFrame,
  FacetRail,
  FilterBar,
  FilterButton,
  InlineEdit,
  MapExplorer,
  MapFrame,
  Notice,
  PageHeader,
  PageTitle,
  Pagination,
  Receipt,
  ResultList,
  SectionHeading,
  Segmented,
  SelectionBar,
  Sheet,
  ShellWordmark,
  Surface,
  Tabs,
  ThemeToggle,
  Timeline,
  Toolbar,
  ToolbarField,
} = kit;

/** Every component the kit exports: a function whose name is capitalized. */
export const KIT_COMPONENT_NAMES: readonly string[] = Object.entries(kit)
  .filter(([name, value]) => typeof value === 'function' && /^[A-Z][a-z]/.test(name))
  .map(([name]) => name)
  .sort();

/** Every token object the kit exports: a plain object, printed as it is. */
export const KIT_TOKEN_NAMES: readonly string[] = Object.entries(kit)
  .filter(([, value]) => typeof value === 'object' && value !== null && !Array.isArray(value))
  .map(([name]) => name)
  .sort();

type Row = { readonly id: string; readonly name: string; readonly year: string };
const ROWS: readonly Row[] = [
  { id: 'a', name: 'Rosenwald School site', year: '1908' },
  { id: 'b', name: 'Mutual aid hall', year: '1921' },
];

const CITE_FORMATS = formatStyledCitations({
  title: 'Black share of the U.S. population, 1790 to 2020',
  url: 'https://example.org/data/d-01',
  accessed: new Date('2026-11-23T00:00:00Z'),
});

function DialogFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open the dialog
      </Button>
      <Dialog open={open} title="Why this appears" onClose={() => setOpen(false)}>
        <p>Focus moves into the dialog; Escape and the close control dismiss it.</p>
      </Dialog>
    </>
  );
}

function PaletteFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open the palette
      </Button>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onSelect={() => setOpen(false)}
        items={[
          { id: 'archive', label: 'Archive', group: 'Go to' },
          { id: 'stories', label: 'Stories', group: 'Go to' },
        ]}
      />
    </>
  );
}

function SegmentedFixture() {
  const [value, setValue] = useState('plain');
  return (
    <Segmented
      label="Figure view"
      value={value}
      onChange={setValue}
      options={[
        { value: 'plain', label: 'Plain' },
        { value: 'portrait', label: 'Portrait' },
        { value: 'numbers', label: 'Numbers' },
      ]}
    />
  );
}

/** One entry per exported component, with its variants. Keys are the kit's export names. */
export const FIXTURES: Readonly<Record<string, () => ReactNode>> = {
  Block: () => (
    <>
      {(['paper', 'ink', 'copper', 'sand'] as const).map((tone) => (
        <Block key={tone} tone={tone} as="div">
          <p>The {tone} ground.</p>
        </Block>
      ))}
    </>
  ),
  Button: () => (
    <div className="ds-row">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="quiet">Quiet</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
      <Button href="#Button" variant="secondary">
        As a link
      </Button>
    </div>
  ),
  Chip: () => (
    <div className="ds-row">
      <Chip>Georgia</Chip>
      <Chip selected>Selected</Chip>
      <Chip removable label="Remove 1900s">
        1900s
      </Chip>
      <Chip href="#Chip">As a link</Chip>
    </div>
  ),
  Citation: () => (
    <Citation source="Library of Congress" href="https://www.loc.gov/" label="Primary source" />
  ),
  Cite: () => <Cite formats={CITE_FORMATS} />,
  CommandPalette: () => <PaletteFixture />,
  Confidence: () => (
    <div className="ds-row">
      <Confidence level="high" />
      <Confidence level="medium" />
      <Confidence level="low" />
    </div>
  ),
  DataTable: () => (
    <DataTable
      caption="Two example records"
      rows={ROWS}
      rowKey={(row: Row) => row.id}
      columns={[
        { id: 'name', header: 'Name', cell: (row: Row) => row.name },
        { id: 'year', header: 'Year', cell: (row: Row) => row.year, align: 'end' },
      ]}
    />
  ),
  DetailField: () => (
    <>
      <DetailField label="Place">Macon, Georgia</DetailField>
      <DetailField label="Record id" mono>
        ent_example_001
      </DetailField>
      <DetailField label="Date" emptyLabel="Not on record" />
    </>
  ),
  DetailPanel: () => (
    <DetailPanel title="Rosenwald School site" meta="Place">
      <DetailField label="Year">1908</DetailField>
    </DetailPanel>
  ),
  Dialog: () => <DialogFixture />,
  DisplayNumeral: () => (
    <div className="ds-row">
      <DisplayNumeral size="title">1908</DisplayNumeral>
      <DisplayNumeral size="title" tone="soft">
        1920s
      </DisplayNumeral>
      <DisplayNumeral size="title" tone="ink">
        1964
      </DisplayNumeral>
    </div>
  ),
  EmptyState: () => (
    <EmptyState title="No places matched" action={<Button variant="secondary">Clear</Button>}>
      Try a broader era, or remove the street.
    </EmptyState>
  ),
  ExhibitFrame: () => (
    <div className="ds-row" style={{ alignItems: 'start', gap: 'var(--ds-space-8)' }}>
      <ExhibitFrame
        id="gallery-figure"
        kind="figure"
        number="D-01"
        basis="1790 to 2020"
        receipt={<Receipt source="U.S. Census Bureau" detail="Working Paper 56" />}
      >
        <svg viewBox="0 0 240 90" role="img" aria-label="Three example bars">
          <rect x="0" y="10" width="232" height="18" fill="currentColor" />
          <rect x="0" y="36" width="117" height="18" fill="currentColor" />
          <rect x="0" y="62" width="149" height="18" fill="currentColor" />
        </svg>
      </ExhibitFrame>
      <ExhibitFrame
        id="gallery-map"
        kind="map"
        number="02"
        basis="exact site"
        ground="ink"
        receipt={<Receipt source="OpenFreeMap" detail="OpenStreetMap contributors" />}
      >
        <div style={{ aspectRatio: '16 / 9' }} />
      </ExhibitFrame>
      <ExhibitFrame
        id="gallery-quiet"
        kind="document"
        variant="quiet"
        basis="date not on record"
        receipt={<Receipt source="Library of Congress" />}
      >
        <div style={{ aspectRatio: '16 / 9', border: '1px solid var(--ds-rule)' }} />
      </ExhibitFrame>
    </div>
  ),
  FacetRail: () => (
    <FacetRail
      hasActiveFilters
      clearHref="#FacetRail"
      groups={[
        {
          id: 'kind',
          label: 'Kind',
          options: [
            { value: 'place', label: 'Places', count: 12, href: '#FacetRail', active: true },
            { value: 'person', label: 'People', count: 4, href: '#FacetRail', active: false },
          ],
        },
      ]}
    />
  ),
  FilterBar: () => (
    <FilterBar
      legend="Filter places"
      fields={[
        { id: 'gallery-q', name: 'q', label: 'Search', type: 'search', placeholder: 'A school' },
        {
          id: 'gallery-era',
          name: 'era',
          label: 'Era',
          type: 'select',
          defaultValue: 'all',
          options: [
            { value: 'all', label: 'All eras' },
            { value: 'reconstruction', label: 'Reconstruction' },
          ],
        },
      ]}
    />
  ),
  FilterButton: () => (
    <div className="ds-row">
      <FilterButton>Era</FilterButton>
      <FilterButton count={2}>Kind</FilterButton>
    </div>
  ),
  InlineEdit: () => (
    <>
      <InlineEdit submitLabel="Save">
        <input aria-label="Display name" defaultValue="Mutual aid hall" />
      </InlineEdit>
      <InlineEdit status="saved" message="Saved.">
        <input aria-label="Saved name" defaultValue="Mutual aid hall" />
      </InlineEdit>
      <InlineEdit status="error" message="Not saved. Try again.">
        <input aria-label="Failed name" defaultValue="Mutual aid hall" />
      </InlineEdit>
    </>
  ),
  MapExplorer: () => (
    <MapExplorer
      title="Example places by state"
      features={[
        {
          id: 'a',
          displayName: 'Rosenwald School site',
          kind: 'place',
          precision: 'exact site',
          statePostalCode: 'GA',
        },
      ]}
      stateAggregates={[{ stateName: 'Georgia', statePostalCode: 'GA', count: 1 }]}
    />
  ),
  MapFrame: () => (
    <MapFrame
      title="Example map"
      caption="A schematic. The pin marks an approximate parcel."
      pins={[{ id: 'school', label: 'Rosenwald School site', x: 42, y: 58 }]}
    />
  ),
  Notice: () => (
    <div className="ds-stack">
      <Notice tone="note" title="Content note">
        This page names people who were killed.
      </Notice>
      <Notice tone="warning" title="Source capture incomplete">
        More pages are under review.
      </Notice>
      <Notice tone="dispute" title="Two sources disagree">
        Both values and both sources are shown.
      </Notice>
      <Notice tone="error" title="This did not load">
        Try again.
      </Notice>
      <Notice tone="success" title="Lead received">
        It is reviewed before anything is added.
      </Notice>
    </div>
  ),
  PageHeader: () => (
    <>
      <PageHeader title="Methodology" dek="How a claim becomes a record." />
      <PageHeader
        display
        crumb={{ href: '#PageHeader', label: 'About' }}
        title="Sources"
        dek="Every publisher the archive cites."
      />
    </>
  ),
  PageTitle: () => <PageTitle as="h2">A page title</PageTitle>,
  Pagination: () => (
    <Pagination
      page={2}
      pageCount={9}
      pageSize={50}
      total={420}
      hrefForPage={(page: number) => `#Pagination-${page}`}
      itemLabel="records"
    />
  ),
  Receipt: () => (
    <>
      <Receipt source="U.S. Census Bureau" detail="Working Paper 56" />
      <Receipt source="Library of Congress" action={<Cite formats={CITE_FORMATS} />} />
    </>
  ),
  ResultList: () => (
    <ResultList
      labelledBy="ResultList-heading"
      items={[
        {
          id: '1',
          href: '#ResultList',
          title: 'Freedom School annex',
          summary: 'A classroom used during a local desegregation campaign.',
          meta: <span className="ds-mono">1964</span>,
        },
        {
          id: '2',
          href: '#ResultList',
          title: 'Mutual aid hall',
          summary: 'A meeting place tied to burial-society records.',
        },
      ]}
    />
  ),
  SectionHeading: () => <SectionHeading>Sources</SectionHeading>,
  Segmented: () => <SegmentedFixture />,
  SelectionBar: () => <SelectionBar selectedCount={2} matchCount={40} onClear={() => {}} />,
  Sheet: () => (
    <Sheet>
      <p>Paper with a 1px edge. Square and flat.</p>
    </Sheet>
  ),
  ShellWordmark: () => <ShellWordmark lockup={BRAND_ASSETS.lockup} />,
  Surface: () => (
    <Surface title="Rosenwald School site" meta={<span className="ds-mono">place</span>}>
      <p>A documented community school.</p>
    </Surface>
  ),
  Tabs: () => (
    <Tabs
      label="Example sections"
      items={[
        { label: 'List', href: '#Tabs', current: true },
        { label: 'Timeline', href: '#Tabs' },
        { label: 'Map', href: '#Tabs' },
      ]}
    />
  ),
  ThemeToggle: () => <ThemeToggle />,
  Timeline: () => (
    <Timeline
      labelledBy="Timeline-heading"
      items={[
        { id: 't1', time: '1908', title: 'School built', body: 'The first frame building.' },
        { id: 't2', time: '1969', title: 'Consolidation', body: 'Students move campus.' },
      ]}
    />
  ),
  Toolbar: () => (
    <Toolbar label="Example toolbar" actions={<Button variant="secondary">Apply</Button>}>
      <ToolbarField label="Search">
        <input type="search" name="q" />
      </ToolbarField>
    </Toolbar>
  ),
  ToolbarField: () => (
    <ToolbarField label="State">
      <input name="state" defaultValue="Georgia" />
    </ToolbarField>
  ),
};

/** `a.b.c` and its value for every leaf of a token object. */
function leaves(value: unknown, path: string): readonly (readonly [string, string])[] {
  if (typeof value !== 'object' || value === null) return [[path, String(value)]];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, path ? `${path}.${key}` : key),
  );
}

const isColor = (value: string) => /^#[0-9a-f]{3,8}$/i.test(value);

function TokenTable({ name }: { readonly name: string }) {
  const rows = leaves((kit as Record<string, unknown>)[name], '');
  return (
    <section className="ds-gallery-section" id={`token-${name}`}>
      <h3>{name}</h3>
      <table className="ds-gallery-tokens">
        <tbody>
          {rows.map(([path, value]) => (
            <tr key={path}>
              <th scope="row" className="ds-mono">
                {path}
              </th>
              <td className="ds-mono">
                {isColor(value) ? (
                  <span
                    className="ds-gallery-tokens__swatch"
                    style={{ background: value }}
                    aria-hidden="true"
                  />
                ) : null}
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Gallery() {
  return (
    <>
      <div className="ds-row" style={{ paddingTop: 'var(--ds-space-5)' }}>
        <ThemeToggle />
        <span>Each component below follows the theme; the token tables list both.</span>
      </div>

      <h2 id="components">Components</h2>
      {KIT_COMPONENT_NAMES.map((name) => {
        const fixture = FIXTURES[name];
        return (
          <section className="ds-gallery-section" id={name} key={name} data-kit-component={name}>
            <h3 id={`${name}-heading`}>{name}</h3>
            {fixture ? (
              fixture()
            ) : (
              <Notice tone="warning" title="No fixture">
                The kit exports {name} and this page does not draw it yet.
              </Notice>
            )}
          </section>
        );
      })}

      <h2 id="tokens">Tokens</h2>
      {KIT_TOKEN_NAMES.map((name) => (
        <TokenTable key={name} name={name} />
      ))}
    </>
  );
}
