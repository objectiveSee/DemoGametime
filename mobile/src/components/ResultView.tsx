import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { haptics } from '../lib/haptics';
import { colors, radii, spacing, type } from '../theme';
import { ChevronBurst } from './ChevronBurst';
import { PayButton } from './PayButton';

// Success choreography (ms after the result appears). The beat waits for the processing overlay
// to clear, then: the check springs in with the success haptic, chevrons burst from behind it,
// and the copy and confirmation code rise into place.
const POP_AT = 140;
const TEXT_AT = 260;
const TEXT_STAGGER = 90;

type Props =
  { variant: 'success'; confirmationCode?: string } | { variant: 'declined'; reason?: string; onRetry?: () => void };

export function ResultView(props: Props) {
  if (props.variant === 'success') return <Success confirmationCode={props.confirmationCode} />;
  return (
    <View testID="result-declined" style={styles.card}>
      <View style={[styles.iconWrap, styles.icon, styles.iconDeclined]}>
        <Text style={styles.iconGlyph}>!</Text>
      </View>
      <Text style={styles.title}>Payment declined.</Text>
      <Text style={styles.body}>{props.reason ?? 'Your bank declined this card.'} You have not been charged.</Text>
      <View style={styles.retry}>
        <PayButton testID="retry-button" label="Try Again" onPress={props.onRetry} />
      </View>
    </View>
  );
}

function Success({ confirmationCode }: { confirmationCode?: string }) {
  const reduced = useReducedMotion();
  // One value per element; each starts at its final state when motion is reduced.
  const [pop] = useState(() => new Animated.Value(reduced ? 1 : 0));
  const [rise] = useState(() => [0, 1, 2].map(() => new Animated.Value(reduced ? 1 : 0)));

  useEffect(() => {
    if (reduced) {
      haptics.success();
      return;
    }
    const popTimer = setTimeout(haptics.success, POP_AT);
    const animation = Animated.parallel([
      Animated.spring(pop, { toValue: 1, delay: POP_AT, friction: 7, tension: 190, useNativeDriver: true }),
      Animated.stagger(
        TEXT_STAGGER,
        rise.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            delay: TEXT_AT,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]);
    animation.start();
    return () => {
      clearTimeout(popTimer);
      animation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on arrival
  }, []);

  // The circle overshoots past full size and settles; the tick lands a beat behind it.
  const glyph = {
    opacity: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 0.4, 1] }) }],
  };
  // Rising copy never starts fully transparent: iOS drops alpha-0 views from the accessibility
  // tree, so VoiceOver (and UI tests) would find "You're going." but not the code beneath it.
  const riseStyle = (v: Animated.Value, distance: number) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  return (
    <View testID="result-success" style={styles.card}>
      <View style={styles.iconWrap}>
        {reduced ? null : <ChevronBurst delayMs={POP_AT} />}
        <Animated.View style={[styles.icon, styles.iconSuccess, { transform: [{ scale: pop }] }]}>
          <Animated.Text style={[styles.iconGlyph, styles.iconGlyphSuccess, glyph]}>✓</Animated.Text>
        </Animated.View>
      </View>
      <Animated.Text style={[styles.title, riseStyle(rise[0], 8)]}>You're going.</Animated.Text>
      <Animated.Text style={[styles.body, riseStyle(rise[1], 8)]}>
        Your tickets are confirmed and on their way to your email.
      </Animated.Text>
      <Animated.View style={[styles.codeBox, riseStyle(rise[2], 12)]}>
        <Text style={styles.codeLabel}>Confirmation</Text>
        <Text testID="confirmation-code" style={styles.code}>
          {confirmationCode ?? 'GT-7K4QX2'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconWrap: { width: 56, height: 56, marginBottom: spacing.lg },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSuccess: { backgroundColor: colors.green500 },
  iconDeclined: { backgroundColor: colors.error },
  iconGlyph: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  iconGlyphSuccess: { color: colors.textOnGreen },
  title: { ...type.h2, color: colors.textPrimary, textAlign: 'center' },
  body: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  codeBox: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radii.control,
    paddingVertical: spacing.md,
  },
  codeLabel: { ...type.micro, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 22, fontWeight: '700', color: colors.green400, letterSpacing: 2, marginTop: spacing.xs },
  retry: { alignSelf: 'stretch', marginTop: spacing.xl },
});
