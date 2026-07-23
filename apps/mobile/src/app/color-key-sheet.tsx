/**
 * Color key modal — v6 Explore encoding reference (kind families, tones, size, confidence).
 */
import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { MapColorKey } from '@/features/map/explore/MapColorKey';
import { ScreenCanvas } from '@/ui';

export default function ColorKeySheet() {
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
