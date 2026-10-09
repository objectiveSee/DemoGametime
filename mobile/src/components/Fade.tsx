// Fades a full-screen layer (the processing overlays) in and out instead of cutting. Children stay
// mounted through the fade-out and unmount after it; the layer stops taking touches as it leaves.
import { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';

export function Fade({ visible, children }: { visible: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(visible);
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  if (reduced && settled !== visible) {
    opacity.setValue(visible ? 1 : 0);
    setSettled(visible);
  }

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 160 : 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => finished && setSettled(visible));
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate on visibility changes only
  }, [visible]);

  if (!visible && !settled) return null;
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { opacity }]}>
      {children}
    </Animated.View>
  );
}
