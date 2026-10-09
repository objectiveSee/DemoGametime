import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';

export type PaymentMethodId = 'apple_pay' | 'google_pay' | 'affirm' | 'card';

type RowProps = {
  id: PaymentMethodId;
  title: string;
  subtitle?: string;
  badge: string;
  selected?: boolean;
  disabled?: boolean;
};

export function PaymentMethodRow({ id, title, subtitle, badge, selected = false, disabled = false }: RowProps) {
  return (
    <View
      testID={`payment-method-${id}`}
      style={[styles.row, selected && styles.rowSelected, disabled && styles.rowDisabled]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    </View>
  );
}

type ListProps = {
  selected?: PaymentMethodId;
  // Methods hidden by eligibility. Real gating logic lives elsewhere; this is visual only.
  hidden?: PaymentMethodId[];
  // Methods shown but not selectable, with their hint.
  disabled?: Partial<Record<PaymentMethodId, string>>;
};

const METHODS: { id: PaymentMethodId; title: string; subtitle?: string; badge: string }[] = [
  { id: 'apple_pay', title: 'Apple Pay', badge: '\uF8FF Pay' },
  { id: 'google_pay', title: 'Google Pay', badge: 'G Pay' },
  { id: 'affirm', title: 'Affirm', subtitle: 'Pay over time from $23/mo', badge: 'affirm' },
  { id: 'card', title: 'Credit or debit card', subtitle: 'Visa, Mastercard, Amex, Discover', badge: 'CARD' },
];

export function PaymentMethodList({ selected = 'apple_pay', hidden = [], disabled = {} }: ListProps) {
  return (
    <View testID="payment-method-list" style={styles.list}>
      {METHODS.filter((m) => !hidden.includes(m.id)).map((m) => (
        <PaymentMethodRow
          key={m.id}
          {...m}
          subtitle={disabled[m.id] ?? m.subtitle}
          selected={m.id === selected}
          disabled={m.id in disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface1,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rowSelected: { borderColor: colors.green500, borderWidth: 2 },
  rowDisabled: { opacity: 0.45 },
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
  badge: {
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: radii.control,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...type.label, color: colors.textPrimary },
});
