import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { haptics } from '../lib/haptics';
import { colors, radii, spacing, type } from '../theme';
import { PayButton } from './PayButton';

type Props =
  { variant: 'success'; confirmationCode?: string } | { variant: 'declined'; reason?: string; onRetry?: () => void };

export function ResultView(props: Props) {
  const success = props.variant === 'success';
  useEffect(() => {
    if (success) haptics.success();
  }, [success]);
  return (
    <View testID={`result-${props.variant}`} style={styles.card}>
      <View style={[styles.icon, success ? styles.iconSuccess : styles.iconDeclined]}>
        <Text style={[styles.iconGlyph, success && styles.iconGlyphSuccess]}>{success ? '✓' : '!'}</Text>
      </View>
      {props.variant === 'success' ? (
        <>
          <Text style={styles.title}>You're going.</Text>
          <Text style={styles.body}>Your tickets are confirmed and on their way to your email.</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Confirmation</Text>
            <Text testID="confirmation-code" style={styles.code}>
              {props.confirmationCode ?? 'GT-7K4QX2'}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>Payment declined.</Text>
          <Text style={styles.body}>{props.reason ?? 'Your bank declined this card.'} You have not been charged.</Text>
          <View style={styles.retry}>
            <PayButton testID="retry-button" label="Try Again" onPress={props.onRetry} />
          </View>
        </>
      )}
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
  icon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
