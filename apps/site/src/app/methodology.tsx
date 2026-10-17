import type { GenerateMetadataFunction } from 'expo-router/server';
import { XStack, YStack } from '@tamagui/stacks';
import { H1, H2, Paragraph, SizableText } from '@tamagui/text';
import { jsonLdString } from '../lib/json-ld';
// Single source until apps/web is removed; metro.config.js watches this folder.
import {
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_MISSION_BEATS,
  METHODOLOGY_PUBLISH_RULES,
} from '../../../web/src/app/methodology/methodology-copy';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3060';
const URL_PATH = `${SITE_URL}/methodology`;
const jsonLd = jsonLdString({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Methodology',
  url: URL_PATH,
});

const TITLE = 'Methodology · BlackStory';
const DESCRIPTION =
  'How BlackStory decides what qualifies as a record, checks it against independent sources, grades how sure the evidence is, and corrects itself in the open.';

/** Resolved on the server before the HTML stream begins, so title, canonical and og tags are in the first bytes. */
export const generateMetadata: GenerateMetadataFunction = () => ({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL_PATH },
});

export default function Methodology() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <YStack alignItems="center" padding="$6">
        <YStack maxWidth={672} width="100%" gap="$4">
          <H1 color="$color" fontSize={44}>
            How a record gets in.
          </H1>
          <Paragraph color="$inkMuted" fontSize={17}>
            {METHODOLOGY_INTRO_LEDE}
          </Paragraph>
          {METHODOLOGY_PUBLISH_RULES.map((rule) => (
            <YStack
              key={rule.title}
              borderWidth={1}
              borderColor="$borderColor"
              padding="$4"
              gap="$2"
              borderRadius={8}
            >
              <H2 color="$accent" fontSize={20}>
                {rule.title}
              </H2>
              <Paragraph color="$color">{rule.body}</Paragraph>
            </YStack>
          ))}
          <XStack gap="$3" flexWrap="wrap">
            {METHODOLOGY_MISSION_BEATS.map((beat) => (
              <SizableText key={beat.kicker} color="$color" fontSize={14}>
                {beat.kicker}
              </SizableText>
            ))}
          </XStack>
        </YStack>
      </YStack>
    </>
  );
}
