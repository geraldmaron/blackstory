/**
 * Shared text field primitive for form surfaces (corrections intake, status lookup).
 * A single styled `TextInput` with focus/invalid border states and a stable 44pt tap target.
 *
 * - `minHeight: MIN_TOUCH_TARGET` so the tap target clears the 44pt floor.
 * - Focused border uses the copper `accent`; an invalid field uses the status error color.
 * - Border WIDTH is held constant across states so focusing/invalidating never reflows.
 * - `ref` is forwarded so forms can build a focus chain across fields.
 */
import { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { MIN_TOUCH_TARGET, radius, space, useStatusColors, useThemeColors } from './tokens';

export type CorrectionTextFieldProps = TextInputProps & {
  /** Renders the field with the status error border (a failed validation field). */
  readonly invalid?: boolean;
};

export const CorrectionTextField = forwardRef<TextInput, CorrectionTextFieldProps>(
  function CorrectionTextField(
    { invalid = false, multiline, style, onFocus, onBlur, placeholderTextColor, ...rest },
    ref,
  ) {
    const theme = useThemeColors();
    const status = useStatusColors();
    const [focused, setFocused] = useState(false);

    const borderColor = invalid
      ? status.error.border
      : focused
        ? theme.accent
        : theme.border;

    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={placeholderTextColor ?? theme.inkMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            minHeight: MIN_TOUCH_TARGET,
            borderWidth: 1,
            borderColor,
            borderRadius: radius.sm,
            paddingHorizontal: space['3'],
            paddingVertical: space['2'],
            backgroundColor: theme.surfaceRaised,
            color: theme.ink,
          },
          multiline ? { textAlignVertical: 'top' } : null,
          style,
        ]}
        {...rest}
      />
    );
  },
);
