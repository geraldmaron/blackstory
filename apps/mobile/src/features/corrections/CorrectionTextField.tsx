/**
 * Shared text field for the corrections flow. A single styled `TextInput` so the
 * intake form and the status-lookup share one box treatment instead of each
 * re-declaring a bespoke `borderWidth: 1` style with no focus or invalid state.
 *
 * - `minHeight: MIN_TOUCH_TARGET` so the tap target clears the 44pt floor.
 * - Focused border uses the copper `accent`; an invalid field uses the status
 *   error color, so a failed field never looks like ordinary chrome.
 * - Border WIDTH is held constant across states so focusing/invalidating never
 *   reflows the form (only the color changes).
 * - `ref` is forwarded so the form can build a focus chain across fields.
 *
 * NOTE (follow-up): this lives in the feature because `src/ui` was frozen for
 * this pass; it should later be promoted into `src/ui` as the canonical
 * text-field primitive (there is currently no shared `TextField` there).
 */
import { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { MIN_TOUCH_TARGET, radius, space, useStatusColors, useThemeColors } from '@/ui';

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
