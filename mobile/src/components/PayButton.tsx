import { useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';

import { usePressScale } from '../hooks/usePressScale';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { haptics } from '../lib/haptics';
import { colors, controlHeight, radii, spacing } from '../theme';
import { RollingText } from './RollingText';

// Card-path submit only. Express methods (Apple Pay, Google Pay, Affirm) are their own buttons.
type Props = {
  disabled?: boolean;
  label?: string;
  onPress?: () => void;
  testID?: string;
};

// Disabled is semantic, not just visual: VoiceOver announces "dimmed" and onPress never fires.
// The press itself still lands, though, so a tap on a not-ready Pay button answers with a small
// head-shake and a rigid nudge (the iOS "not yet") instead of dead glass.
export function PayButton({ disabled = false, label = 'Pay $135.90', onPress, testID }: Props) {
  const reduced = useReducedMotion();
  const press = usePressScale(!disabled);
  const [shake] = useState(() => new Animated.Value(0));

  const refuse = () => {
    haptics.nudge();
    if (reduced) return;
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 320, easing: Easing.linear, useNativeDriver: true }).start();
  };
  const translateX = shake.interpolate({
    inputRange: [0, 0.15, 0.35, 0.55, 0.75, 1],
    outputRange: [0, -6, 5, -3, 2, 0],
  });

  return (
    <Animated.View style={{ transform: [{ translateX }, { scale: press.scale }] }}>
      <Pressable
        testID={testID ?? (disabled ? 'pay-button-disabled' : 'pay-button')}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        onPress={disabled ? refuse : onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          styles.base,
          disabled ? styles.disabled : styles.primary,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <RollingText value={label} style={[styles.label, disabled && styles.disabledLabel]} />
      </Pressable>
    </Animated.View>
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
  label: { fontSize: 17, fontWeight: '600', color: colors.textOnGreen, fontVariant: ['tabular-nums'] },
  disabledLabel: { color: colors.textTertiary },
});
