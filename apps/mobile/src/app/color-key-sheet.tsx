/**
 * Color key modal — v6 Explore encoding reference (kind families, tones, size, confidence).
 */
import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { MapColorKey } from '@/features/map/explore/MapColorKey';
import { ScreenCanvas } from '@/ui';
import { useEditionStackBack } from '@/shell/use-edition-stack-back';

export default function ColorKeySheet() {
  useEditionStackBack({
    fallbackHref: '/explore',
    accessibilityHint: 'Closes the color key when there is no previous screen',
  });

  return (
    <ScreenCanvas edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <MapColorKey />
      </View>
    </ScreenCanvas>
  );
}

export function dismissColorKeySheet() {
  router.back();
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
