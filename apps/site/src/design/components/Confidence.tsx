/**
 * Evidence-confidence badge: a glyph mark plus a text label, on the confidence color ramp.
 * Port of packages/ui/src/components/Confidence.tsx + `.ds-confidence` in components.css.
 *
 * This is the REFERENCE component for the kit. Copy its shape:
 *   - styled() frame with `variants`, never inline literals; colors are theme ROLES ($confidenceHighBg ...);
 *   - sizes are scale tokens ($1, $3, $caption), borders are 1px hairlines, radius is a token ($sm);
 *   - semantics are real: `render="span"` here, `role="status"`, the glyph is aria-hidden and the label is
 *     the accessible text, so meaning never depends on color or on the glyph alone;
 *   - the colors do not change with theme in the component; the theme does.
 */
import type { ReactNode } from 'react';
import { styled } from '@tamagui/core';
import { XStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ConfidenceProps = {
  readonly level: ConfidenceLevel;
  /** Replaces the default label ("High confidence"). */
  readonly label?: string;
};

const MARKS: Record<ConfidenceLevel, string> = { high: '●●●', medium: '●●○', low: '●○○' };
const DEFAULT_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const Frame = styled(XStack, {
  name: 'Confidence',
  render: 'span',
  role: 'status',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: '$2',
  paddingVertical: '$1',
  paddingHorizontal: '$3',
  borderWidth: 1,
  borderRadius: '$sm',
  variants: {
    level: {
      high: { backgroundColor: '$confidenceHighBg', borderColor: '$confidenceHighBorder' },
      medium: { backgroundColor: '$confidenceMediumBg', borderColor: '$confidenceMediumBorder' },
      low: { backgroundColor: '$confidenceLowBg', borderColor: '$confidenceLowBorder' },
    },
  } as const,
});

const FG = {
  high: '$confidenceHighFg',
  medium: '$confidenceMediumFg',
  low: '$confidenceLowFg',
} as const;

export function Confidence({ level, label }: ConfidenceProps): ReactNode {
  const color = FG[level];
  const weight = level === 'high' ? '600' : '500';
  return (
    <Frame level={level} data-tier={level}>
      <SizableText
        aria-hidden
        fontFamily="$mono"
        fontSize="$caption"
        fontWeight={weight}
        color={color}
      >
        {MARKS[level]}
      </SizableText>
      <SizableText fontFamily="$body" fontSize="$caption" fontWeight={weight} color={color}>
        {label ?? DEFAULT_LABELS[level]}
      </SizableText>
    </Frame>
  );
}
