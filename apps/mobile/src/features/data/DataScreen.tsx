/**
 * Mobile Data screen — parity with web `/data` (DataSections): orientation, Census
 * (honest degraded without timeline API), Phase 1 wealth/housing/justice indicators,
 * catalog coverage, Explore + Methodology hand-offs.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  Divider,
  EmptyState,
  LiftedSurface,
  Notice,
  ScreenCanvas,
  ScreenHeader,
  SectionHeader,
  Text,
  screenScrollInsets,
  space,
} from '@/ui';
import { formatCount } from './format';
import { getDataPageModel } from './indicator-snapshot';
import { GroupedSeriesMetric } from './GroupedSeriesMetric';
import { RacePairMetric } from './RacePairMetric';

const ORIENTATION_BEATS = [
  {
    kicker: 'National first',
    body: 'Census sections show the country-wide picture. Indicator figures zoom into published series we also use on Themes.',
  },
  {
    kicker: 'Sources visible',
    body: 'Every figure links to where it came from. Fixture-backed charts say so until a live warehouse feed replaces them.',
  },
  {
    kicker: 'Gaps are not silence',
    body: 'Uneven coverage means the feed is incomplete, not that nothing happened. Juxtaposition is not causation.',
  },
] as const;

export function DataScreen() {
  const model = getDataPageModel();
  const { indicators, phase1 } = model;

  return (
    <ScreenCanvas>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker="Numbers"
          title="Data behind the archive"
          dek="National Census context plus curated indicators — wealth, housing, credit, and justice. Every figure names its source. For county maps, open Explore."
        />

        <Notice
          tone="info"
          title="Figures use verified Phase 1 fixtures"
          description="Charts below use the same fixture bundle as the website until live warehouse rows replace them on this app."
        />

        <View style={styles.section}>
          <SectionHeader title="How to read these numbers" meta="Start here" headingScale="bodyEmphasis" />
          <LiftedSurface tone="surface" shadow="none" paddingKey="3">
            <View style={styles.beats}>
              {ORIENTATION_BEATS.map((beat) => (
                <View key={beat.kicker} style={styles.beat}>
                  <Text variant="code" colorRole="accent">
                    {beat.kicker}
                  </Text>
                  <Text variant="body" colorRole="inkMuted">
                    {beat.body}
                  </Text>
                </View>
              ))}
            </View>
          </LiftedSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Black population over time" meta="U.S. Census" headingScale="bodyEmphasis" />
          <EmptyState
            title="Census timeline not on this release yet"
            description="The national decade-by-decade population series ships on the website when the warehouse snapshot is available. Open Explore for place layers, or check back after the next update."
            action={{
              label: 'Open Explore',
              onPress: () => router.push('/explore'),
            }}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Wealth gap at a glance" meta="SCF" headingScale="bodyEmphasis" />
          <Text variant="body" colorRole="inkMuted" style={styles.lede}>
            Median family net worth from the Federal Reserve's triennial survey — national
            juxtaposition used beside housing-credit eras, not proof of a single cause.
          </Text>
          <RacePairMetric series={indicators.wealthComparison} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Housing, credit, and cost burden" meta="NHGIS · HMDA · CHAS" headingScale="bodyEmphasis" />
          <Text variant="body" colorRole="inkMuted" style={styles.lede}>
            Cook County is our Phase 1 place spine: decennial homeownership, mortgage denial rates,
            and HUD CHAS cost burden — the same metrics bound to theme-impact questions.
          </Text>
          <GroupedSeriesMetric series={indicators.cookHomeownership} />
          <GroupedSeriesMetric series={indicators.hmdaDenialRates} />
          <RacePairMetric series={indicators.costBurdenComparison} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Imprisonment and federal drug sentences" meta="BJS · USSC" headingScale="bodyEmphasis" />
          <Text variant="body" colorRole="inkMuted" style={styles.lede}>
            State imprisonment rates and federal cocaine sentencing averages — context for drug
            policy eras, not proof that any single law caused a number.
          </Text>
          <RacePairMetric series={indicators.imprisonmentComparison} />
          <GroupedSeriesMetric series={indicators.federalDrugSentences} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Same metrics, full stories" meta="Catalog" headingScale="bodyEmphasis" />
          <LiftedSurface tone="surface" shadow="none">
            <View style={styles.statRow}>
              <Text variant="title" isHeading>
                {formatCount(phase1.metricCount)}
              </Text>
              <Text variant="body" colorRole="inkMuted">
                Curated metrics defined
              </Text>
              <Text variant="code" colorRole="inkSubtle">
                {phase1.themes.join(', ')}
              </Text>
            </View>
            <Divider />
            <View style={styles.statRow}>
              <Text variant="title" isHeading>
                {formatCount(phase1.sampleObservationCount)}
              </Text>
              <Text variant="body" colorRole="inkMuted">
                Warehouse observations loaded
              </Text>
              <Text variant="code" colorRole="inkSubtle">
                {phase1.sampleObservationCount === 0
                  ? 'Catalog + fixtures until ingest completes'
                  : 'Reference statistical observations'}
              </Text>
            </View>
          </LiftedSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Dig into a place" meta="Next step" headingScale="bodyEmphasis" />
          <Text variant="body" colorRole="inkMuted" style={styles.lede}>
            Open the map for county layers and local context. Methodology explains how we read
            outside statistics next to archive records.
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
    gap: screenScrollInsets.gap,
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
  lede: {
    marginBottom: space['1'],
  },
  statRow: {
    paddingHorizontal: space['3'],
    paddingVertical: space['3'],
    gap: space['1'],
    minHeight: 44,
  },
  actions: {
    gap: space['2'],
  },
});
