/**
 * Search / history result row (MOB-013). v6 rip-list anatomy: title, summary, and
 * label-over-value fact strip (Kind, Era, Status). Allow-list props only.
 */
import { StyleSheet, View } from 'react-native';
import {
  Button,
  LedgerRow,
  NavIcon,
  navIconForEntityKind,
  RecordFactStrip,
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
  /** Mono ledger index (01, 02…). */
  readonly indexLabel?: string;
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
  indexLabel,
  onPress,
  onShowOnMap,
}: SearchResultCardProps) {
  const body = summary?.trim() || explanation;
  const kindLabel = recordKindLabel(kind);
  const eraLabel = recordEraLabel({ eraBuckets: eraBuckets ?? [] });
  const statusLabel = recordStatusLabel(status);

  const facts = [
    {
      key: 'kind',
      label: 'Kind',
      value: kindLabel,
      leading: <NavIcon name={navIconForEntityKind(kind)} size={16} />,
    },
    {
      key: 'era',
      label: 'Era',
      value: eraLabel,
    },
    ...(statusLabel
      ? [
          {
            key: 'status',
            label: 'Status',
            value: statusLabel,
          },
        ]
      : []),
  ];

  const accessibilitySlug = [kindLabel, eraLabel, statusLabel].filter(Boolean).join(', ');

  return (
    <View>
      <LedgerRow
        title={displayName}
        summary={body}
        indexLabel={indexLabel}
        showChevron={Boolean(onPress)}
        onPress={onPress ? () => onPress(id) : undefined}
        accessibilityLabel={`${displayName}. ${accessibilitySlug}. ${body}`}
        showDivider={false}
        secondaryAction={
          <View style={styles.factsPane}>
            <RecordFactStrip facts={facts} />
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
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  factsPane: {
    gap: space['2'],
    marginTop: space['1'],
  },
  secondary: {
    alignItems: 'flex-start',
  },
});
