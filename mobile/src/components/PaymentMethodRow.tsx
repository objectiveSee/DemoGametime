import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, controlHeight, radii, spacing, type } from '../theme';

export type ExpressMethodId = 'apple_pay' | 'google_pay' | 'affirm';

// Express methods are direct-action: tapping the button itself starts (and completes) payment.
// No radio, no separate Pay tap.
const EXPRESS: Record<ExpressMethodId, { label: string; caption?: string; fill: string }> = {
  apple_pay: { label: ' Pay', fill: colors.black },
  google_pay: { label: 'G Pay', fill: colors.black },
  affirm: { label: 'Pay over time with affirm', caption: 'From $23/mo · Subject to eligibility', fill: colors.affirm },
};

type ExpressProps = {
  method: ExpressMethodId;
  disabledHint?: string;
  onPress?: (method: ExpressMethodId) => void;
  /** Hidden test hook: run the same express flow with a declined authorization. */
  onLongPress?: (method: ExpressMethodId) => void;
};

export function ExpressPayButton({ method, disabledHint, onPress, onLongPress }: ExpressProps) {
  const { label, caption, fill } = EXPRESS[method];
  const disabled = !!disabledHint;
  return (
    <View testID={`express-${method}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onPress?.(method)}
        onLongPress={onLongPress && (() => onLongPress(method))}
        style={({ pressed }) => [
          styles.express,
          { backgroundColor: fill },
          method === 'affirm' && { borderColor: fill },
          disabled && styles.dimmed,
          pressed && styles.pressed,
        ]}
      >
        <Text style={method === 'affirm' ? styles.affirmLabel : styles.walletLabel}>{label}</Text>
      </Pressable>
      {(disabledHint ?? caption) ? (
        <Text style={[styles.caption, disabled && styles.captionDisabled]}>{disabledHint ?? caption}</Text>
      ) : null}
    </View>
  );
}

type CardRowProps = { expanded?: boolean; children?: ReactNode; onPress?: () => void };

// The card path is the only selectable row; selecting it expands the form + Pay button.
export function CardMethodRow({ expanded = false, children, onPress }: CardRowProps) {
  return (
    <View testID="payment-method-card" style={[styles.cardRow, expanded && styles.cardRowExpanded]}>
      <Pressable
        testID="payment-method-card-header"
        accessibilityRole="radio"
        accessibilityState={{ selected: expanded, expanded }}
        onPress={onPress}
        style={styles.cardHeader}
      >
        <View style={[styles.radio, expanded && styles.radioSelected]}>
          {expanded && <View style={styles.radioDot} />}
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Credit or debit card</Text>
          <Text style={styles.subtitle}>Visa, Mastercard, Amex, Discover</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      {expanded && children ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

type ListProps = {
  // Express methods that passed eligibility. Gating logic lives elsewhere; this is visual only.
  express?: ExpressMethodId[];
  // Express methods shown but not usable, with the reason.
  disabled?: Partial<Record<ExpressMethodId, string>>;
  cardExpanded?: boolean;
  cardForm?: ReactNode;
  onExpressPress?: (method: ExpressMethodId) => void;
  onExpressLongPress?: (method: ExpressMethodId) => void;
  onCardPress?: () => void;
};

export function PaymentMethodList({
  express = [],
  disabled = {},
  cardExpanded = false,
  cardForm,
  onExpressPress,
  onExpressLongPress,
  onCardPress,
}: ListProps) {
  return (
    <View testID="payment-method-list" style={styles.list}>
      {express.map((m) => (
        <ExpressPayButton
          key={m}
          method={m}
          disabledHint={disabled[m]}
          onPress={onExpressPress}
          onLongPress={onExpressLongPress}
        />
      ))}
      {express.length > 0 && (
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or pay with card</Text>
          <View style={styles.orLine} />
        </View>
      )}
      <CardMethodRow expanded={cardExpanded} onPress={onCardPress}>
        {cardForm}
      </CardMethodRow>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  express: {
    height: controlHeight,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  walletLabel: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
  affirmLabel: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  caption: { ...type.meta, color: colors.textTertiary, marginTop: spacing.xs, textAlign: 'center' },
  captionDisabled: { color: colors.textSecondary },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  orLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  orText: { ...type.meta, color: colors.textTertiary },
  cardRow: {
    backgroundColor: colors.surface1,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  cardRowExpanded: { borderColor: colors.green500 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  cardBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.green500 },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.green500 },
  text: { flex: 1 },
  title: { ...type.body, fontWeight: '600', color: colors.textPrimary },
  subtitle: { ...type.meta, color: colors.textTertiary, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textSecondary },
});
