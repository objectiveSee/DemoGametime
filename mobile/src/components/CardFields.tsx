import { Ref } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
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
      {state === 'invalid' && error ? (
        <Text testID={`${testID}-error`} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function CardNumberInput({ state = 'empty' }: { state?: FieldState }) {
  const value = { empty: '', invalid: '4242 4242 4242 4241', valid: '4242 4242 4242 4242' }[state];
  return (
    <CardField
      testID={`card-number-${state}`}
      label="Card number"
      placeholder="1234 1234 1234 1234"
      value={value}
      state={state}
      error="That card number doesn't look right."
      trailing={state === 'valid' ? 'VISA ✓' : state === 'invalid' ? 'VISA' : undefined}
      keyboardType="number-pad"
      textContentType="creditCardNumber"
      autoComplete="cc-number"
    />
  );
}

export function ExpiryInput({ state = 'empty' }: { state?: FieldState }) {
  const value = { empty: '', invalid: '04/24', valid: '08/28' }[state];
  return (
    <CardField
      testID={`card-expiry-${state}`}
      label="Expiry"
      placeholder="MM/YY"
      value={value}
      state={state}
      error="Card has expired."
      trailing={state === 'valid' ? '✓' : undefined}
      keyboardType="number-pad"
      autoComplete="cc-exp"
    />
  );
}

export function CvvInput({ state = 'empty' }: { state?: FieldState }) {
  const value = { empty: '', invalid: '12', valid: '123' }[state];
  return (
    <CardField
      testID={`card-cvv-${state}`}
      label="CVC"
      placeholder="123"
      value={value}
      state={state}
      error="Too short."
      trailing={state === 'valid' ? '✓' : undefined}
      keyboardType="number-pad"
      autoComplete="cc-csc"
    />
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
