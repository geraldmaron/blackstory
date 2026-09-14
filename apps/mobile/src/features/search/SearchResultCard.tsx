/**
 * History / search result row: kind glyph, KIND · ERA slug, title, one story line,
 * copper "Show on map". Compact Ledger density — no fact-grid wall or numbered index.
 *
 * The row draws the shared evidence meter when the result carries a grade. A search row used to
 * be the one place in the app that showed a record with no assessment beside it, which asked the
 * reader to weigh a result while withholding how well it is sourced. The meter here is the same
 * component and the same vocabulary Explore's rail and the record page use, so a record reads the
 * same wherever it appears. A grade is an assessment; the banned per-record COUNT stays off the
 * search contract entirely (`packages/public-contracts/src/v1/search.ts`).
 */
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { evidenceMeterLabel, type ConfidenceTier } from '@repo/public-contracts/evidence';
import {
  Button,
  LedgerRow,
  NavIcon,
  navIconForEntityKind,
  RecordMeter,
  space,
  useThemeColors,
} from '@/ui';
import { recordEraLabel, recordKindLabel, recordStatusLabel } from '../record-facts/record-facts';
import type { SearchResultV1 } from './search-contracts';

export interface SearchResultCardProps {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly explanation: string;
  readonly status?: string;
  readonly eraBuckets?: readonly string[];
  /**
   * How well the record is supported. Absent when the server could not grade it — which the row
   * renders as no meter at all, never as an empty one: "we could not grade this" is not the same
   * claim as "nobody assessed this", and `unrated` already means the second.
   */
  readonly confidenceTier?: ConfidenceTier;
  readonly onPress?: (id: string) => void;
  readonly onShowOnMap?: (id: string, kind: string) => void;
  /**
   * Where this row sits in the rendered results. Neither VoiceOver nor TalkBack reads a position
   * for a plain row list, so the row says it. `partial` marks a page with more results to load,
   * where the total is only what has loaded so far.
   */
  readonly position?: { readonly index: number; readonly total: number; readonly partial?: boolean };
}

export type SearchResultCardHandlers = {
  readonly onPress?: (id: string) => void;
  readonly onShowOnMap?: (id: string, kind: string) => void;
};

export function toSearchResultCardProps(
  result: SearchResultV1,
  handlers: SearchResultCardHandlers = {},
): SearchResultCardProps {
  return {
    id: result.id,
    kind: result.kind,
    displayName: result.displayName,
    explanation: result.explanation,
    eraBuckets: result.eraBuckets,
    ...(result.summary !== undefined ? { summary: result.summary } : {}),
    ...(result.status !== undefined ? { status: result.status } : {}),
    ...(result.confidenceTier !== undefined ? { confidenceTier: result.confidenceTier } : {}),
    ...(handlers.onPress ? { onPress: handlers.onPress } : {}),
    ...(handlers.onShowOnMap ? { onShowOnMap: handlers.onShowOnMap } : {}),
  };
}

export function SearchResultCard({
  id,
  kind,
  displayName,
  summary,
  explanation,
  status,
  eraBuckets,
  confidenceTier,
  onPress,
  onShowOnMap,
  position,
}: SearchResultCardProps) {
  const theme = useThemeColors();
  const body = summary?.trim() || explanation;
  const kindLabel = recordKindLabel(kind);
  const eraLabel = recordEraLabel({ eraBuckets: eraBuckets ?? [] });
  const statusLabel = recordStatusLabel(status);
  const slug = [kindLabel, eraLabel !== 'Undated' ? eraLabel : null, statusLabel]
    .filter(Boolean)
    .join(' · ');

  const accessibilitySlug = [kindLabel, eraLabel, statusLabel].filter(Boolean).join(', ');
  // The row is one accessible element, so the meter is decorative and the sentence it would have
  // spoken is composed into the row's own label — the same handling Explore's rail uses. Nesting a
  // second accessible node inside the row would drop that sentence, not add it.
  const evidenceSentence =
    confidenceTier !== undefined ? ` ${evidenceMeterLabel(confidenceTier)}.` : '';
  const positionSentence = position
    ? ` ${position.index + 1} of ${position.total}${position.partial ? ' loaded' : ''}.`
    : '';

  return (
    <View>
      <LedgerRow
        title={displayName}
        slug={slug}
        summary={body}
        leading={<NavIcon name={navIconForEntityKind(kind)} size={18} />}
        onPress={onPress ? () => onPress(id) : undefined}
        trailing={
          confidenceTier !== undefined ? (
            <View style={styles.trailing}>
              {/* The letter beside the bars is the non-color cue: color is never the only one. */}
              <RecordMeter tier={confidenceTier} decorative testID="search-result-evidence-meter" />
              {onPress ? (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.inkMuted}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ) : null}
            </View>
          ) : undefined
        }
        showChevron={Boolean(onPress)}
        accessibilityLabel={`${displayName}. ${accessibilitySlug}. ${body}${evidenceSentence}${positionSentence}`}
        showDivider
      />
      {onShowOnMap ? (
        <View style={styles.secondary}>
          <Button
            label="Show on map"
            variant="ghost"
            density="compact"
            accessibilityLabel={`Show ${displayName} on map`}
            onPress={() => onShowOnMap(id, kind)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space['2'],
  },
  secondary: {
    alignItems: 'flex-start',
    paddingLeft: 28 + space['2'] + space['3'],
    paddingBottom: space['2'],
    marginTop: -space['1'],
  },
});
