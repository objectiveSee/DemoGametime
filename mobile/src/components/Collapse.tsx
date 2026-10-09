// Shows/hides its children by animating height + opacity, so whatever sits below glides instead
// of jumping (Affirm appearing when the total crosses $100, the card form opening). Children stay
// mounted through the exit and unmount when it finishes — hidden means gone from the tree, which
// is what VoiceOver and Maestro should see. Not tappable while leaving.
//
// Spacing that should collapse with the item belongs inside it (padding), not as a parent `gap`,
// or the gap would snap shut at the end.
import { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = { visible: boolean; children: ReactNode; durationMs?: number };

export function Collapse({ visible, children, durationMs = 300 }: Props) {
  const reduced = useReducedMotion();
  // The visibility the last animation landed on. While it lags `visible`, we're mid-transition.
  const [settled, setSettled] = useState(visible);
  const [height, setHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  if (reduced && settled !== visible) {
    progress.setValue(visible ? 1 : 0);
    setSettled(visible);
  }
  const animating = settled !== visible;
  const rendered = visible || settled;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: durationMs,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false, // height can't run on the native driver
    });
    animation.start(({ finished }) => finished && setSettled(visible));
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate on visibility changes only
  }, [visible]);

  if (!rendered) return null;
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={
        animating
          ? {
              overflow: 'hidden',
              height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
              // Never fully transparent: iOS drops alpha-0 views from the accessibility tree.
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }),
            }
          : undefined
      }
    >
      <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>
  );
}
