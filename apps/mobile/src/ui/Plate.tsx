/**
 * Photo plate: a record's own sourced photograph shown large, with its credit line always
 * shown beside it and never on the photograph. Mobile counterpart of web `.ds-plate`
 * (`docs/ui/archive/patterns-living-archive.md`, "Plates"). Real, credited photographs only; callers
 * skip the plate for the memorial and for sensitive or violence-adjacent records.
 * shortcut: the photograph is not duotone-toned as on web, add the tone when it can be done
 * without a second image file.
 */
import { StyleSheet, View } from 'react-native';
import { Image, type ImageProps } from './Image';
import { Text } from './Text';
import { space } from './tokens';

export type PlateProps = Omit<ImageProps, 'borderRadiusKey'> & {
  /** The record's credit line, unaltered. Required: no credit, no plate. */
  credit: string;
  radiusKey?: 'sm' | 'md';
};

export function Plate({ credit, radiusKey = 'md', aspectRatio = 3 / 2, ...image }: PlateProps) {
  return (
    <View style={styles.plate} testID="plate">
      <Image {...image} aspectRatio={aspectRatio} borderRadiusKey={radiusKey} />
      <Text variant="code" colorRole="inkMuted" testID="plate-credit">
        {credit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    gap: space['2'],
  },
});
