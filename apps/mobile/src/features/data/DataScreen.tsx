/**
 * Mobile Data screen — v6 Surface edition stack with indexed panels, Census honest
 * degraded state, Phase 1 indicator fixtures, and Explore/Methodology hand-offs.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  EditionSurfacePanel,
  EditionSurfaceStack,
  EmptyState,
  LiftedSurface,
  Notice,
  RecordFactStrip,
  ScreenCanvas,
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
        <EditionSurfaceStack>
          <EditionSurfacePanel
            index="00"
            kicker={DATA_INTRO.kicker}
            title="Data behind the archive"
            dek={DATA_INTRO.lede}
          />

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.orientation.index}
            kicker={DATA_SECTION_COPY.orientation.kicker}
            title={DATA_SECTION_COPY.orientation.title}
            dek={DATA_SECTION_COPY.orientation.lede}
          >
            <Notice
              tone="info"
              title="Figures use verified Phase 1 fixtures"
              description={servedFromNote}
            />
            <View style={styles.beats}>
              {DATA_ORIENTATION_BEATS.map((beat) => (
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
          </EditionSurfacePanel>

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.population.index}
            kicker={DATA_SECTION_COPY.population.kicker}
            title={DATA_SECTION_COPY.population.title}
            dek={DATA_SECTION_COPY.population.lede}
          >
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
          </EditionSurfacePanel>

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.wealth.index}
            kicker={DATA_SECTION_COPY.wealth.kicker}
            title={DATA_SECTION_COPY.wealth.title}
            dek={DATA_SECTION_COPY.wealth.lede}
          >
            <RacePairMetric series={indicators.wealthComparison} />
          </EditionSurfacePanel>

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.housing.index}
            kicker={DATA_SECTION_COPY.housing.kicker}
            title={DATA_SECTION_COPY.housing.title}
            dek={DATA_SECTION_COPY.housing.lede}
          >
            <GroupedSeriesMetric series={indicators.cookHomeownership} />
            <GroupedSeriesMetric series={indicators.hmdaDenialRates} />
            <RacePairMetric series={indicators.costBurdenComparison} />
          </EditionSurfacePanel>

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.justice.index}
            kicker={DATA_SECTION_COPY.justice.kicker}
            title={DATA_SECTION_COPY.justice.title}
            dek={DATA_SECTION_COPY.justice.lede}
          >
            <RacePairMetric series={indicators.imprisonmentComparison} />
            <GroupedSeriesMetric series={indicators.federalDrugSentences} />
          </EditionSurfacePanel>

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.themes.index}
            kicker={DATA_SECTION_COPY.themes.kicker}
            title={DATA_SECTION_COPY.themes.title}
            dek={DATA_SECTION_COPY.themes.lede}
          >
            <LiftedSurface tone="surfaceRaised" shadow="none" paddingKey="3">
              <RecordFactStrip
                facts={[
                  {
                    key: 'metrics',
                    label: 'Metrics defined',
                    value: formatCount(phase1.metricCount),
                  },
                  {
                    key: 'themes',
                    label: 'Themes',
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
            </LiftedSurface>
          </EditionSurfacePanel>

          <EditionSurfacePanel
            index={DATA_SECTION_COPY.next.index}
            kicker={DATA_SECTION_COPY.next.kicker}
            title={DATA_SECTION_COPY.next.title}
            dek={DATA_SECTION_COPY.next.lede}
          >
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
          </EditionSurfacePanel>
        </EditionSurfaceStack>
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
  },
  beats: {
    gap: space['3'],
  },
  beat: {
    gap: space['1'],
  },
  actions: {
    gap: space['2'],
  },
});
