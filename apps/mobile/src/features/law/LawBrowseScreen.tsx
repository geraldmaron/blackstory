/**
 * Native Law browse — Ledger Line catalog with search, kind chips, and disclaimer.
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
  Notice,
  RecordFactStrip,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
  Chip,
  SearchField,
} from '@/ui';
import { LAW_ABOUT, LAW_CATALOG, LAW_DISCLAIMER, LAW_INTRO } from './law-copy';
import {
  catalogPulse,
  filterCatalogRows,
  listCatalogRows,
  listKindFilters,
  loadLawCatalog,
} from './catalog';

export function LawBrowseScreen() {
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState('all');
  const allRows = useMemo(() => listCatalogRows(), []);
  const kindFilters = useMemo(() => listKindFilters(allRows), [allRows]);
  const rows = useMemo(() => filterCatalogRows(allRows, draft, kind), [allRows, draft, kind]);
  const pulse = useMemo(() => catalogPulse(loadLawCatalog()), []);
  const countLabel = `${rows.length} of ${allRows.length}`;

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          kicker={LAW_INTRO.kicker}
          title={LAW_INTRO.title}
          dek={LAW_INTRO.lede}
          compact
          dense
        />

        <Notice tone="warning" title={LAW_DISCLAIMER.title} description={LAW_DISCLAIMER.body} />

        <View style={styles.section}>
          <LedgerSectionLabel>Catalog pulse</LedgerSectionLabel>
          <RecordFactStrip
            facts={[
              { key: 'entries', label: 'Entries', value: String(pulse.entryCount) },
              { key: 'explainers', label: 'Explainers', value: String(pulse.explainerCount) },
              { key: 'kinds', label: 'Kinds', value: String(pulse.kindCount) },
              {
                key: 'snapshot',
                label: 'Snapshot',
                value: pulse.version.replace('legal-seed-', ''),
              },
            ]}
          />
          <Text variant="caption" colorRole="inkMuted">
            {LAW_CATALOG.seedNote}
          </Text>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove meta={countLabel}>
            {LAW_CATALOG.title}
          </LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {LAW_CATALOG.lede}
          </Text>
          <SearchField
            value={draft}
            onChangeText={setDraft}
            placeholder={LAW_CATALOG.searchPlaceholder}
            accessibilityLabel="Search law catalog"
            maxLength={120}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {kindFilters.map((filter) => (
              <Chip
                key={filter.value}
                label={filter.label}
                accessibilityLabel={`Filter by ${filter.label}`}
                selected={filter.value === kind}
                onPress={() => setKind(filter.value)}
                numberOfLines={1}
              />
            ))}
          </ScrollView>

          {rows.length === 0 ? (
            <EmptyState
              compact
              title={LAW_CATALOG.emptyTitle}
              description={LAW_CATALOG.emptyBody}
            />
          ) : (
            rows.map((row, index) => (
              <LedgerRow
                key={row.id}
                title={row.title}
                slug={`${row.kindLabel} · ${row.statusLabel}`}
                summary={`${row.citation}${row.topicsLabel ? ` · ${row.topicsLabel}` : ''}`}
                leading={<NavIcon name="law" size={20} />}
                showChevron
                showDivider={index < rows.length - 1}
                onPress={() => router.push(`/law/${row.slug}` as never)}
                accessibilityLabel={`${row.title}. ${row.kindLabel}. ${row.statusLabel}.`}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{LAW_ABOUT.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {LAW_ABOUT.lede}
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
  chips: {
    gap: space['2'],
    paddingVertical: space['1'],
  },
});
