import { eligibleMethods } from '../eligibility';
import { applyOverrides, DEFAULT_OVERRIDES, type Environment } from '../environment';
import { checkApplePayCapability, checkGooglePaySetUp, checkWallets, WALLETS_PENDING } from '../walletCapability';

const methods = (env: Environment, totalCents: number) => eligibleMethods({ ...env, totalCents });

describe('wallet capability stubs', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('answer asynchronously, like canMakePayments / isReadyToPay', async () => {
    let answered = false;
    const check = checkApplePayCapability().then((ready) => {
      answered = true;
      return ready;
    });
    await Promise.resolve();
    expect(answered).toBe(false);
    await jest.runAllTimersAsync();
    await expect(check).resolves.toBe(true);
    const google = checkGooglePaySetUp();
    await jest.runAllTimersAsync();
    await expect(google).resolves.toBe(true);
  });

  it('checkWallets reports both wallets', async () => {
    const wallets = checkWallets();
    await jest.runAllTimersAsync();
    await expect(wallets).resolves.toEqual({ applePayCapable: true, googlePaySetUp: true });
  });
});

describe('checkWallets', () => {
  it('passes a "no" through', async () => {
    const wallets = await checkWallets({ applePay: async () => false, googlePay: async () => true });
    expect(wallets).toEqual({ applePayCapable: false, googlePaySetUp: true });
  });

  it('treats a failed check as a no', async () => {
    const wallets = await checkWallets({
      applePay: () => Promise.reject(new Error('PassKit unavailable')),
      googlePay: async () => true,
    });
    expect(wallets).toEqual({ applePayCapable: false, googlePaySetUp: true });
  });
});

describe('detection merged with overrides', () => {
  const pendingIos: Environment = { platform: 'ios', ...WALLETS_PENDING };

  it('while the checks are pending, card and Affirm show and no wallet does', () => {
    expect(methods(applyOverrides(pendingIos, DEFAULT_OVERRIDES), 13590)).toEqual(['affirm', 'card']);
  });

  it('a pending check offers no wallet even under a platform override', () => {
    const env = applyOverrides(pendingIos, { ...DEFAULT_OVERRIDES, platform: 'android' });
    expect(methods(env, 5000)).toEqual(['card']);
  });

  it('a device that answers "no" offers no wallet', () => {
    const noWallet: Environment = { platform: 'ios', applePayCapable: false, googlePaySetUp: true };
    expect(methods(applyOverrides(noWallet, DEFAULT_OVERRIDES), 5000)).toEqual(['card']);
  });

  it('once the checks answer yes, the platform wallet appears', () => {
    const ready: Environment = { platform: 'ios', applePayCapable: true, googlePaySetUp: true };
    expect(methods(applyOverrides(ready, DEFAULT_OVERRIDES), 13590)).toEqual(['apple_pay', 'affirm', 'card']);
  });
});
