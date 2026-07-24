/**
 * Stack route for `/themes/[themeId]` — theme detail with researched packets.
 */
import { useLocalSearchParams } from 'expo-router';
import { ThemesDetailScreen, parseThemeId } from '@/features/themes';
import { EmptyState, ScreenCanvas } from '@/ui';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';
import { ScrollView, StyleSheet } from 'react-native';
import { screenScrollInsets, space } from '@/ui';

export default function ThemesDetailRoute() {
  const params = useLocalSearchParams<{ themeId?: string | string[] }>();
  const raw = Array.isArray(params.themeId) ? params.themeId[0] : params.themeId;
  const themeId = parseThemeId(raw);

  useEditionStackBack({
    fallbackHref: '/themes',
    accessibilityHint: 'Returns to Themes when there is no previous screen',
  });

  if (!themeId) {
    return (
      <ScreenCanvas edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            title="Theme not found"
            description="That theme id is not valid in this release."
          />
        </ScrollView>
      </ScreenCanvas>
    );
  }

  return <ThemesDetailScreen themeId={themeId} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: space['3'],
  },
});
