import type { GenerateMetadataFunction } from 'expo-router/server';
import { Theme } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { H2, Paragraph } from '@tamagui/text';
import {
  Button,
  Card,
  Citation,
  Confidence,
  EmptyState,
  Notice,
  Pagination,
  ResultList,
  Timeline,
  Toolbar,
  ToolbarField,
} from '../design';

/** Developer-only: every kit component in both themes. Off unless EXPO_PUBLIC_SITE_KIT_PREVIEW=1. Set it for BOTH the export (the client bundle inlines it)
 * and the server process (it reads it at runtime); if they disagree, hydration fails with React #418. */
const ENABLED = process.env.EXPO_PUBLIC_SITE_KIT_PREVIEW === '1';

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: 'Kit preview',
  robots: { index: false, follow: false },
});

const ITEMS = [
  {
    id: 'a',
    href: '/records/a',
    title: 'Freedman’s Bank',
    summary: 'Chartered 1865; failed 1874.',
    meta: 'Finance · 1865',
  },
  {
    id: 'b',
    href: '/records/b',
    title: 'Tulsa Race Massacre',
    summary:
      'A long summary that has to wrap across more than one line at narrow widths so the row layout is exercised properly.',
    meta: 'Violence · 1921',
  },
];
const EVENTS = [
  { id: '1', time: '1865', title: 'Bank chartered', body: 'Signed into law in March.' },
  { id: '2', time: '1874', title: 'Bank fails', body: 'Depositors lose most savings.' },
];

function Section({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3">
      <H2 fontSize="$title" color="$ink">
        {name}
      </H2>
      {children}
    </YStack>
  );
}

function Everything() {
  return (
    <YStack gap="$8">
      <Section name="Button">
        <YStack gap="$2" alignItems="flex-start">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button compact>Compact</Button>
          <Button disabled>Disabled</Button>
        </YStack>
      </Section>
      <Section name="Confidence">
        <YStack gap="$2">
          <Confidence level="high" />
          <Confidence level="medium" />
          <Confidence level="low" />
        </YStack>
      </Section>
      <Section name="Card">
        <Card title="Card title" meta="Meta line">
          <Paragraph color="$ink">Body text inside a card.</Paragraph>
        </Card>
        <Card title="Interactive" interactive>
          <Paragraph color="$ink">Hover me.</Paragraph>
        </Card>
      </Section>
      <Section name="Notice">
        <Notice tone="warning" title="Heads up">
          Something to double check.
        </Notice>
        <Notice tone="dispute" title="Disputed">
          Sources disagree on this date.
        </Notice>
        <Notice tone="error" title="Failed">
          The request did not complete.
        </Notice>
      </Section>
      <Section name="EmptyState">
        <EmptyState title="No records" action={<Button variant="secondary">Clear filters</Button>}>
          Nothing matches those filters.
        </EmptyState>
      </Section>
      <Section name="Citation">
        <Citation source="Chronicling America" href="https://example.org/a" label="1">
          Quoted passage from the source.
        </Citation>
        <Citation
          source="Old newspaper"
          href="https://example.org/b"
          linkStatus="dead"
          deadAsOfDate="2026-09-01"
          archivedHref="https://example.org/archive"
        />
      </Section>
      <Section name="Toolbar">
        <Toolbar label="Filter records" action="/records">
          <ToolbarField label="Search">
            <input name="q" />
          </ToolbarField>
          <ToolbarField label="Sort" labelHidden>
            <select name="sort">
              <option>Date</option>
            </select>
          </ToolbarField>
        </Toolbar>
      </Section>
      <Section name="ResultList">
        <ResultList items={ITEMS} />
      </Section>
      <Section name="Timeline">
        <Timeline items={EVENTS} />
      </Section>
      <Section name="Pagination">
        <Pagination
          page={1}
          pageCount={12}
          pageSize={20}
          total={230}
          hrefForPage={(p) => `/kit?page=${p}`}
        />
        <Pagination
          page={6}
          pageCount={12}
          pageSize={20}
          total={230}
          hrefForPage={(p) => `/kit?page=${p}`}
        />
      </Section>
    </YStack>
  );
}

export default function KitPreview() {
  if (!ENABLED) {
    return <Paragraph color="$inkMuted">Not found.</Paragraph>;
  }
  return (
    <YStack gap="$6" padding="$4">
      {(['light', 'dark'] as const).map((name) => (
        <Theme key={name} name={name}>
          <YStack
            backgroundColor="$canvas"
            padding="$5"
            gap="$4"
            borderWidth={1}
            borderColor="$border"
          >
            <H2 fontSize="$display3" color="$ink">
              {name} theme
            </H2>
            <Everything />
          </YStack>
        </Theme>
      ))}
    </YStack>
  );
}
