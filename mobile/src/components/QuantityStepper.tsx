import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTarget, type } from '../theme';

type Props = { quantity?: number; min?: number; max?: number; label?: string };

export function QuantityStepper({ quantity = 2, min = 1, max = 8, label = 'Tickets' }: Props) {
  return (
    <View testID="quantity-stepper" style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <StepButton glyph="−" disabled={quantity <= min} testID="quantity-decrement" />
        <Text style={styles.value}>{quantity}</Text>
        <StepButton glyph="+" disabled={quantity >= max} testID="quantity-increment" />
      </View>
    </View>
  );
}

function StepButton({ glyph, disabled, testID }: { glyph: string; disabled: boolean; testID: string }) {
  return (
    <View testID={testID} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.glyph}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...type.body, fontWeight: '600', color: colors.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.control,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  glyph: { fontSize: 22, fontWeight: '500', color: colors.textPrimary },
  value: { ...type.h3, color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
});
