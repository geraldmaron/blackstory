/**
 * Native Banned books browse — Ledger Line catalog with search and pulse facts.
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
  RecordFactStrip,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
  useThemeColors,
  MIN_TOUCH_TARGET,
} from '@/ui';
import { BOOKS_ABOUT, BOOKS_CATALOG, BOOKS_INTRO } from './books-copy';
import {
  catalogPulse,
  filterCatalogRows,
  listCatalogRows,
  loadBooksCatalog,
} from './catalog';

export function BooksBrowseScreen() {
  const theme = useThemeColors();
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
              placeholder={BOOKS_CATALOG.searchPlaceholder}
              placeholderTextColor={theme.inkMuted}
              accessibilityLabel="Search banned books"
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
});
