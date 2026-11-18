/**
 * Renders a `/v1/stories/{slug}` body on the phone: the wire blocks and their prose runs.
 *
 * Runs are nested native text spans, so a paragraph stays one accessible text node. A citation is
 * a small accent number that reads as "source N"; the numbered sources follow the body, in the
 * same order the numbers count. A record link opens the record natively; an outside link opens
 * the browser and says so. A block only the site can draw names itself and offers the web page,
 * so nothing in the story disappears without a trace.
 */
import { Linking, Text as NativeText, View, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import type {
  StoryBlockV1,
  StoryReferenceV1,
  StoryRunV1,
} from '@repo/public-contracts/v1/story';
import {
  Divider,
  EXTERNAL_LINK_HINT,
  Image,
  LedgerRow,
  Link,
  Notice,
  Text,
  space,
  useThemeColors,
} from '@/ui';
import { sanitizeExternalHref } from '@/features/content/link-safety';

const WEB_ORIGIN = 'https://blackstory.app';

const WEB_ONLY_LABEL: Readonly<Record<string, string>> = {
  figure: 'A chart is on the web page',
  stat: 'A figure is on the web page',
  document: 'A document excerpt is on the web page',
  timeline: 'A timeline is on the web page',
  video: 'A video is on the web page',
};

function openExternal(href: string) {
  const safe = sanitizeExternalHref(href);
  if (safe) void Linking.openURL(safe);
}

/** Prose runs as nested spans inside one text node. */
export function Runs({ runs }: { readonly runs: readonly StoryRunV1[] }) {
  const theme = useThemeColors();
  return (
    <>
      {runs.map((run, index) => {
        if (run.t === 'break') return <NativeText key={index}>{'\n'}</NativeText>;
        if (run.t === 'cite') {
          const previousIsCite = runs[index - 1]?.t === 'cite';
          return (
            <NativeText
              key={index}
              accessibilityLabel={`source ${run.n}`}
              style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}
            >
              {previousIsCite ? `,${run.n}` : ` ${run.n}`}
            </NativeText>
          );
        }
        const style: TextStyle = {
          ...(run.strong ? { fontWeight: '700' } : {}),
          ...(run.em ? { fontStyle: 'italic' } : {}),
        };
        if (run.entityId) {
          const id = run.entityId;
          return (
            <NativeText
              key={index}
              accessibilityRole="link"
              accessibilityHint="Opens the record"
              onPress={() => router.push(`/entity/${encodeURIComponent(id)}`)}
              style={[style, { color: theme.accent, textDecorationLine: 'underline' }]}
            >
              {run.text}
            </NativeText>
          );
        }
        if (run.href) {
          const href = run.href;
          return (
            <NativeText
              key={index}
              accessibilityRole="link"
              accessibilityHint={EXTERNAL_LINK_HINT}
              onPress={() => openExternal(href)}
              style={[style, { color: theme.accent, textDecorationLine: 'underline' }]}
            >
              {run.text}
            </NativeText>
          );
        }
        return (
          <NativeText key={index} style={style}>
            {run.text}
          </NativeText>
        );
      })}
    </>
  );
}

