/**
 * Native Themes browse — Ledger Line P0/P1 catalog with search and method notice.
 * Stack route: canvas insets sides/bottom only (native header owns top).
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
  EditionBrandHeader,
  ScreenCanvas,
  Text,
  screenScrollInsets,
  space,
  SearchField,
} from '@/ui';
import { THEMES_CATALOG, THEMES_INTRO, THEMES_METHOD } from './themes-copy';
import {
  catalogPulse,
  filterCatalogRows,
  listCatalogRows,
  listP0Rows,
  listP1Rows,
  loadThemesCatalog,
} from './catalog';
import type { ThemesCatalogRow } from './types';

function ThemeRows({
  rows,
  empty,
}: {
  readonly rows: readonly ThemesCatalogRow[];
  readonly empty: boolean;
}) {
  if (empty) {
    return (
      <EmptyState
        compact
        title={THEMES_CATALOG.emptyTitle}
        description={THEMES_CATALOG.emptyBody}
      />
    );
  }
  return (
    <>
      {rows.map((row, index) => (
        <LedgerRow
          key={row.id}
          title={row.title}
          slug={`${row.priorityLabel} · ${row.statusLabel}`}
          summary={row.lede}
          leading={<NavIcon name="collection" size={20} />}
          showChevron={row.available}
          showDivider={index < rows.length - 1}
          onPress={row.available ? () => router.push(`/themes/${row.id}` as never) : undefined}
          accessibilityLabel={`${row.title}. ${row.priorityLabel}. ${row.statusLabel}.`}
        />
      ))}
    </>
  );
}

export function ThemesBrowseScreen() {
  const [draft, setDraft] = useState('');
  const allRows = useMemo(() => listCatalogRows(), []);
  const filtered = useMemo(() => filterCatalogRows(allRows, draft), [allRows, draft]);
  const p0 = useMemo(() => listP0Rows(filtered), [filtered]);
  const p1 = useMemo(() => listP1Rows(filtered), [filtered]);
  const pulse = useMemo(() => catalogPulse(loadThemesCatalog()), []);
  const countLabel = `${filtered.length} of ${allRows.length}`;

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <EditionBrandHeader
          kicker={THEMES_INTRO.kicker}
          title={THEMES_INTRO.title}
          dek={THEMES_INTRO.lede}
          compact
          dense
        />

        <Notice tone="info" title={THEMES_METHOD.title} description={THEMES_METHOD.body} />
        <View style={{ alignItems: 'flex-start' }}>
          <Button
            label={THEMES_METHOD.methodologyCta}
            variant="ghost"
            density="compact"
            onPress={() => router.push('/methodology')}
          />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel>Catalog pulse</LedgerSectionLabel>
          <RecordFactStrip
            facts={[
              { key: 'collection', label: 'Themes', value: String(pulse.themeCount) },
              { key: 'p0', label: 'P0 live', value: String(pulse.p0Count) },
              { key: 'packets', label: 'Packets', value: String(pulse.packetCount) },
              {
                key: 'release',
                label: 'Release',
                value: pulse.releaseLabel.replace(/^Curated on-device /, ''),
              },
            ]}
          />
          <Text variant="caption" colorRole="inkMuted">
            {THEMES_CATALOG.seedNote} Snapshot {pulse.version}.
          </Text>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove meta={countLabel}>
            Find a theme
          </LedgerSectionLabel>
          <SearchField
            value={draft}
            onChangeText={setDraft}
            placeholder={THEMES_CATALOG.searchPlaceholder}
            accessibilityLabel="Search themes"
            maxLength={120}
          />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove meta={`${p0.length}`}>
            {THEMES_CATALOG.p0Title}
          </LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {THEMES_CATALOG.p0Lede}
          </Text>
          <ThemeRows rows={p0} empty={p0.length === 0} />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove meta={`${p1.length}`}>
            {THEMES_CATALOG.p1Title}
          </LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {THEMES_CATALOG.p1Lede}
          </Text>
          <ThemeRows rows={p1} empty={p1.length === 0} />
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
