/**
 * Renders one claim's citation: source + label always visible as text (never a bare URL), and
 * — only when a safe `href` is present — a pressable link that opens through the allowlisted
 * `openExternalLink` (linking.ts), never `src/ui/Link.tsx`'s unchecked `Linking.openURL` call.
 * A `withheldReason` (the citation resolves to protected/private evidence) renders as muted
 * explanatory text instead of a link, matching web's `EvidenceCard.tsx` treatment verbatim.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useThemeColors, space } from '@/ui';
import { OFFLINE_CITATION_COPY, UNSAFE_LINK_COPY } from './copy';
import { isSafeExternalUrl, openExternalLink } from './linking';
import type { Citation } from './types';

export type CitationLinkProps = {
  readonly citation: Citation;
  readonly isOnline: boolean;
};

export function CitationLink({ citation, isOnline }: CitationLinkProps) {
  const theme = useThemeColors();
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const hasSafeHref = Boolean(citation.href) && isSafeExternalUrl(citation.href);

  const handlePress = async () => {
    if (!citation.href) return;
    const result = await openExternalLink(citation.href, { isOnline });
    if (result === 'offline') setNotice(OFFLINE_CITATION_COPY.description);
    else if (result === 'blocked-unsafe-url') setNotice(UNSAFE_LINK_COPY.description);
    else if (result === 'failed') setNotice('This link could not be opened.');
    else setNotice(undefined);
  };

  return (
    <View>
      {hasSafeHref ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${citation.label}, ${citation.source}`}
          hitSlop={8}
          onPress={handlePress}
        >
          <Text variant="bodySmall" style={{ color: theme.accent, textDecorationLine: 'underline' }}>
            {citation.label}
          </Text>
          <Text variant="caption" colorRole="inkMuted">
            {citation.source}
          </Text>
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${citation.label}, ${citation.source}`}>
          <Text variant="bodySmall">{citation.label}</Text>
          <Text variant="caption" colorRole="inkMuted">
            {citation.source}
          </Text>
        </View>
      )}
      {citation.withheldReason ? (
        <Text variant="caption" colorRole="inkMuted" style={styles.note}>
          {citation.withheldReason}
        </Text>
      ) : null}
      {notice ? (
        <Text variant="caption" colorRole="inkMuted" style={styles.note} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: space['1'],
  },
});
