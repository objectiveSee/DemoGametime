import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { EnvironmentOverrides, PlatformOverride } from '../lib/environment';
import { DEFAULT_OVERRIDES } from '../lib/environment';
import { colors, radii, spacing, touchTarget, type } from '../theme';

type Props = {
  overrides?: EnvironmentOverrides;
  /** Real detected platform, shown next to "Auto". */
  detectedPlatform?: 'ios' | 'android';
  forceExpressDecline?: boolean;
  showGallery?: boolean;
  bottomInset?: number;
  onChange?: (patch: Partial<EnvironmentOverrides>) => void;
  onForceExpressDeclineChange?: (on: boolean) => void;
  onShowGalleryChange?: (on: boolean) => void;
  onReset?: () => void;
  onClose?: () => void;
};

const PLATFORM_LABEL: Record<PlatformOverride, string> = { auto: 'Auto', ios: 'iOS', android: 'Android' };

// Environment simulator: forces platform / wallet state so eligibility can be reviewed on one device.
export function DevMenuSheet({
  overrides = DEFAULT_OVERRIDES,
  detectedPlatform = 'ios',
  forceExpressDecline = false,
  showGallery = false,
  bottomInset = 0,
  onChange,
  onForceExpressDeclineChange,
  onShowGalleryChange,
  onReset,
  onClose,
}: Props) {
  const { platform, noProvisionedCards, googlePayNotSetUp } = overrides;
  return (
    <ScrollView
      testID="dev-menu-sheet"
      style={styles.sheet}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xxl }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Environment Simulator</Text>
        {onClose ? (
          <Pressable testID="dev-menu-close" accessibilityRole="button" onPress={onClose} style={styles.done}>
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.sub}>Overrides real detection for payment eligibility. Resets on relaunch.</Text>

      <Text style={styles.section}>Platform</Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {(['auto', 'ios', 'android'] as const).map((p) => {
          const selected = p === platform;
          return (
            <Pressable
              key={p}
              testID={`dev-platform-${p}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange?.({ platform: p })}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                {PLATFORM_LABEL[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Auto = detected ({PLATFORM_LABEL[detectedPlatform]})</Text>

      <Toggle
        testID="dev-no-provisioned-cards"
        title="No provisioned cards"
        sub="Apple Wallet has no cards; hides Apple Pay."
        value={noProvisionedCards}
        onValueChange={(on) => onChange?.({ noProvisionedCards: on })}
      />
      <Toggle
        testID="dev-google-pay-not-set-up"
        title="Google Pay not set up"
        sub="Hides Google Pay when the platform is Android."
        value={googlePayNotSetUp}
        onValueChange={(on) => onChange?.({ googlePayNotSetUp: on })}
      />

      <Text style={styles.section}>Testing</Text>
      <Toggle
        testID="dev-force-express-decline"
        title="Force express decline"
        sub="Apple Pay / Google Pay / Affirm authorizations come back declined."
        value={forceExpressDecline}
        onValueChange={onForceExpressDeclineChange}
      />
      <Toggle
        testID="dev-show-gallery"
        title="Show component gallery"
        sub="Every component variant, static props."
        value={showGallery}
        onValueChange={onShowGalleryChange}
      />

      <Pressable testID="dev-menu-reset" accessibilityRole="button" onPress={onReset} style={styles.reset}>
        <Text style={styles.resetLabel}>Reset to Defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

type ToggleProps = {
  testID: string;
  title: string;
  sub: string;
  value: boolean;
  onValueChange?: (on: boolean) => void;
};

function Toggle({ testID, title, sub, value, onValueChange }: ToggleProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.green500, false: colors.surface3 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Presented in a native page sheet, which supplies its own rounded corners and grabber.
  sheet: { backgroundColor: colors.surface1 },
  content: { padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.h3, color: colors.textPrimary },
  done: { minHeight: touchTarget, minWidth: touchTarget, alignItems: 'flex-end', justifyContent: 'center' },
  doneLabel: { ...type.label, fontSize: 17, color: colors.green500 },
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
  hint: { ...type.meta, color: colors.textTertiary, marginTop: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, gap: spacing.md },
  toggleText: { flex: 1 },
  toggleTitle: { ...type.body, fontWeight: '600', color: colors.textPrimary },
  toggleSub: { ...type.meta, color: colors.textTertiary, marginTop: 2 },
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
