/**
 * Search input with one clear control on both platforms. iOS's native `clearButtonMode` glyph is
 * about a 14pt target with no way to size it, so the field draws its own at the touch-target floor.
 */
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MIN_TOUCH_TARGET, radius, space, typeScale, useThemeColors } from './tokens';

export type SearchFieldProps = Omit<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'accessibilityLabel'
  | 'accessibilityRole'
  | 'clearButtonMode'
  | 'style'
> & {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly accessibilityLabel: string;
};

/** Defaults: search return key that dismisses the keyboard, no autocorrect or capitalization. */
export function SearchField({ value, onChangeText, ...rest }: SearchFieldProps) {
  const theme = useThemeColors();
  return (
    <View
      style={[styles.field, { borderColor: theme.borderControl, backgroundColor: theme.surface }]}
    >
      <Ionicons
        name="search-outline"
        size={18}
        color={theme.inkMuted}
        accessibilityElementsHidden
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
        placeholderTextColor={theme.inkMuted}
        accessibilityRole="search"
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        {...rest}
        style={[styles.input, { color: theme.ink }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={({ pressed }) => [
            styles.clear,
            { backgroundColor: pressed ? theme.surfacePressed : 'transparent' },
          ]}
        >
          <Ionicons
            name="close-circle"
            size={20}
            color={theme.inkMuted}
            accessibilityElementsHidden
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
  },
  input: {
    flex: 1,
    fontSize: typeScale.caption.size,
    lineHeight: typeScale.caption.lineHeight,
    fontWeight: '500',
    padding: 0,
    minHeight: 28,
  },
  clear: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    marginRight: -space['2'],
  },
});
