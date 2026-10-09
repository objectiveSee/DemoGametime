import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTarget, type } from '../theme';

type Props = {
  platform?: 'auto' | 'ios' | 'android';
  noProvisionedCards?: boolean;
};

// Environment simulator mock: forces platform / wallet state so eligibility can be reviewed on one device.
export function DevMenuSheet({ platform = 'ios', noProvisionedCards = true }: Props) {
  return (
    <View testID="dev-menu-sheet" style={styles.sheet}>
      <View style={styles.grabber} />
      <Text style={styles.title}>Environment Simulator</Text>
      <Text style={styles.sub}>Overrides real detection. Defaults to Auto.</Text>

      <Text style={styles.section}>Platform</Text>
      <View style={styles.segments}>
        {(['auto', 'ios', 'android'] as const).map((p) => (
          <View key={p} style={[styles.segment, p === platform && styles.segmentSelected]}>
            <Text style={[styles.segmentLabel, p === platform && styles.segmentLabelSelected]}>
              {{ auto: 'Auto', ios: 'iOS', android: 'Android' }[p]}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>No provisioned cards</Text>
          <Text style={styles.toggleSub}>Wallet has no cards; hides Apple Pay / Google Pay.</Text>
        </View>
        <View style={[styles.switch, noProvisionedCards && styles.switchOn]}>
          <View style={[styles.knob, noProvisionedCards && styles.knobOn]} />
        </View>
      </View>

      <View testID="dev-menu-reset" style={styles.reset}>
        <Text style={styles.resetLabel}>Reset to Defaults</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    marginBottom: spacing.lg,
  },
  title: { ...type.h3, color: colors.textPrimary },
  sub: { ...type.meta, color: colors.textTertiary, marginTop: spacing.xs },
  section: { ...type.label, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    height: touchTarget,
    borderRadius: radii.control,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.green500 },
  segmentLabel: { ...type.label, color: colors.textPrimary },
  segmentLabelSelected: { color: colors.textOnGreen },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: spacing.md },
  toggleText: { flex: 1 },
  toggleTitle: { ...type.body, fontWeight: '600', color: colors.textPrimary },
  toggleSub: { ...type.meta, color: colors.textTertiary, marginTop: 2 },
  switch: {
    width: 51,
    height: 31,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.green500 },
  knob: { width: 27, height: 27, borderRadius: radii.pill, backgroundColor: colors.textPrimary },
  knobOn: { alignSelf: 'flex-end' },
  reset: {
    marginTop: spacing.xl,
    height: touchTarget,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLabel: { ...type.label, fontSize: 15, color: colors.textPrimary },
});
