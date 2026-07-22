/**
 * Search result row (MOB-013 item 6).
 *
 * HARD GUARANTEE: this component's props never carry a raw relevance score, ranking number, or
 * evidence/connection COUNT. `packages/public-contracts/src/v1/search.ts`'s own header states
 * that guarantee at the contract level ("Nothing here exposes a raw relevance score, an evidence
 * count, or any other numeric ranking signal to end users"); `toSearchResultCardProps` below is
 * the mobile-side enforcement of the SAME guarantee at the UI boundary -- it is a field-by-field
 * ALLOW-LIST mapping (never `{...result}`), so a future field added to `SearchResultV1` cannot
 * silently reach this component's props without an explicit, reviewable change here.
 * `SearchResultCard.test.tsx`'s negative test asserts this holds even when a hostile/malformed
 * payload carries an extra numeric field.
 *
 * All user-supplied text (displayName/summary/explanation/status, which round-trip through a
 * public, editorially-reviewed but ultimately server-controlled pipeline) is rendered exclusively
 * through React Native `<Text>` children -- never through any HTML/WebView renderer and never
 * through `dangerouslySetInnerHTML` (which does not exist on RN `Text` at all). An
 * XSS/HTML/script-shaped string is therefore always inert display text, by construction, not by
 * a sanitization step that could be forgotten -- see the adversarial render test.
 */
import { ListRow, Text } from '@/ui';
import type { SearchResultV1 } from './search-contracts';

export interface SearchResultCardProps {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly explanation: string;
  readonly status?: string;
  readonly onPress?: (id: string) => void;
}

/** Explicit allow-list mapping -- the enforcement point described in the module header. */
export function toSearchResultCardProps(
  result: SearchResultV1,
  onPress?: (id: string) => void,
): SearchResultCardProps {
  return {
    id: result.id,
    kind: result.kind,
    displayName: result.displayName,
    summary: result.summary,
    explanation: result.explanation,
    status: result.status,
    onPress,
  };
}

function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]/g, ' ');
}

export function SearchResultCard({ id, kind, displayName, explanation, status, onPress }: SearchResultCardProps) {
  return (
    <ListRow
      title={displayName}
      subtitle={explanation}
      trailing={
        <ListRowTrailing kind={kind} status={status} />
      }
      onPress={onPress ? () => onPress(id) : undefined}
      accessibilityLabel={`${displayName}. ${humanize(kind)}${status ? `, ${humanize(status)}` : ''}. ${explanation}`}
    />
  );
}

function ListRowTrailing({ kind, status }: { kind: string; status?: string }) {
  return (
    <Text variant="caption" colorRole="inkMuted" style={{ textAlign: 'right' }}>
      {humanize(kind)}
      {status ? `\n${humanize(status)}` : ''}
    </Text>
  );
}
