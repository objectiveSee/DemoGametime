import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, controlHeight, radii, spacing } from '../theme';

// Card-path submit only. Express methods (Apple Pay, Google Pay, Affirm) are their own buttons.
type Props = {
  disabled?: boolean;
  label?: string;
  onPress?: () => void;
  testID?: string;
};

// Disabled is semantic, not just visual: Pressable drops presses and VoiceOver announces "dimmed".
export function PayButton({ disabled = false, label = 'Pay $135.90', onPress, testID }: Props) {
  return (
    <Pressable
      testID={testID ?? (disabled ? 'pay-button-disabled' : 'pay-button')}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, disabled ? styles.disabled : styles.primary, pressed && styles.pressed]}
    >
      <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
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
  pressed: { backgroundColor: colors.green700 },
  disabled: { backgroundColor: colors.surface2 },
  label: { fontSize: 17, fontWeight: '600', color: colors.textOnGreen },
  disabledLabel: { color: colors.textTertiary },
});
