// The device facts eligibility depends on. Every eligibility input flows through useEnvironment(),
// so the dev-menu environment simulator overrides detection in one place.
//
// Dev settings live in memory only and reset on relaunch. Deliberate: a persisted override would
// leak into the kill-relaunch recovery demo and make a fresh launch lie about the device.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import {
  applyOverrides,
  DEFAULT_OVERRIDES,
  type Environment,
  type EnvironmentOverrides,
} from '../lib/environment';

export type { Environment } from '../lib/environment';

/**
 * Real detection. Platform is real; wallet capability is a stub standing in for
 * PKPaymentAuthorizationController.canMakePayments(usingNetworks:) / Google Pay isReadyToPay,
 * which aren't reachable from Expo Go. Eligibility pairs each wallet with its platform.
 */
export function detectEnvironment(): Environment {
  return {
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    applePayCapable: true,
    googlePaySetUp: true,
  };
}

type DevSettings = {
  detected: Environment;
  overrides: EnvironmentOverrides;
  setOverrides: (patch: Partial<EnvironmentOverrides>) => void;
  /** Express authorizations hand back a declined token (same hook as long-pressing an express button). */
  forceExpressDecline: boolean;
  setForceExpressDecline: (on: boolean) => void;
  showGallery: boolean;
  setShowGallery: (on: boolean) => void;
  reset: () => void;
};

const DevSettingsContext = createContext<DevSettings | null>(null);
const EnvironmentContext = createContext<Environment | null>(null);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [detected] = useState(detectEnvironment);
  const [overrides, setOverridesState] = useState(DEFAULT_OVERRIDES);
  const [forceExpressDecline, setForceExpressDecline] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const environment = useMemo(() => applyOverrides(detected, overrides), [detected, overrides]);
  const settings = useMemo<DevSettings>(
    () => ({
      detected,
      overrides,
      setOverrides: (patch) => setOverridesState((prev) => ({ ...prev, ...patch })),
      forceExpressDecline,
      setForceExpressDecline,
      showGallery,
      setShowGallery,
      reset: () => {
        setOverridesState(DEFAULT_OVERRIDES);
        setForceExpressDecline(false);
        setShowGallery(false);
      },
    }),
    [detected, overrides, forceExpressDecline, showGallery],
  );

  return (
    <DevSettingsContext.Provider value={settings}>
      <EnvironmentContext.Provider value={environment}>{children}</EnvironmentContext.Provider>
    </DevSettingsContext.Provider>
  );
}

/** Effective environment: real detection with any dev-menu overrides applied. */
export function useEnvironment(): Environment {
  const environment = useContext(EnvironmentContext);
  if (!environment) throw new Error('useEnvironment must be used inside <EnvironmentProvider>');
  return environment;
}

export function useDevSettings(): DevSettings {
  const settings = useContext(DevSettingsContext);
  if (!settings) throw new Error('useDevSettings must be used inside <EnvironmentProvider>');
  return settings;
}
