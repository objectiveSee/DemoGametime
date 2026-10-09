// A one-shot burst of a dozen brand-green chevrons (the logo's ▸) flying out from behind the
// success check. Restrained on purpose: one ring, ~1 s, no loop. Centered on its parent, which
// should be the check's own box; it draws nothing once played.
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

const COUNT = 12;
const DURATION_MS = 1000;
const TINTS = [colors.green500, colors.green400, colors.green700];

// Fixed, slightly irregular ring: even spacing reads as a spinner, a little jitter reads as joy.
const PARTICLES = Array.from({ length: COUNT }, (_, i) => {
  const angle = ((i * 360) / COUNT + (i % 2 ? 9 : -5)) * (Math.PI / 180);
  const distance = 58 + (i % 3) * 16;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    // The chevron is drawn pointing right (border corner rotated 45°); turn it to face its flight.
    rotate: `${(angle * 180) / Math.PI + 45}deg`,
    size: i % 2 ? 9 : 11,
    tint: TINTS[i % TINTS.length],
  };
});

export function ChevronBurst({ delayMs = 0 }: { delayMs?: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [done, setDone] = useState(false);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay: delayMs,
      duration: DURATION_MS,
      // Eased here, not in interpolate: the native driver doesn't support interpolation easing.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => finished && setDone(true));
    return () => animation.stop();
  }, [progress, delayMs]);

  if (done) return null;
  // `progress` is already eased out, so these breakpoints sit on the travel curve: a quick
  // flash in, then a long fade as the chevrons coast.
  const travel = progress;
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.8, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 1, 0.6] });

  return (
    <View pointerEvents="none" style={styles.origin}>
      {PARTICLES.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.chevron,
            {
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              borderColor: p.tint,
              opacity,
              transform: [
                { translateX: Animated.multiply(travel, p.dx) },
                { translateY: Animated.multiply(travel, p.dy) },
                { rotate: p.rotate },
                { scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', top: '50%', left: '50%' },
  chevron: { position: 'absolute', borderTopWidth: 3, borderRightWidth: 3, borderRadius: 1 },
});
