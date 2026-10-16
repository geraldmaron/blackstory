// debug
import Head from 'expo-router/head';
import { XStack, YStack } from '@tamagui/stacks';
import { H1, H2, Paragraph, SizableText as Text } from '@tamagui/text';
import {
  METHODOLOGY_INTRO_LEDE,
  METHODOLOGY_PUBLISH_RULES,
  METHODOLOGY_MISSION_BEATS,
} from '../copy';

const URL = 'https://blackstory.example/methodology';
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Methodology',
  url: URL,
});

export default function Methodology() {
  return (
    <>
      <Head>
        <title>Methodology · BlackStory</title>
        <meta name="description" content="How BlackStory decides what qualifies as a record." />
        <link rel="canonical" href={URL} />
        <meta property="og:title" content="Methodology · BlackStory" />
        <script type="application/ld+json">{jsonLd}</script>
      </Head>
      <YStack
        backgroundColor="$blackInk"
        minHeight="100vh"
        padding="$6"
        gap="$5"
        alignItems="center"
      >
        <YStack maxWidth={672} width="100%" gap="$4">
          <H1 color="$archivePaper" fontSize={44}>
            How a record gets in.
          </H1>
          <Paragraph color="$pageSand" fontSize={17}>
            {METHODOLOGY_INTRO_LEDE}
          </Paragraph>
          {METHODOLOGY_PUBLISH_RULES.map((r) => (
            <YStack
              key={r.title}
              borderWidth={1}
              borderColor="$stone"
              padding="$4"
              gap="$2"
              borderRadius={8}
            >
              <H2 color="$copperDark" fontSize={20}>
                {r.title}
              </H2>
              <Paragraph color="$archivePaper">{r.body}</Paragraph>
            </YStack>
          ))}
          <XStack gap="$3" flexWrap="wrap">
            {METHODOLOGY_MISSION_BEATS.map((b) => (
              <Text key={b.kicker} color="$archivePaper" fontSize={14}>
                {b.kicker}
              </Text>
            ))}
          </XStack>
        </YStack>
      </YStack>
    </>
  );
}
