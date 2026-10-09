// Dev-tool entry point: a small gear that opens the environment simulator as a native page sheet.
// Lives outside the checkout UI proper; reviewers use it to force platform / wallet states.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DevMenuSheet } from '../components/DevMenuSheet';
import { useDevSettings } from '../hooks/useEnvironment';
import { isOverridden } from '../lib/environment';
import { colors, touchTarget } from '../theme';

export function DevMenuButton() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const settings = useDevSettings();
  // A dot on the gear says "this isn't what the device really reports".
  const active = isOverridden(settings.overrides) || settings.forceExpressDecline;

  return (
    <>
      <Pressable
        testID="dev-menu-button"
        accessibilityRole="button"
        accessibilityLabel="Developer menu"
        onPress={() => setOpen(true)}
        style={styles.button}
      >
        <Text style={styles.glyph}>⚙︎</Text>
        {active ? <View testID="dev-menu-active" style={styles.dot} /> : null}
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <DevMenuSheet
          overrides={settings.overrides}
          detectedPlatform={settings.detected.platform}
          forceExpressDecline={settings.forceExpressDecline}
          showGallery={settings.showGallery}
          bottomInset={insets.bottom}
          onChange={settings.setOverrides}
          onForceExpressDeclineChange={settings.setForceExpressDecline}
          onShowGalleryChange={(on) => {
            // The screen under the sheet swaps out; close first so the sheet isn't torn down mid-gesture.
            setOpen(false);
            settings.setShowGallery(on);
          }}
          onReset={settings.reset}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 22, color: colors.textTertiary },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green500,
  },
});
