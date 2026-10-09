import { StyleSheet, Text, View } from 'react-native';
import { colors, controlHeight, radii, spacing } from '../theme';

// Card-path submit only. Express methods (Apple Pay, Google Pay, Affirm) are their own buttons.
type Props = {
  disabled?: boolean;
  label?: string;
};

export function PayButton({ disabled = false, label = 'Pay $135.90' }: Props) {
  return (
    <View
      testID={disabled ? 'pay-button-disabled' : 'pay-button'}
      style={[styles.base, disabled ? styles.disabled : styles.primary]}
    >
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
});
