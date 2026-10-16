import Head from 'expo-router/head';
import { Link, useLoaderData } from 'expo-router';
import { XStack, YStack } from '@tamagui/stacks';
import { H1, H2, Paragraph, SizableText } from '@tamagui/text';

type Row = {
  id: string;
  href: string;
  name: string;
  place: string;
  era: string;
  kind: string;
  grade: string | null;
  gradeDescription: string;
  confidenceTier: string;
};
type Option = { id: string; label: string; count: number; href: string; nofollow: boolean };
type Model = {
  rows: Row[];
  totalAll: number;
  page: number;
  pageCount: number;
  countLabel: string;
  previousHref?: string;
  nextHref?: string;
  facets: Record<string, Option[]>;
  atlasHref: string;
  atlasReason: string;
  canonicalPath: string;
};

export async function loader(): Promise<Model> {
  // Spike stand-in for the real loader: the exact `RecordsIndex` model exported from
  // apps/web/src/app/records/load-records-index.ts (page 1, 100 rows). Not committed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  return JSON.parse(fs.readFileSync(`${process.cwd()}/data/records-model.json`, 'utf8'))
    .model as Model;
}

const SITE = 'https://blackstory.example';
const FACETS: Array<[string, string]> = [
  ['kind', 'Kind'],
  ['era', 'Era'],
  ['state', 'State'],
  ['topic', 'Topic'],
  ['status', 'Status'],
  ['evidence', 'Grade'],
];
const TIER = { high: '$copperDark', medium: '$pageSand', low: '$stone' } as Record<string, string>;

function Pill({ label }: { label: string }) {
  return (
    <XStack
      borderWidth={1}
      borderColor="$stone"
      borderRadius={999}
      paddingHorizontal="$3"
      minHeight={44}
      alignItems="center"
    >
      <SizableText color="$archivePaper" fontSize={14}>
        {label}
      </SizableText>
    </XStack>
  );
}

function RecordRow({ row }: { row: Row }) {
  return (
    <XStack
      borderBottomWidth={1}
      borderBottomColor="$stone"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack gap="$3" alignItems="center" flex={1}>
        <YStack width={10} height={10} borderRadius={5} backgroundColor="$pageSand" />
        <YStack flex={1} gap={2}>
          <Link href={row.href as never}>
            <SizableText color="$archivePaper" fontSize={17} fontWeight="600">
              {row.name}
            </SizableText>
          </Link>
          <XStack justifyContent="space-between">
            <SizableText color="$pageSand" fontSize={13}>
              {row.place}
            </SizableText>
            <SizableText color="$pageSand" fontSize={13}>
              {row.era}
            </SizableText>
          </XStack>
        </YStack>
      </XStack>
      <XStack gap="$2" alignItems="center" aria-label={row.gradeDescription}>
        <YStack
          width={28}
          height={3}
          backgroundColor={(TIER[row.confidenceTier] ?? '$stone') as never}
        />
        <SizableText color={(TIER[row.confidenceTier] ?? '$stone') as never} fontSize={13}>
          {row.grade ?? '·'}
        </SizableText>
      </XStack>
    </XStack>
  );
}

export default function Records() {
  const m = useLoaderData<typeof loader>();
  return (
    <>
      <Head>
        <title>Records · BlackStory</title>
        <meta
          name="description"
          content="Every record in the active release as a browsable list: kind, place, era and evidence grade."
        />
        <link rel="canonical" href={`${SITE}${m.canonicalPath}`} />
        <meta property="og:title" content="Records · BlackStory" />
        {m.nextHref ? <link rel="next" href={`${SITE}${m.nextHref}`} /> : null}
      </Head>
      <YStack alignItems="center" paddingHorizontal="$4">
        <YStack maxWidth={800} width="100%" gap="$4" paddingVertical="$6">
          <H1 color="$archivePaper" fontSize={44}>
            Everything the archive holds.
          </H1>
          <Paragraph color="$pageSand" fontSize={17}>
            The map shows where a record sits. This list shows what the archive holds.
          </Paragraph>
          <XStack
            borderWidth={1}
            borderColor="$stone"
            borderRadius={999}
            paddingHorizontal="$4"
            minHeight={48}
            alignItems="center"
          >
            <SizableText color="$pageSand">Search names, places</SizableText>
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            {FACETS.map(([k, label]) =>
              m.facets[k]?.length ? <Pill key={k} label={label} /> : null,
            )}
          </XStack>
          <SizableText
            color="$pageSand"
            fontSize={12}
          >{`${m.countLabel} · page ${m.page} of ${m.pageCount}`}</SizableText>
          <YStack>
            {m.rows.map((r) => (
              <RecordRow key={r.id} row={r} />
            ))}
          </YStack>
          <XStack tag="nav" justifyContent="space-between" aria-label="Records pages">
            {m.previousHref ? (
              <Link href={m.previousHref as never}>
                <SizableText color="$archivePaper">← Previous 100</SizableText>
              </Link>
            ) : (
              <YStack />
            )}
            <SizableText color="$pageSand">{`Page ${m.page} of ${m.pageCount}`}</SizableText>
            {m.nextHref ? (
              <Link href={m.nextHref as never}>
                <SizableText color="$archivePaper">Next 100 →</SizableText>
              </Link>
            ) : (
              <YStack />
            )}
          </XStack>
          <Paragraph
            color="$pageSand"
            fontSize={13}
          >{`${m.totalAll.toLocaleString('en-US')} records · Readable without the map`}</Paragraph>
          <YStack gap="$2" borderTopWidth={1} borderTopColor="$stone" paddingTop="$4">
            <H2 color="$archivePaper" fontSize={24}>
              See the same records in place
            </H2>
            <Link href={m.atlasHref as never}>
              <SizableText color="$copperDark">Open this selection on the map</SizableText>
            </Link>
            <Link href="/methodology">
              <SizableText color="$archivePaper">How a record gets in</SizableText>
            </Link>
            <Paragraph color="$pageSand" fontSize={13}>
              {m.atlasReason}
            </Paragraph>
          </YStack>
        </YStack>
      </YStack>
    </>
  );
}
