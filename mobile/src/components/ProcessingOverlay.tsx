import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';
import { Spinner } from './Spinner';

const COPY = {
  processing: { message: 'Processing payment…', sub: "Don't close the app." },
  // Relaunched with a payment in flight: outcome unknown until the server answers.
  checking: { message: 'Checking your payment…', sub: 'Hang tight — confirming your order status.' },
};

// Fills its nearest positioned parent; dims whatever is underneath.
export function ProcessingOverlay({ variant = 'processing' }: { variant?: keyof typeof COPY }) {
  const { message, sub } = COPY[variant];
  return (
    <View testID={`processing-overlay-${variant}`} style={styles.backdrop}>
      <View style={styles.panel}>
        <Spinner />
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: colors.surface1,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    gap: spacing.md,
  },
  message: { ...type.body, fontWeight: '600', color: colors.textPrimary },
  sub: { ...type.meta, color: colors.textTertiary, textAlign: 'center' },
});
