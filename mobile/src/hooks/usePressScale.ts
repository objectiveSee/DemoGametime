// The press-down give on primary CTAs: the button sinks to 98% under the finger and springs back.
import { useState } from 'react';
import { Animated } from 'react-native';

export function usePressScale(enabled = true) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (toValue: number) => () => {
    if (!enabled) return;
    Animated.spring(scale, { toValue, speed: 40, bounciness: toValue === 1 ? 6 : 0, useNativeDriver: true }).start();
  };
  return { scale, onPressIn: to(0.98), onPressOut: to(1) };
}
