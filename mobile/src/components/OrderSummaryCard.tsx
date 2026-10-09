import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, radii, spacing, type } from '../theme';
import { RollingText } from './RollingText';

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
      {/* Keyed by position: a repriced line is the same row with new numbers, so it settles in place. */}
      {lines.map((l, i) => (
        <View key={i} style={styles.row}>
          <Settle value={l.label} style={styles.rowLabel} />
          <Settle value={l.amount} style={styles.rowAmount} />
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <RollingText value={total} style={styles.totalAmount} />
      </View>
    </View>
  );
}

// Supporting numbers don't roll — only the total does. They dip and settle back in so a reprice
// reads as one choreographed beat rather than a flicker.
function Settle({ value, style }: { value: string; style: StyleProp<TextStyle> }) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (reduced) return;
    opacity.setValue(0.15);
    Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [value, reduced, opacity]);
  return <Animated.Text style={[style, { opacity }]}>{value}</Animated.Text>;
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
