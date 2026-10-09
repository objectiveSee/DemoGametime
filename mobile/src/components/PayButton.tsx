import { StyleSheet, Text, View } from 'react-native';
import { colors, controlHeight, radii, spacing } from '../theme';

type Props = {
  variant?: 'primary' | 'applePay' | 'disabled';
  label?: string;
};

export function PayButton({ variant = 'primary', label = 'Pay $135.90' }: Props) {
  if (variant === 'applePay') {
    return (
      <View testID="pay-button-apple-pay" style={[styles.base, styles.applePay]}>
        <Text style={styles.applePayLabel}>{'\uF8FF Pay'}</Text>
      </View>
    );
  }
  const disabled = variant === 'disabled';
  return (
    <View testID={`pay-button-${variant}`} style={[styles.base, disabled ? styles.disabled : styles.primary]}>
      <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: controlHeight,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primary: { backgroundColor: colors.green500 },
  disabled: { backgroundColor: colors.surface2 },
  label: { fontSize: 17, fontWeight: '600', color: colors.textOnGreen },
  disabledLabel: { color: colors.textTertiary },
  applePay: { backgroundColor: colors.black, borderWidth: 1, borderColor: colors.borderStrong },
  applePayLabel: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
});
