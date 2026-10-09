import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from '../lib/haptics';
import { colors, radii, spacing, touchTarget, type } from '../theme';

type Props = {
  quantity?: number;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  onChange?: (quantity: number) => void;
};

export function QuantityStepper({ quantity = 2, min = 1, max = 8, label = 'Tickets', disabled, onChange }: Props) {
  // The buttons disable at the clamps, so every press that lands is a real step: tick on each.
  const step = (next: number) => {
    haptics.tick();
    onChange?.(next);
  };
  return (
    <View testID="quantity-stepper" style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <StepButton
          glyph="−"
          label="Fewer tickets"
          disabled={disabled || quantity <= min}
          onPress={() => step(quantity - 1)}
          testID="quantity-decrement"
        />
        <Text testID="quantity-value" style={styles.value}>
          {quantity}
        </Text>
        <StepButton
          glyph="+"
          label="More tickets"
          disabled={disabled || quantity >= max}
          onPress={() => step(quantity + 1)}
          testID="quantity-increment"
        />
      </View>
    </View>
  );
}

type StepProps = { glyph: string; label: string; disabled: boolean; onPress: () => void; testID: string };

function StepButton({ glyph, label, disabled, onPress, testID }: StepProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
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
  pressed: { backgroundColor: colors.surface3 },
  glyph: { fontSize: 22, fontWeight: '500', color: colors.textPrimary },
  value: { ...type.h3, color: colors.textPrimary, minWidth: 24, textAlign: 'center' },
});
