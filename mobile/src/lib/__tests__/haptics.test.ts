import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { haptics } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

const setOS = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

afterEach(() => {
  setOS(originalOS);
  jest.clearAllMocks();
});

describe('haptics', () => {
  it('maps each meaning to one engine call on iOS', () => {
    setOS('ios');
    haptics.tick();
    haptics.tap();
    haptics.nudge();
    haptics.success();
    haptics.warning();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, 'light');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'rigid');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'warning');
  });

  it.each(['android', 'web'] as const)('is a silent no-op on %s', (os) => {
    setOS(os);
    Object.values(haptics).forEach((play) => play());
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('swallows engine failures instead of throwing into the interaction', async () => {
    setOS('ios');
    (Haptics.impactAsync as jest.Mock).mockReturnValueOnce(Promise.reject(new Error('no engine')));
    expect(() => haptics.tap()).not.toThrow();
    await Promise.resolve(); // let the rejection settle; an unhandled one would fail the test run
  });
});
