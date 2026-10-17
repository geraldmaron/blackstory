/**
 * Port of packages/ui/src/components/Button.tsx and components.css `.ds-button`.
 * Both sizes use the kit touch target, pill radius and caption step; compact only reduces padding.
 * Font metrics use the configured caption step instead of literal leading/tracking.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { styled, type GetProps } from '@tamagui/core';
import { SizableText } from '@tamagui/text';
import { focus } from '../tokens';

const Frame = styled(SizableText, {
  name: 'Button',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',
  minHeight: '$touch',
  paddingVertical: 0,
  paddingHorizontal: '$5',
  borderWidth: 1,
  borderColor: 'transparent',
  borderRadius: '$full',
  fontFamily: '$body',
  fontSize: '$caption',
  fontWeight: '600',
  cursor: 'pointer',
  focusVisibleStyle: {
    outlineColor: '$focusRing',
    outlineStyle: 'solid',
    outlineWidth: focus.width,
    outlineOffset: focus.offset,
  },
  disabledStyle: { opacity: 0.55, cursor: 'not-allowed' },
  variants: {
    variant: {
      primary: {
        backgroundColor: '$accentGraphic',
        color: '$fixedInk',
        // Hover must not fade the text: opacity on the whole button drops the pair below 4.5:1.
        hoverStyle: { borderColor: '$fixedInk', textDecorationLine: 'underline' },
      },
      secondary: {
        backgroundColor: 'transparent',
        borderColor: '$borderStrong',
        color: '$ink',
        hoverStyle: { backgroundColor: '$surfaceRaised' },
      },
    },
    compact: { true: { paddingHorizontal: '$4' } },
  } as const,
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: 'primary' | 'secondary';
  readonly compact?: boolean;
  readonly children: ReactNode;
  readonly onPress?: GetProps<typeof Frame>['onPress'];
};

export function Button({
  variant = 'primary',
  compact = false,
  type = 'button',
  disabled = false,
  className,
  onPress,
  children,
  ...rest
}: ButtonProps): ReactNode {
  return (
    <Frame
      render={<button {...rest} type={type} disabled={disabled} />}
      variant={variant}
      compact={compact}
      disabled={disabled}
      className={className}
      onPress={onPress}
    >
      {children}
    </Frame>
  );
}
