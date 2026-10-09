// Stub wallet sheet (Apple Pay / Google Pay). Mimics the real interaction shape: slides up over
// checkout, shows what's being paid, runs a fake biometric confirmation, then authorizes on its
// own — the express tap stays the only interaction. The fan can still back out (✕, scrim tap or
// swipe-down via the Modal) any time before authorization fires; after that the charge is in
// flight and the sheet is gone.
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ExpressMethod } from '../lib/expressAuth';
import { colors, radii, spacing, touchTarget, type } from '../theme';

// How long the fake biometric moment lingers. Long enough to read (and for a cancel to land —
// real wallets wait on the user here), short enough to keep express feeling express.
const PROMPT_MS = 2600;
const TICK_MS = 700;

const COPY: Record<'apple_pay' | 'google_pay', { mark: string; prompt: string; done: string }> = {
  apple_pay: { mark: ' Pay', prompt: 'Confirm with Face ID', done: 'Done' },
  google_pay: { mark: 'G Pay', prompt: "Verify it's you", done: 'Verified' },
};

type Props = {
  method: Extract<ExpressMethod, 'apple_pay' | 'google_pay'>;
  eventTitle: string;
  quantity: number;
  totalLabel: string;
  onCancel: () => void;
  /** Fires exactly once, after the fake biometric completes. Unmounting beforehand cancels it. */
  onAuthorized: () => void;
};

export function ExpressSheet({ method, eventTitle, quantity, totalLabel, onCancel, onAuthorized }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'prompt' | 'confirmed'>('prompt');
  const { mark, prompt, done } = COPY[method];

  // Prompt pulses while "waiting for the biometric"; the tick springs in once it "succeeds".
  const [pulse] = useState(() => new Animated.Value(1));
  const [tickScale] = useState(() => new Animated.Value(0.2));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const confirm = setTimeout(() => {
      setPhase('confirmed');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(tickScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }, PROMPT_MS);
    const authorize = setTimeout(onAuthorized, PROMPT_MS + TICK_MS);
    // Unmount (cancel, or checkout moving on) kills both timers: no authorization after a cancel.
    return () => {
      clearTimeout(confirm);
      clearTimeout(authorize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run the authorization clock once per sheet
  }, []);

  return (
    <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          testID="express-sheet-scrim"
          accessibilityLabel="Cancel payment"
          style={styles.scrim}
          onPress={onCancel}
        />
        <View testID={`express-sheet-${method}`} style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.mark}>{mark}</Text>
            <Pressable
              testID="express-sheet-cancel"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}
              onPress={onCancel}
              style={styles.close}
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.rows}>
            <SheetRow label="Tickets" value={`${eventTitle} × ${quantity}`} />
            <SheetRow label="Pay" value="Gametime Demo" />
            <View style={styles.divider} />
            <SheetRow label="Pay Total" value={totalLabel} bold />
          </View>

          <View style={styles.biometric}>
            {phase === 'prompt' ? (
              <Animated.View style={[styles.biometricInner, { opacity: pulse }]}>
                <View style={styles.faceFrame}>
                  <View style={styles.faceEyes}>
                    <View style={styles.faceDot} />
                    <View style={styles.faceDot} />
                  </View>
                  <View style={styles.faceMouth} />
                </View>
                <Text style={styles.biometricLabel}>{prompt}</Text>
              </Animated.View>
            ) : (
              <View style={styles.biometricInner}>
                <Animated.View style={[styles.tick, { transform: [{ scale: tickScale }] }]}>
                  <Text style={styles.tickGlyph}>✓</Text>
                </Animated.View>
                <Text style={styles.biometricLabel}>{done}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SheetRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mark: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  close: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  closeGlyph: { fontSize: 18, color: colors.textSecondary },
  rows: { marginTop: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.lg },
  rowLabel: { ...type.meta, color: colors.textTertiary },
  rowValue: { ...type.body, color: colors.textSecondary, flexShrink: 1 },
  rowValueBold: { ...type.h3, color: colors.textPrimary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginVertical: spacing.xs },
  biometric: { alignItems: 'center', paddingVertical: spacing.xl, minHeight: 132, justifyContent: 'center' },
  biometricInner: { alignItems: 'center', gap: spacing.md },
  faceFrame: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceEyes: { flexDirection: 'row', gap: 12, marginBottom: 7 },
  faceDot: { width: 4, height: 9, borderRadius: 2, backgroundColor: colors.textPrimary },
  faceMouth: {
    width: 20,
    height: 9,
    borderBottomWidth: 2.5,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderColor: colors.textPrimary,
  },
  tick: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickGlyph: { fontSize: 26, fontWeight: '800', color: colors.textOnGreen },
  biometricLabel: { ...type.body, fontWeight: '600', color: colors.textPrimary },
});
