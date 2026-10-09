// Environment simulator: real device detection merged with dev-menu overrides. Pure so the merge
// rules are spec'd; the provider in hooks/useEnvironment owns the state.
//
// Overrides only change ELIGIBILITY inputs. Networking (paymentsApi's API_BASE_URL) stays real:
// forcing "Android" on the iOS simulator still talks to localhost the iOS way.
import type { EligibilityInput } from './eligibility';

export type Environment = Omit<EligibilityInput, 'totalCents'>;

export type PlatformOverride = 'auto' | 'ios' | 'android';

export type EnvironmentOverrides = {
  platform: PlatformOverride;
  /** Apple Wallet has no provisioned cards (canMakePayments(usingNetworks:) → false). */
  noProvisionedCards: boolean;
  /** Google Pay isReadyToPay → false. Only visible when the platform is Android. */
  googlePayNotSetUp: boolean;
};

/** Defaults are real detection: nothing overridden. */
export const DEFAULT_OVERRIDES: EnvironmentOverrides = {
  platform: 'auto',
  noProvisionedCards: false,
  googlePayNotSetUp: false,
};

export function applyOverrides(detected: Environment, overrides: EnvironmentOverrides): Environment {
  return {
    platform: overrides.platform === 'auto' ? detected.platform : overrides.platform,
    applePayCapable: detected.applePayCapable && !overrides.noProvisionedCards,
    googlePaySetUp: detected.googlePaySetUp && !overrides.googlePayNotSetUp,
  };
}

export const isOverridden = (overrides: EnvironmentOverrides) =>
  (Object.keys(DEFAULT_OVERRIDES) as (keyof EnvironmentOverrides)[]).some(
    (key) => overrides[key] !== DEFAULT_OVERRIDES[key],
  );
