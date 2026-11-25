/**
 * Native Memorial — names-forward alphabetical list with optional entity/map links.
 * Dignity first; incomplete by design. No sensational framing.
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
  useThemeColors,
  SearchField,
} from '@/ui';
import { openExternalMaps } from '@/features/entity/maps-handoff';
import { MEMORIAL_ACTIONS, MEMORIAL_BODY, MEMORIAL_INTRO, MEMORIAL_LIST } from './memorial-copy';
import {
  filterMemorialNames,
  listMemorialNames,
  loadMemorialCatalog,
  memorialPulse,
} from './catalog';
import type { MemorialNameEntry } from './types';

export function MemorialScreen() {
  const theme = useThemeColors();
  const [draft, setDraft] = useState('');
  const [mapsNotice, setMapsNotice] = useState<string | undefined>(undefined);
  const allNames = useMemo(() => listMemorialNames(), []);
  const names = useMemo(() => filterMemorialNames(allNames, draft), [allNames, draft]);
  const pulse = useMemo(() => memorialPulse(loadMemorialCatalog()), []);
  const countLabel = `${names.length} of ${allNames.length}`;

  async function openMaps(row: MemorialNameEntry) {
    if (typeof row.lat !== 'number' || typeof row.lng !== 'number') return;
    setMapsNotice(undefined);
    const result = await openExternalMaps({
      lat: row.lat,
      lng: row.lng,
      ...(row.locationLabel || row.name ? { label: row.locationLabel ?? row.name } : {}),
    });
    if (result !== 'opened') {
      setMapsNotice('Could not open Maps. Check that a maps app is available and try again.');
    }
  }

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          kicker={MEMORIAL_INTRO.kicker}
          title={MEMORIAL_INTRO.title}
          dek={MEMORIAL_INTRO.lede}
          compact
          dense
        />

        <View style={styles.section}>
          {MEMORIAL_BODY.map((paragraph) => (
            <Text key={paragraph.slice(0, 32)} variant="body" colorRole="inkMuted">
              {paragraph}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel>Memorial pulse</LedgerSectionLabel>
          <RecordFactStrip
            facts={[
              { key: 'names', label: 'Names', value: String(pulse.nameCount) },
              { key: 'linked', label: 'Linked records', value: String(pulse.linkedCount) },
              { key: 'mapped', label: 'Map anchors', value: String(pulse.mappedCount) },
              {
                key: 'scope',
                label: 'Scope',
                value: 'Incomplete',
              },
            ]}
          />
          <Text variant="caption" colorRole="inkMuted">
            {MEMORIAL_LIST.seedNote}
          </Text>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove meta={countLabel}>
            {MEMORIAL_LIST.title}
          </LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {MEMORIAL_LIST.lede}
          </Text>
          <SearchField
            value={draft}
            onChangeText={setDraft}
            placeholder={MEMORIAL_LIST.searchPlaceholder}
            accessibilityLabel="Search memorial names"
            maxLength={120}
            autoCapitalize="words"
          />

          {names.length === 0 ? (
            <EmptyState
              compact
              title={MEMORIAL_LIST.emptyTitle}
              description={MEMORIAL_LIST.emptyBody}
            />
          ) : (
            names.map((row, index) => {
              const hasEntity = Boolean(row.entityId);
              const hasMaps =
                typeof row.lat === 'number' &&
                typeof row.lng === 'number' &&
                Number.isFinite(row.lat) &&
                Number.isFinite(row.lng);
              const meta = [row.placeLabel, hasEntity ? 'Linked record' : undefined]
                .filter(Boolean)
                .join(' · ');

              return (
                <View key={row.name} style={styles.nameBlock}>
                  <LedgerRow
                    title={row.name}
                    slug={meta || undefined}
                    summary={row.locationLabel}
                    leading={<NavIcon name="memorial" size={20} />}
                    showChevron={hasEntity}
                    showDivider={false}
                    onPress={
                      hasEntity ? () => router.push(`/entity/${row.entityId}` as never) : undefined
                    }
                    accessibilityLabel={
                      hasEntity
                        ? `${row.name}. Opens linked place record.`
                        : `${row.name}. Name on the memorial list.`
                    }
                  />
                  {hasMaps ? (
                    <View style={styles.rowActions}>
                      <Button
                        label={MEMORIAL_ACTIONS.openMaps}
                        variant="ghost"
                        density="compact"
                        onPress={() => void openMaps(row)}
                        accessibilityHint="Opens the stored public-precision location in Maps"
                      />
                    </View>
                  ) : null}
                  {index < names.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>Keep this list honest</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {MEMORIAL_LIST.note}
          </Text>
          <View style={styles.actions}>
            <Button
              label={MEMORIAL_ACTIONS.methodology}
              variant="secondary"
              density="compact"
              onPress={() => router.push('/methodology')}
            />
            <Button
              label={MEMORIAL_ACTIONS.submit}
              variant="ghost"
              density="compact"
              onPress={() => router.push('/more' as never)}
              accessibilityHint="Returns to More, where Submit still opens the web form until Wave 3"
            />
          </View>
        </View>

        {mapsNotice ? (
          <Notice tone="info" title="Maps unavailable" description={mapsNotice} />
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
  nameBlock: {
    gap: space['1'],
  },
  rowActions: {
    alignItems: 'flex-start',
    paddingLeft: 36,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: space['1'],
  },
  actions: {
    gap: space['2'],
    alignItems: 'flex-start',
  },
});
