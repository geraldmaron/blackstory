import { Link, useLoaderData } from 'expo-router';
import { createServerLoader, type GenerateMetadataFunction } from 'expo-router/server';
import { StatusError } from 'expo-server';
import { XStack, YStack } from '@tamagui/stacks';
import { H1, H2, Paragraph, SizableText } from '@tamagui/text';
import { CatalogUnavailableError } from '../server/data/catalog';
import { loadRecordsPage, type RecordsPageData } from '../server/data/records';
import { catalog, entities } from '../server/data/wiring';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3060';
const absolute = (path: string): string => new URL(path, SITE_URL).toString();

async function read(request: Request | undefined): Promise<RecordsPageData> {
  try {
    return await loadRecordsPage(
      new URL(request?.url ?? '/records', SITE_URL).searchParams,
      catalog,
      entities,
    );
  } catch (error) {
    // The catalog is the page. Say so honestly instead of rendering an empty archive.
    if (error instanceof CatalogUnavailableError)
      throw new StatusError(503, 'The archive index is unavailable.');
    throw error;
  }
}

export const loader = createServerLoader(async (request): Promise<RecordsPageData> =>
  read(request),
);

export const generateMetadata: GenerateMetadataFunction = async (request) => {
  const { model } = await read(request);
  const title =
    model.constraints.length > 0
      ? `Records · ${model.constraints.map((constraint) => constraint.label).join(' · ')}`
      : 'Records';
  return {
    title,
    description:
      'Every record in the active release as a browsable list: kind, place, era and evidence grade, filterable and linkable without opening the map.',
    alternates: { canonical: absolute(model.canonicalPath) },
    // Multi-facet and free-text narrowings are a crawl trap (see recordsQueryIndexable upstream).
    ...(model.indexable ? {} : { robots: { index: false, follow: false } }),
  };
};

export default function Records() {
  const { model } = useLoaderData<typeof loader>();
  return (
    <YStack alignItems="center" paddingHorizontal="$4">
      <YStack maxWidth={800} width="100%" gap="$4" paddingVertical="$6">
        <H1 color="$color" fontSize={44}>
          Everything the archive holds.
        </H1>
        <Paragraph color="$colorMuted" fontSize={17}>
          The map shows where a record sits. This list shows what the archive holds.
        </Paragraph>
        <SizableText color="$colorMuted" fontSize={12}>
          {model.pageCount > 1
            ? `${model.countLabel} · page ${model.page} of ${model.pageCount}`
            : model.countLabel}
        </SizableText>
        <YStack>
          {model.rows.map((row) => (
            <XStack
              key={row.id}
              borderBottomWidth={1}
              borderBottomColor="$borderColor"
              paddingVertical="$3"
              gap="$3"
              justifyContent="space-between"
            >
              <YStack flex={1} gap={2}>
                <Link href={row.href as never}>
                  <SizableText color="$color" fontSize={17} fontWeight="600">
                    {row.name}
                  </SizableText>
                </Link>
                <XStack justifyContent="space-between">
                  <SizableText color="$colorMuted" fontSize={13}>
                    {row.place}
                  </SizableText>
                  <SizableText color="$colorMuted" fontSize={13}>
                    {row.era}
                  </SizableText>
                </XStack>
              </YStack>
              <SizableText color="$accent" fontSize={13} aria-label={row.gradeDescription}>
                {row.grade ?? '·'}
              </SizableText>
            </XStack>
          ))}
        </YStack>
        <XStack justifyContent="space-between" render="nav" aria-label="Records pages">
          {model.previousHref ? (
            <Link href={model.previousHref as never} rel="prev">
              <SizableText color="$color">← Previous 100</SizableText>
            </Link>
          ) : (
            <YStack />
          )}
          {model.nextHref ? (
            <Link href={model.nextHref as never} rel="next">
              <SizableText color="$color">Next 100 →</SizableText>
            </Link>
          ) : (
            <YStack />
          )}
        </XStack>
        <YStack gap="$2" borderTopWidth={1} borderTopColor="$borderColor" paddingTop="$4">
          <H2 color="$color" fontSize={24}>
            See the same records in place
          </H2>
          <Link href={model.atlasHref as never}>
            <SizableText color="$accent">Open this selection on the map</SizableText>
          </Link>
          <Paragraph color="$colorMuted" fontSize={13}>
            {model.atlasReason}
          </Paragraph>
        </YStack>
      </YStack>
    </YStack>
  );
}
