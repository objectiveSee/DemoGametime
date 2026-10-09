import { eligibleMethods } from '../eligibility';
import { applyOverrides, DEFAULT_OVERRIDES, isOverridden, type Environment } from '../environment';

const iosDevice: Environment = { platform: 'ios', applePayCapable: true, googlePaySetUp: true };
const androidDevice: Environment = { platform: 'android', applePayCapable: true, googlePaySetUp: true };

const methods = (env: Environment, totalCents = 5000) => eligibleMethods({ ...env, totalCents });

describe('applyOverrides', () => {
  it('defaults pass real detection through untouched', () => {
    expect(applyOverrides(iosDevice, DEFAULT_OVERRIDES)).toEqual(iosDevice);
    expect(applyOverrides(androidDevice, DEFAULT_OVERRIDES)).toEqual(androidDevice);
  });

  it('forcing Android on an iOS device offers Google Pay instead of Apple Pay', () => {
    const env = applyOverrides(iosDevice, { ...DEFAULT_OVERRIDES, platform: 'android' });
    expect(env.platform).toBe('android');
    expect(methods(env)).toEqual(['google_pay', 'card']);
  });

  it('forcing iOS on an Android device offers Apple Pay', () => {
    const env = applyOverrides(androidDevice, { ...DEFAULT_OVERRIDES, platform: 'ios' });
    expect(methods(env)).toEqual(['apple_pay', 'card']);
  });

  it('no provisioned cards hides Apple Pay but leaves Affirm and card', () => {
    const env = applyOverrides(iosDevice, { ...DEFAULT_OVERRIDES, noProvisionedCards: true });
    expect(env.applePayCapable).toBe(false);
    expect(methods(env, 13590)).toEqual(['affirm', 'card']);
  });

  it('Google Pay not set up hides Google Pay on Android', () => {
    const env = applyOverrides(iosDevice, { ...DEFAULT_OVERRIDES, platform: 'android', googlePayNotSetUp: true });
    expect(methods(env)).toEqual(['card']);
  });

  it('each wallet toggle only affects its own wallet', () => {
    expect(methods(applyOverrides(iosDevice, { ...DEFAULT_OVERRIDES, googlePayNotSetUp: true }))).toEqual([
      'apple_pay',
      'card',
    ]);
    expect(
      methods(applyOverrides(iosDevice, { ...DEFAULT_OVERRIDES, platform: 'android', noProvisionedCards: true })),
    ).toEqual(['google_pay', 'card']);
  });

  it('an override never grants a capability detection said is missing', () => {
    const noWallet: Environment = { platform: 'ios', applePayCapable: false, googlePaySetUp: false };
    expect(applyOverrides(noWallet, DEFAULT_OVERRIDES)).toEqual(noWallet);
    expect(methods(applyOverrides(noWallet, { ...DEFAULT_OVERRIDES, platform: 'android' }))).toEqual(['card']);
  });
});

describe('isOverridden', () => {
  it('is false only for the defaults', () => {
    expect(isOverridden(DEFAULT_OVERRIDES)).toBe(false);
    expect(isOverridden({ ...DEFAULT_OVERRIDES, platform: 'ios' })).toBe(true);
    expect(isOverridden({ ...DEFAULT_OVERRIDES, noProvisionedCards: true })).toBe(true);
    expect(isOverridden({ ...DEFAULT_OVERRIDES, googlePayNotSetUp: true })).toBe(true);
  });
});
