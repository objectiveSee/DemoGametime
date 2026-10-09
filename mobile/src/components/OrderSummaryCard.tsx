import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';

type LineItem = { label: string; amount: string };

type Props = {
  title?: string;
  meta?: string;
  seats?: string;
  lines?: LineItem[];
  total?: string;
};

export function OrderSummaryCard({
  title = 'Golden State Warriors vs Los Angeles Lakers',
  meta = 'Sat 10/24 · 7:30 PM · Chase Center',
  seats = 'Sec 115 · Row 12 · 2 tickets',
  lines = [
    { label: 'Tickets (2 × $56.00)', amount: '$112.00' },
    { label: 'Service fee', amount: '$18.40' },
    { label: 'Delivery', amount: 'Free' },
    { label: 'Taxes', amount: '$5.50' },
  ],
  total = '$135.90',
}: Props) {
  return (
    <View testID="order-summary-card" style={styles.card}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {meta}
      </Text>
      <Text style={styles.seats}>{seats}</Text>
      <View style={styles.divider} />
      {lines.map((l) => (
        <View key={l.label} style={styles.row}>
          <Text style={styles.rowLabel}>{l.label}</Text>
          <Text style={styles.rowAmount}>{l.amount}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface1,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  title: { ...type.h3, color: colors.textPrimary },
  meta: { ...type.meta, color: colors.textSecondary, marginTop: spacing.xs },
  seats: { ...type.label, color: colors.green400, marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  rowLabel: { ...type.meta, fontSize: 15, color: colors.textSecondary },
  rowAmount: { ...type.meta, fontSize: 15, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  totalLabel: { ...type.h3, color: colors.textPrimary },
  totalAmount: { ...type.h3, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});
