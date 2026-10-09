import { Ref, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, controlHeight, radii, spacing, type } from '../theme';

export type FieldState = 'empty' | 'invalid' | 'valid';

type FieldProps = Pick<
  TextInputProps,
  | 'placeholder'
  | 'keyboardType'
  | 'textContentType'
  | 'autoComplete'
  | 'onChangeText'
  | 'onBlur'
  | 'onFocus'
  | 'returnKeyType'
  | 'editable'
> & {
  testID: string;
  label: string;
  value?: string;
  state?: FieldState;
  error?: string;
  trailing?: string;
  inputRef?: Ref<TextInput>;
};

// Filled dark input with a micro label inside the field (STYLE_GUIDE 4.8).
export function CardField({
  testID,
  label,
  value = '',
  state = 'empty',
  error,
  trailing,
  inputRef,
  ...input
}: FieldProps) {
  return (
    <View testID={testID} style={styles.wrap}>
      <View style={[styles.field, state === 'invalid' && styles.fieldInvalid]}>
        <View style={styles.inputCol}>
          <Text style={styles.floatLabel}>{label}</Text>
          <TextInput
            ref={inputRef}
            testID={`${testID}-input`}
            accessibilityLabel={label}
            style={styles.input}
            value={value}
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            {...input}
          />
        </View>
        {trailing ? <Text style={[styles.trailing, state === 'valid' && styles.trailingValid]}>{trailing}</Text> : null}
      </View>
      {state === 'invalid' && error ? <FieldError testID={`${testID}-error`} message={error} /> : null}
    </View>
  );
}

// Errors drop in (fade + 4pt slide, 120 ms) rather than popping, so the form doesn't jolt.
function FieldError({ testID, message }: { testID: string; message: string }) {
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [shown]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] });
  return (
    <Animated.Text testID={testID} style={[styles.error, { opacity: shown, transform: [{ translateY }] }]}>
      {message}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: controlHeight,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface2,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldInvalid: { borderColor: colors.error },
  inputCol: { flex: 1, justifyContent: 'center' },
  floatLabel: { ...type.micro, color: colors.textTertiary },
  input: { ...type.body, color: colors.textPrimary, padding: 0, fontVariant: ['tabular-nums'] },
  trailing: { ...type.label, color: colors.textSecondary, marginLeft: spacing.sm },
  trailingValid: { color: colors.green400 },
  error: { ...type.meta, color: colors.error, marginTop: spacing.xs },
});
