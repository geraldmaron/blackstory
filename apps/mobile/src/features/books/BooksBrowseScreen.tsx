/**
 * Native Banned books browse — Ledger Line catalog with search and pulse facts.
 * Stack route: canvas insets sides/bottom only (native header owns top).
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  EmptyState,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  RecordFactStrip,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
  SearchField,
} from '@/ui';
import { BOOKS_ABOUT, BOOKS_CATALOG, BOOKS_INTRO } from './books-copy';
import { catalogPulse, filterCatalogRows, listCatalogRows, loadBooksCatalog } from './catalog';

export function BooksBrowseScreen() {
  const [draft, setDraft] = useState('');
  const allRows = useMemo(() => listCatalogRows(), []);
  const rows = useMemo(() => filterCatalogRows(allRows, draft), [allRows, draft]);
  const pulse = useMemo(() => catalogPulse(loadBooksCatalog()), []);
  const countLabel = `${rows.length} of ${allRows.length}`;

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          kicker={BOOKS_INTRO.kicker}
          title={BOOKS_INTRO.title}
          dek={BOOKS_INTRO.lede}
          compact
          dense
        />

        <View style={styles.section}>
          <LedgerSectionLabel>Catalog pulse</LedgerSectionLabel>
          <RecordFactStrip
            facts={[
              { key: 'titles', label: 'Titles', value: String(pulse.titleCount) },
              { key: 'authors', label: 'Authors', value: String(pulse.authorCount) },
              { key: 'states', label: 'States cited', value: String(pulse.stateCount) },
              {
                key: 'source',
                label: 'Source',
                value:
                  pulse.source === 'live-snapshot'
                    ? BOOKS_CATALOG.sourceLive
                    : BOOKS_CATALOG.sourceCurated,
              },
            ]}
          />
          <Text variant="caption" colorRole="inkMuted">
            {BOOKS_CATALOG.seedNote} Release {pulse.version}
            {pulse.generatedAt ? ` · exported ${pulse.generatedAt.slice(0, 10)}` : ''}.
          </Text>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove meta={countLabel}>
            {BOOKS_CATALOG.title}
          </LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {BOOKS_CATALOG.lede}
          </Text>
          <SearchField
            value={draft}
            onChangeText={setDraft}
            placeholder={BOOKS_CATALOG.searchPlaceholder}
            accessibilityLabel="Search banned books"
            maxLength={120}
          />

          {rows.length === 0 ? (
            <EmptyState
              compact
              title={BOOKS_CATALOG.emptyTitle}
              description={BOOKS_CATALOG.emptyBody}
            />
          ) : (
            rows.map((row, index) => (
              <LedgerRow
                key={row.id}
                title={row.title}
                slug={`${row.authorNames} · ${row.publishedDate}`}
                summary={`${row.statesLabel} · ${row.citationCount} citations`}
                leading={<NavIcon name="books" size={20} />}
                showChevron
                showDivider={index < rows.length - 1}
                onPress={() => router.push(`/books/${row.slug}` as never)}
                accessibilityLabel={`${row.title}. ${row.authorNames}. ${row.statesLabel}.`}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{BOOKS_ABOUT.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {BOOKS_ABOUT.lede}
          </Text>
        </View>
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
