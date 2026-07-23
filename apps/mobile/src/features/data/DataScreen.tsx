/**
 * Mobile Data screen — Ledger Line: canvas masthead + mono section labels +
 * flat metric stacks. One Surface plate max is not required here; indicators
 * sit on Archive Paper with hairline rhythm.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  EmptyState,
  LedgerSectionLabel,
  Notice,
  RecordFactStrip,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
} from '@/ui';
import {
  DATA_INTRO,
  DATA_ORIENTATION_BEATS,
  DATA_SECTION_COPY,
} from './data-copy';
import { formatCount } from './format';
import { getDataPageModel } from './indicator-snapshot';
import { GroupedSeriesMetric } from './GroupedSeriesMetric';
import { RacePairMetric } from './RacePairMetric';

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
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.population.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.population.lede}
          </Text>
          <EmptyState
            compact
            title="Census timeline not on this release yet"
            description="The national decade-by-decade series ships on the web when the warehouse snapshot is ready. Open Explore for place layers meanwhile."
          />
          <Button
            label="Open Explore"
            variant="secondary"
            density="compact"
            onPress={() => router.push('/explore')}
            accessibilityHint="Opens the Explore map tab"
          />
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
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>{DATA_SECTION_COPY.next.title}</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            {DATA_SECTION_COPY.next.lede}
          </Text>
          <View style={styles.actions}>
            <Button
              label="Explore the map"
              variant="accent"
              onPress={() => router.push('/explore')}
              accessibilityHint="Opens the Explore map tab"
            />
            <Button
              label="Read methodology"
              variant="secondary"
              onPress={() => router.push('/learn/methodology' as never)}
              accessibilityHint="Opens methodology"
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
