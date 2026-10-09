// The device facts eligibility depends on. Every eligibility input flows through useEnvironment(),
// so the dev-menu environment simulator can override detection in one place.
import { useMemo } from 'react';
import { Platform } from 'react-native';

import type { EligibilityInput } from '../lib/eligibility';

export type Environment = Omit<EligibilityInput, 'totalCents'>;

/**
 * Real detection. Platform is real; wallet capability is a stub standing in for
 * PKPaymentAuthorizationController.canMakePayments(usingNetworks:) / Google Pay isReadyToPay,
 * which aren't reachable from Expo Go.
 */
export function detectEnvironment(): Environment {
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  return {
    platform,
    applePayCapable: platform === 'ios',
    googlePaySetUp: platform === 'android',
  };
}

export function useEnvironment(): Environment {
  return useMemo(() => detectEnvironment(), []);
}
