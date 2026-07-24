/**
 * Native Banned books detail — context, challenges, citations, lookup, related.
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
import { BOOKS_DETAIL } from './books-copy';
import {
  authorNames,
  getBookBySlug,
  plainDashCopy,
  relatedCatalogRows,
  reportedStateCodes,
  toCatalogRow,
} from './catalog';

export type BooksDetailScreenProps = {
  readonly slug: string;
};

export function BooksDetailScreen({ slug }: BooksDetailScreenProps) {
  const book = useMemo(() => getBookBySlug(slug), [slug]);
  const related = useMemo(() => relatedCatalogRows(slug), [slug]);
  const [linkNotice, setLinkNotice] = useState<string | undefined>(undefined);

  if (!book) {
    return (
      <ScreenCanvas edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            title={BOOKS_DETAIL.missingTitle}
            description={BOOKS_DETAIL.missingBody}
          />
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label="Back to Banned books"
              variant="secondary"
              density="compact"
              onPress={() => router.replace('/books' as never)}
            />
          </View>
        </ScrollView>
      </ScreenCanvas>
    );
  }

  const row = toCatalogRow(book);
  const states = reportedStateCodes(book);
  const activeChallenges = book.challenges.filter(
    (c) => c.status === 'reported' || c.status === 'unknown',
  );

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
          kicker={BOOKS_DETAIL.introKicker}
          title={row.title}
          dek={row.authorNames}
          compact
          dense
        />

        <RecordFactStrip
          facts={[
            { key: 'year', label: 'Published', value: book.publishedDate },
            {
              key: 'states',
              label: 'States cited',
              value: states.length > 0 ? String(states.length) : '0',
            },
            {
              key: 'citations',
              label: 'Citations',
              value: String(book.citations.length),
            },
            {
              key: 'challenges',
              label: 'Reports',
              value: String(activeChallenges.length),
            },
          ]}
        />

        <View style={styles.section}>
          <LedgerSectionLabel>{BOOKS_DETAIL.contextTitle}</LedgerSectionLabel>
          <Text variant="editorial" colorRole="ink">
            {plainDashCopy(book.description)}
          </Text>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{BOOKS_DETAIL.challengesTitle}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {BOOKS_DETAIL.challengesLede}
          </Text>
          {activeChallenges.length === 0 ? (
            <Text variant="caption" colorRole="inkMuted">
              No active challenge rows on this entry.
            </Text>
          ) : (
            activeChallenges.map((challenge, index) => (
              <LedgerRow
                key={`${challenge.state}-${challenge.challengeYear ?? index}-${index}`}
                title={challenge.state}
                slug={[
                  challenge.jurisdictionLabel,
                  challenge.schoolYear,
                  challenge.status,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                summary={challenge.citation.label}
                leading={<NavIcon name="lawRef" size={20} />}
                showDivider={index < activeChallenges.length - 1}
                onPress={() => void openHref(challenge.citation.href, challenge.citation.label)}
                accessibilityLabel={`${challenge.state}. ${challenge.citation.label}. Opens citation.`}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{BOOKS_DETAIL.evidenceTitle}</LedgerSectionLabel>
          {book.citations.map((citation, index) => (
            <LedgerRow
              key={`${citation.href}-${index}`}
              title={plainDashCopy(citation.label)}
              slug={citation.publisher ?? citation.publishedAt}
              leading={<NavIcon name="methodology" size={20} />}
              showChevron
              showDivider={index < book.citations.length - 1}
              onPress={() => void openHref(citation.href, citation.label)}
              accessibilityLabel={`${citation.label}. Opens citation.`}
            />
          ))}
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{BOOKS_DETAIL.lookupTitle}</LedgerSectionLabel>
          {book.identifiers.length > 0 ? (
            <Text variant="caption" colorRole="inkMuted">
              {book.identifiers.map((id) => `${id.system}: ${id.value}`).join(' · ')}
            </Text>
          ) : null}
          {book.purchaseLinks
            .filter((link) => link.validationStatus !== 'invalid')
            .map((link, index, list) => (
              <LedgerRow
                key={`${link.retailer}-${index}`}
                title={plainDashCopy(link.label)}
                slug={link.retailer}
                leading={<NavIcon name="books" size={20} />}
                showChevron
                showDivider={index < list.length - 1}
                onPress={() => void openHref(link.href, link.label)}
                accessibilityLabel={`${link.label}. Opens purchase or catalog link.`}
              />
            ))}
          <Text variant="caption" colorRole="inkMuted">
            {BOOKS_DETAIL.lookupFootnote}
          </Text>
        </View>

        {book.canonicalEntityId ? (
          <View style={styles.section}>
            <LedgerSectionLabel ruleAbove>Linked record</LedgerSectionLabel>
            <Button
              label={BOOKS_DETAIL.entityCta}
              variant="accent"
              onPress={() => router.push(`/entity/${book.canonicalEntityId}` as never)}
              accessibilityHint="Opens the linked BlackStory place or publication record"
            />
          </View>
        ) : null}

        {related.length > 0 ? (
          <View style={styles.section}>
            <LedgerSectionLabel ruleAbove>{BOOKS_DETAIL.relatedTitle}</LedgerSectionLabel>
            {related.map((item, index) => (
              <LedgerRow
                key={item.id}
                title={item.title}
                slug={item.authorNames}
                leading={<NavIcon name="books" size={20} />}
                showChevron
                showDivider={index < related.length - 1}
                onPress={() => router.push(`/books/${item.slug}` as never)}
              />
            ))}
          </View>
        ) : null}

        {linkNotice ? (
          <Notice tone="info" title="Link unavailable" description={linkNotice} />
        ) : null}

        <Text variant="caption" colorRole="inkSubtle">
          Authors: {authorNames(book)}. Provenance: {book.provenance.source}.
        </Text>
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
});
