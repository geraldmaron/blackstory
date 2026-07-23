/**
 * Search result row (MOB-013). Allow-list props only — never relevance scores.
 * Ledger anatomy: KIND · status slug, Sora title, serif explanation, optional
 * Show on map secondary action.
 */
import { StyleSheet, View } from 'react-native';
import { Button, LedgerRow, NavIcon, navIconForEntityKind, space } from '@/ui';
import type { SearchResultV1 } from './search-contracts';

export interface SearchResultCardProps {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly explanation: string;
  readonly status?: string;
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
    ...(result.summary !== undefined ? { summary: result.summary } : {}),
    ...(result.status !== undefined ? { status: result.status } : {}),
    ...(handlers.onPress ? { onPress: handlers.onPress } : {}),
    ...(handlers.onShowOnMap ? { onShowOnMap: handlers.onShowOnMap } : {}),
  };
}

function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]/g, ' ');
}

export function SearchResultCard({
  id,
  kind,
  displayName,
  summary,
  explanation,
  status,
  onPress,
  onShowOnMap,
}: SearchResultCardProps) {
  const metaParts = [humanize(kind).toUpperCase(), status ? humanize(status) : null].filter(Boolean);
  const slug = metaParts.join(' · ');
  const body = summary?.trim() || explanation;

  return (
    <LedgerRow
      title={displayName}
      slug={slug}
      summary={body}
      leading={<NavIcon name={navIconForEntityKind(kind)} size={20} />}
      showChevron={Boolean(onPress)}
      onPress={onPress ? () => onPress(id) : undefined}
      accessibilityLabel={`${displayName}. ${slug}. ${body}`}
      secondaryAction={
        onShowOnMap ? (
          <View style={styles.secondary}>
            <Button
              label="Show on map"
              variant="ghost"
              density="compact"
              accessibilityLabel={`Show ${displayName} on map`}
              onPress={() => onShowOnMap(id, kind)}
            />
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  secondary: {
    alignItems: 'flex-start',
    marginTop: space['1'],
  },
});
