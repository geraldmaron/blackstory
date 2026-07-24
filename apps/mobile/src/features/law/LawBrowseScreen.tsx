/**
 * Native Law browse — Ledger Line catalog with search, kind chips, and disclaimer.
 * Stack route: canvas insets sides/bottom only (native header owns top).
 */
import { useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  useThemeColors,
  MIN_TOUCH_TARGET,
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
  const theme = useThemeColors();
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
              { key: 'snapshot', label: 'Snapshot', value: pulse.version.replace('legal-seed-', '') },
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
          <View
            style={[
              styles.searchField,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.inkMuted}
              accessibilityElementsHidden
            />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder={LAW_CATALOG.searchPlaceholder}
              placeholderTextColor={theme.inkMuted}
              accessibilityLabel="Search law catalog"
              accessibilityRole="search"
              maxLength={120}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              clearButtonMode="while-editing"
              style={[styles.input, { color: theme.ink }]}
            />
            {draft.length > 0 && Platform.OS !== 'ios' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setDraft('')}
                hitSlop={8}
                style={styles.clear}
              >
                <Ionicons name="close-circle" size={18} color={theme.inkMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {kindFilters.map((filter) => {
              const selected = filter.value === kind;
              return (
                <Pressable
                  key={filter.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Filter by ${filter.label}`}
                  onPress={() => setKind(filter.value)}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? theme.accentGraphic : theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    colorRole={selected ? 'accent' : 'inkMuted'}
                    numberOfLines={1}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
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
                leading={<NavIcon name="lawRef" size={20} />}
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
  searchField: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: space['3'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  input: {
    flex: 1,
    fontSize: 13,
    paddingVertical: space['2'],
  },
  clear: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    gap: space['2'],
    paddingVertical: space['1'],
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space['3'],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
