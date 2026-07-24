/**
 * Mobile Data screen — Ledger Line national modeling room: coverage pulse,
 * Census model frame, proportion bars, sparklines, and Phase 1 indicator stacks.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
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
import { CensusModelFrame } from './CensusModelFrame';
import { CoveragePulse } from './CoveragePulse';
import {
  DATA_INTRO,
  DATA_ORIENTATION_BEATS,
  DATA_SECTION_COPY,
} from './data-copy';
import { formatCount } from './format';
import { getDataPageModel } from './indicator-snapshot';
import { GroupedSeriesMetric } from './GroupedSeriesMetric';
import { MethodCallout } from './MethodCallout';
import { RacePairMetric } from './RacePairMetric';

const COVERAGE_ITEMS = [
  { id: 'population', label: 'Population', status: 'deferred' as const },
  { id: 'wealth', label: 'Wealth', status: 'fixture' as const },
  { id: 'housing', label: 'Housing', status: 'fixture' as const },
  { id: 'justice', label: 'Justice', status: 'fixture' as const },
  { id: 'themes', label: 'Themes', status: 'catalog' as const },
];

export function DataScreen() {
  const model = getDataPageModel();
  const { indicators, phase1 } = model;
  const servedFromNote =
    indicators.servedFrom === 'fixture'
      ? 'Charts below use verified Phase 1 fixtures until live warehouse rows replace them.'
      : 'Charts below read from the reference indicator warehouse when available.';

  return (
    // `/data` is a stack screen with a visible native header, so the canvas insets
    // only the sides and bottom — the header already owns the top inset.
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker={DATA_INTRO.kicker}
          title="Data behind the archive"
          dek={DATA_INTRO.lede}
          compact
          dense
        />

        <View style={styles.section}>
          <LedgerSectionLabel>{DATA_SECTION_COPY.orientation.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.orientation.lede}
          </Text>
          <Notice
            tone="info"
            title="Figures use verified Phase 1 fixtures"
            description={servedFromNote}
          />
          <CoveragePulse items={COVERAGE_ITEMS} />
          <View style={styles.beats}>
            {DATA_ORIENTATION_BEATS.map((beat) => (
              <View key={beat.kicker} style={styles.beat}>
                <Text variant="sectionLabel" colorRole="accent" style={styles.beatKicker}>
                  {beat.kicker}
                </Text>
                <Text variant="caption" colorRole="inkMuted">
                  {beat.body}
                </Text>
              </View>
            ))}
          </View>
          <MethodCallout
            label="Juxtaposition"
            body="Indicators sit beside archive evidence. Gaps mean the feed is incomplete, not that nothing happened. Comparison is not causation."
          />
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label="Juxtaposition rules"
              variant="ghost"
              density="compact"
              onPress={() => router.push('/learn/methodology' as never)}
              accessibilityHint="Opens methodology"
            />
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.population.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.population.lede}
          </Text>
          <CensusModelFrame />
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label="Open Explore"
              variant="secondary"
              density="compact"
              onPress={() => router.push('/explore')}
              accessibilityHint="Opens the Explore map tab"
            />
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.wealth.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.wealth.lede}
          </Text>
          <RacePairMetric series={indicators.wealthComparison} />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.housing.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.housing.lede}
          </Text>
          <GroupedSeriesMetric series={indicators.cookHomeownership} />
          <GroupedSeriesMetric series={indicators.hmdaDenialRates} />
          <RacePairMetric series={indicators.costBurdenComparison} />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.justice.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.justice.lede}
          </Text>
          <RacePairMetric series={indicators.imprisonmentComparison} />
          <GroupedSeriesMetric series={indicators.federalDrugSentences} />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.themes.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.themes.lede}
          </Text>
          <RecordFactStrip
            facts={[
              {
                key: 'metrics',
                label: 'Metrics defined',
                value: formatCount(phase1.metricCount),
              },
              {
                key: 'themes',
                label: 'Domains',
                value: phase1.themes.join(', '),
              },
              {
                key: 'observations',
                label: 'Observations loaded',
                value: formatCount(phase1.sampleObservationCount),
              },
              {
                key: 'feed',
                label: 'Feed status',
                value:
                  phase1.sampleObservationCount === 0
                    ? 'Catalog and fixtures until ingest completes'
                    : 'Reference statistical observations',
              },
            ]}
          />
          <MethodCallout
            label="Themes hand-off"
            body="Phase 1 indicators also appear inside research packets. Open Themes for redlining, drug policy, and related packets without causal overclaim."
          />
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label="Open Themes"
              variant="ghost"
              density="compact"
              onPress={() => router.push('/themes' as never)}
              accessibilityHint="Opens Themes browse"
            />
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.next.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.next.lede}
          </Text>
          <View style={styles.actions}>
            <LedgerRow
              title="Explore the map"
              summary="Open pins and place records nearby"
              leading={<NavIcon name="explore" size={20} />}
              showChevron
              onPress={() => router.push('/explore')}
              accessibilityLabel="Explore the map"
              showDivider
            />
            <LedgerRow
              title="Read methodology"
              summary="How records are researched and verified"
              leading={<NavIcon name="methodology" size={20} />}
              showChevron
              onPress={() => router.push('/learn/methodology' as never)}
              accessibilityLabel="Read methodology"
              showDivider
            />
            <LedgerRow
              title="Banned books"
              summary="Challenged titles with cited reports"
              leading={<NavIcon name="books" size={20} />}
              showChevron
              onPress={() => router.push('/books' as never)}
              accessibilityLabel="Banned books"
              showDivider={false}
            />
          </View>
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
  beats: {
    gap: space['3'],
  },
  beat: {
    gap: space['1'],
  },
  beatKicker: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actions: {
    gap: space['2'],
  },
});
