// Tracks the iOS "Reduce Motion" setting. Signature motion (rolling digits, the success burst,
// collapsing rows) jump-cuts when it's on; state changes still happen, just without the travel.
//
// The setting is read once at startup and kept current app-wide, so a component that mounts
// mid-session (the success screen) knows the answer on its first render instead of animating
// a frame before an async check comes back.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((on) => (reduceMotion = on))
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => (reduceMotion = on));

export function useReducedMotion() {
  const [reduced, setReduced] = useState(reduceMotion);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
