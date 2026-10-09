// The app's whole haptic vocabulary, by meaning rather than by engine call, so every screen speaks
// the same language:
//   tick      a value stepped (quantity +/-)
//   tap       something opened, closed or was acknowledged (card row, wallet sheet, Face ID done)
//   nudge     a press that can't do anything yet (disabled Pay)
//   success   the purchase landed (fires with the check's spring pop)
//   warning   the payment was declined (a handled outcome, not a crash, so not "error")
// iOS only: the Taptic Engine is what these patterns are tuned for. Android's vibration motor
// turns them into buzzes, and Android polish is deferred with the rest of Android; web has none.
// Fire-and-forget: a haptic must never throw into, or wait up, the interaction it decorates.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = () => Platform.OS === 'ios';

const fire = (play: () => Promise<void>) => {
  if (!enabled()) return;
  play().catch(() => {});
};

export const haptics = {
  tick: () => fire(() => Haptics.selectionAsync()),
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  nudge: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
