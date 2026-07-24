/**
 * History / search result row: kind glyph, KIND · ERA slug, title, one story line,
 * copper "Show on map". Compact Ledger density — no fact-grid wall or numbered index.
 */
import { StyleSheet, View } from 'react-native';
import {
  Button,
  LedgerRow,
  NavIcon,
  navIconForEntityKind,
  space,
} from '@/ui';
import {
  recordEraLabel,
  recordKindLabel,
  recordStatusLabel,
} from '../record-facts/record-facts';
import type { SearchResultV1 } from './search-contracts';

export interface SearchResultCardProps {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly explanation: string;
  readonly status?: string;
  readonly eraBuckets?: readonly string[];
  readonly onPress?: (id: string) => void;
  readonly onShowOnMap?: (id: string, kind: string) => void;
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
  onPress,
  onShowOnMap,
}: SearchResultCardProps) {
  const body = summary?.trim() || explanation;
  const kindLabel = recordKindLabel(kind);
  const eraLabel = recordEraLabel({ eraBuckets: eraBuckets ?? [] });
  const statusLabel = recordStatusLabel(status);
  const slug = [kindLabel, eraLabel !== 'Undated' ? eraLabel : null, statusLabel]
    .filter(Boolean)
    .join(' · ');

  const accessibilitySlug = [kindLabel, eraLabel, statusLabel].filter(Boolean).join(', ');

  return (
    <View>
      <LedgerRow
        title={displayName}
        slug={slug}
        summary={body}
        leading={<NavIcon name={navIconForEntityKind(kind)} size={18} />}
        showChevron={Boolean(onPress)}
        onPress={onPress ? () => onPress(id) : undefined}
        accessibilityLabel={`${displayName}. ${accessibilitySlug}. ${body}`}
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
  secondary: {
    alignItems: 'flex-start',
    paddingLeft: 28 + space['2'] + space['3'],
    paddingBottom: space['2'],
    marginTop: -space['1'],
  },
});
