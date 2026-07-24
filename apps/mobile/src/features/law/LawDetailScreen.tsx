/**
 * Native Law detail — anatomy, disclaimer, explainer sections, provenance.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  EmptyState,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  Notice,
  RecordFactStrip,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
} from '@/ui';
import { openExternalLink } from '@/features/entity/linking';
import { LAW_DETAIL, LAW_DISCLAIMER } from './law-copy';
import {
  getLawBySlug,
  jurisdictionLabel,
  kindLabel,
  plainDashCopy,
  statusLabel,
  topicLabel,
  toCatalogRow,
} from './catalog';

export type LawDetailScreenProps = {
  readonly slug: string;
};

export function LawDetailScreen({ slug }: LawDetailScreenProps) {
  const entry = useMemo(() => getLawBySlug(slug), [slug]);
  const [linkNotice, setLinkNotice] = useState<string | undefined>(undefined);

  if (!entry) {
    return (
      <ScreenCanvas edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState title={LAW_DETAIL.missingTitle} description={LAW_DETAIL.missingBody} />
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label="Back to Law"
              variant="secondary"
              density="compact"
              onPress={() => router.replace('/law' as never)}
            />
          </View>
        </ScrollView>
      </ScreenCanvas>
    );
  }

  const row = toCatalogRow(entry);
  const explainer = entry.explainer;

  async function openHref(href: string, label: string) {
    setLinkNotice(undefined);
    const result = await openExternalLink(href, { isOnline: true });
    if (result !== 'opened') {
      setLinkNotice(`Could not open ${label}. Check your connection and try again.`);
    }
  }

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker={LAW_DETAIL.introKicker}
          title={row.title}
          dek={row.citation}
          compact
          dense
        />

        <Notice tone="warning" title={LAW_DISCLAIMER.title} description={LAW_DISCLAIMER.body} />

        <View style={styles.section}>
          <LedgerSectionLabel>{LAW_DETAIL.anatomyTitle}</LedgerSectionLabel>
          <RecordFactStrip
            facts={[
              { key: 'kind', label: 'Kind', value: kindLabel(entry.kind) },
              { key: 'status', label: 'Status', value: statusLabel(entry.lawStatus) },
              {
                key: 'jurisdiction',
                label: 'Jurisdiction',
                value: jurisdictionLabel(entry.jurisdictionId),
              },
              {
                key: 'topics',
                label: 'Topics',
                value:
                  entry.topics.length > 0
                    ? entry.topics.map(topicLabel).join(', ')
                    : 'None listed',
              },
            ]}
          />
        </View>

        {explainer ? (
          <>
            <View style={styles.section}>
              <LedgerSectionLabel ruleAbove>{LAW_DETAIL.saysTitle}</LedgerSectionLabel>
              <Text variant="editorial" colorRole="ink">
                {plainDashCopy(explainer.whatItSays)}
              </Text>
            </View>

            <View style={styles.section}>
              <LedgerSectionLabel ruleAbove>{LAW_DETAIL.meansTitle}</LedgerSectionLabel>
              {explainer.whatItMeans.map((line) => (
                <Text key={line.slice(0, 48)} variant="body" colorRole="ink">
                  {plainDashCopy(line)}
                </Text>
              ))}
            </View>

            <View style={styles.section}>
              <LedgerSectionLabel ruleAbove>{LAW_DETAIL.mattersTitle}</LedgerSectionLabel>
              {explainer.whyItMatters.map((line) => (
                <Text key={line.slice(0, 48)} variant="body" colorRole="ink">
                  {plainDashCopy(line)}
                </Text>
              ))}
            </View>

            <View style={styles.section}>
              <LedgerSectionLabel ruleAbove>{LAW_DETAIL.rightsTitle}</LedgerSectionLabel>
              {explainer.rightsToday.map((link, index) => (
                <LedgerRow
                  key={`${link.agencyUrl}-${index}`}
                  title={plainDashCopy(link.label)}
                  leading={<NavIcon name="corrections" size={20} />}
                  showChevron
                  showDivider={index < explainer.rightsToday.length - 1}
                  onPress={() => void openHref(link.agencyUrl, link.label)}
                  accessibilityLabel={`${link.label}. Opens agency link.`}
                />
              ))}
            </View>

            <View style={styles.section}>
              <LedgerSectionLabel ruleAbove>{LAW_DETAIL.sourcesTitle}</LedgerSectionLabel>
              {explainer.primarySources.map((source, index) => (
                <LedgerRow
                  key={`${source.url}-${index}`}
                  title={plainDashCopy(source.label)}
                  slug={source.licenseTag}
                  leading={<NavIcon name="methodology" size={20} />}
                  showChevron
                  showDivider={index < explainer.primarySources.length - 1}
                  onPress={() => void openHref(source.url, source.label)}
                  accessibilityLabel={`${source.label}. Opens primary source.`}
                />
              ))}
            </View>

            {explainer.termOfArtLinks && explainer.termOfArtLinks.length > 0 ? (
              <View style={styles.section}>
                <LedgerSectionLabel ruleAbove>{LAW_DETAIL.termsTitle}</LedgerSectionLabel>
                {explainer.termOfArtLinks.map((term, index) => (
                  <LedgerRow
                    key={`${term.term}-${index}`}
                    title={plainDashCopy(term.term)}
                    leading={<NavIcon name="lawRef" size={20} />}
                    showChevron
                    showDivider={index < (explainer.termOfArtLinks?.length ?? 0) - 1}
                    onPress={() => void openHref(term.wexUrl, term.term)}
                    accessibilityLabel={`${term.term}. Opens definition.`}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.section}>
            <LedgerSectionLabel ruleAbove>Plain-language explainer</LedgerSectionLabel>
            <Text variant="caption" colorRole="inkMuted">
              An explainer is not published for this entry yet. Official sources remain available
              below.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{LAW_DETAIL.provenanceTitle}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            Citation: {plainDashCopy(entry.citation)}. Retrieved{' '}
            {entry.retrievedAt.slice(0, 10)}. License: {entry.licenseTag}.
          </Text>
          <View style={styles.actions}>
            <Button
              label={LAW_DETAIL.officialCta}
              variant="accent"
              density="compact"
              onPress={() => void openHref(entry.officialUrl, 'official source')}
            />
            <Button
              label={LAW_DETAIL.archiveCta}
              variant="secondary"
              density="compact"
              onPress={() => void openHref(entry.archivedCaptureUrl, 'archived capture')}
            />
          </View>
        </View>

        {entry.canonicalEntityId ? (
          <View style={styles.section}>
            <LedgerSectionLabel ruleAbove>{LAW_DETAIL.keepGoingTitle}</LedgerSectionLabel>
            <Button
              label={LAW_DETAIL.entityCta}
              variant="ghost"
              onPress={() => router.push(`/entity/${entry.canonicalEntityId}` as never)}
              accessibilityHint="Opens the linked BlackStory law record when published"
            />
          </View>
        ) : null}

        {linkNotice ? (
          <Notice tone="info" title="Link unavailable" description={linkNotice} />
        ) : null}
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: space['3'],
  },
  section: {
    gap: space['2'],
  },
  actions: {
    gap: space['2'],
    alignItems: 'flex-start',
  },
});
