/**
 * Gradient backdrop host for compact mobile panels. Consumes `useGradient` stop data
 * and renders via the shared `BrandLinearGradient` host (expo-linear-gradient).
 * Flat Surface stays the default; reach for this when a section needs subtle canvas
 * depth or a copper edge accent.
 */
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { BrandLinearGradient } from './BrandLinearGradient';
import { radius, space, useGradient, type GradientName, type RadiusKey, type SpaceKey } from './tokens';

export type GradientPanelProps = ViewProps & {
  /** Named gradient preset from elevation tokens. */
  name: GradientName;
  radiusKey?: RadiusKey;
  paddingKey?: SpaceKey;
  children?: ReactNode;
};

export function GradientPanel({
  name,
  radiusKey = 'md',
  paddingKey,
  style,
  children,
  ...rest
}: GradientPanelProps) {
  const gradient = useGradient(name);

  return (
    <View
      style={[
        {
          borderRadius: radius[radiusKey],
          overflow: 'hidden',
          backgroundColor: gradient.colors[0],
        },
        style,
      ]}
      {...rest}
    >
      <BrandLinearGradient gradient={gradient} />
      {paddingKey ? (
        <View style={{ padding: space[paddingKey] }}>{children}</View>
      ) : (
        children
      )}
    </View>
  );
}

/** Absolute-fill gradient layer for stacking under bordered content. */
export function GradientBackdrop({ name }: { readonly name: GradientName }) {
  const gradient = useGradient(name);
  return <BrandLinearGradient gradient={gradient} />;
}