function Block({ block, webUrl }: { readonly block: StoryBlockV1; readonly webUrl: string }) {
  const theme = useThemeColors();
  switch (block.type) {
    case 'heading':
      return (
        <Text
          variant={block.level === 2 ? 'title' : 'rowTitle'}
          isHeading
          style={{ marginTop: space['5'] }}
        >
          {block.text}
        </Text>
      );
    case 'paragraph':
      return (
        <Text variant="editorial">
          <Runs runs={block.runs} />
        </Text>
      );
    case 'list':
      return (
        <View style={{ gap: space['3'] }}>
          {block.items.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: space['2'] }}>
              <Text variant="editorial" colorRole="accent" accessibilityElementsHidden>
                {block.style === 'number' ? `${index + 1}.` : '•'}
              </Text>
              <Text variant="editorial" style={{ flex: 1 }}>
                <Runs runs={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <View
          style={{ borderLeftWidth: 3, borderLeftColor: theme.accent, paddingLeft: space['3'] }}
        >
          <Text variant="editorial" style={{ fontStyle: 'italic' }}>
            <Runs runs={block.runs} />
          </Text>
          {block.attribution ? (
            <Text variant="caption" colorRole="inkMuted" style={{ marginTop: space['1'] }}>
              {block.attribution}
            </Text>
          ) : null}
        </View>
      );
    case 'dispute':
      return (
        <View
          style={{
            gap: space['2'],
            padding: space['3'],
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
          }}
        >
          <Text variant="sectionLabel">{`Where the sources disagree: ${block.label}`}</Text>
          {block.sides.map((side, index) => (
            <View key={index} style={{ gap: space['1'] }}>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {side.sourceLabel}
              </Text>
              <Text variant="bodySmall">{side.claim}</Text>
            </View>
          ))}
        </View>
      );
    case 'image':
      return (
        <View style={{ gap: space['1'] }}>
          <Image
            source={block.image.url}
            alt={block.image.alt}
            {...(block.image.width && block.image.height
              ? { aspectRatio: block.image.width / block.image.height }
              : { aspectRatio: 4 / 3 })}
            fallback={{ entityName: block.image.alt, reason: 'absent' }}
          />
          {block.caption ? <Text variant="caption">{block.caption}</Text> : null}
          <Text variant="caption" colorRole="inkMuted">
            {block.image.credit}
          </Text>
        </View>
      );
    case 'table':
      return (
        <View style={{ gap: space['2'] }}>
          <Text variant="caption" colorRole="inkMuted">
            {block.caption}
          </Text>
          {block.rows.map((row, rowIndex) => (
            <Text
              key={rowIndex}
              variant="bodySmall"
              style={block.header && rowIndex === 0 ? { fontWeight: '700' } : undefined}
            >
              {row.map((cell, cellIndex) => (
                <NativeText key={cellIndex}>
                  {cellIndex > 0 ? '  ·  ' : ''}
                  <Runs runs={cell} />
                </NativeText>
              ))}
            </Text>
          ))}
        </View>
      );
    case 'record':
      return (
        <LedgerRow
          title={block.label}
          summary="Open the record"
          showChevron
          onPress={() => router.push(`/entity/${encodeURIComponent(block.entityId)}`)}
          accessibilityHint="Opens the record"
        />
      );
    case 'webOnly':
      return (
        <View style={{ gap: space['2'] }}>
          <Notice
            tone="info"
            title={WEB_ONLY_LABEL[block.kind] ?? 'More is on the web page'}
            {...(block.caption ? { description: block.caption } : {})}
          />
          <Link href={webUrl} textRole="bodySmall">
            Open the story on the web
          </Link>
        </View>
      );
    case 'divider':
      return <Divider />;
  }
}

export function StoryBlocks({
  blocks,
  webUrl,
}: {
  readonly blocks: readonly StoryBlockV1[];
  readonly webUrl: string;
}) {
  return (
    <View style={{ gap: space['4'] }}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} webUrl={webUrl} />
      ))}
    </View>
  );
}

export function StoryReferences({ references }: { readonly references: readonly StoryReferenceV1[] }) {
  if (references.length === 0) return null;
  return (
    <View style={{ gap: space['2'], marginTop: space['6'] }}>
      <Text variant="sectionLabel" isHeading accessibilityRole="header">
        Sources
      </Text>
      {references.map((reference, index) => {
        const safe = sanitizeExternalHref(reference.url);
        const label = `${index + 1}. ${reference.label}${reference.locator ? `, ${reference.locator}` : ''}`;
        return safe ? (
          <Link key={reference.id} href={safe} textRole="bodySmall">
            {label}
          </Link>
        ) : (
          <Text key={reference.id} variant="bodySmall">
            {label}
          </Text>
        );
      })}
    </View>
  );
}

export function storyWebUrl(webPath: string): string {
  return `${WEB_ORIGIN}${webPath}`;
}
