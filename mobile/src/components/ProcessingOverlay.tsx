import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';

// Rendered inline in the gallery; real usage would be absolutely positioned over checkout.
export function ProcessingOverlay({ message = 'Processing payment…' }: { message?: string }) {
  return (
    <View testID="processing-overlay" style={styles.backdrop}>
      <View style={styles.panel}>
        <ActivityIndicator size="large" color={colors.green500} />
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.sub}>Don't close the app.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  panel: {
    backgroundColor: colors.surface1,
    borderRadius: radii.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  message: { ...type.body, fontWeight: '600', color: colors.textPrimary },
  sub: { ...type.meta, color: colors.textTertiary },
});
