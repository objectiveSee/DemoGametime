// The device facts eligibility depends on. Every eligibility input flows through useEnvironment(),
// so the dev-menu environment simulator overrides detection in one place.
//
// Dev settings live in memory only and reset on relaunch. Deliberate: a persisted override would
// leak into the kill-relaunch recovery demo and make a fresh launch lie about the device.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { applyOverrides, DEFAULT_OVERRIDES, type Environment, type EnvironmentOverrides } from '../lib/environment';
import { checkWallets, WALLETS_PENDING, type WalletCapability } from '../lib/walletCapability';

export type { Environment } from '../lib/environment';

const PLATFORM = Platform.OS === 'android' ? 'android' : 'ios';

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
const WalletsCheckedContext = createContext(false);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  // Real detection: the platform is known now; the wallet checks (lib/walletCapability) answer async.
  const [wallets, setWallets] = useState<WalletCapability | null>(null);
  useEffect(() => {
    let live = true;
    checkWallets().then((result) => {
      if (live) setWallets(result);
    });
    return () => {
      live = false;
    };
  }, []);
  const detected = useMemo<Environment>(() => ({ platform: PLATFORM, ...(wallets ?? WALLETS_PENDING) }), [wallets]);
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
      <EnvironmentContext.Provider value={environment}>
        <WalletsCheckedContext.Provider value={wallets !== null}>{children}</WalletsCheckedContext.Provider>
      </EnvironmentContext.Provider>
    </DevSettingsContext.Provider>
  );
}

/** Effective environment: real detection with any dev-menu overrides applied. */
export function useEnvironment(): Environment {
  const environment = useContext(EnvironmentContext);
  if (!environment) throw new Error('useEnvironment must be used inside <EnvironmentProvider>');
  return environment;
}

/** The wallet capability checks have answered. Until then no wallet is eligible. */
export const useWalletsChecked = () => useContext(WalletsCheckedContext);

export function useDevSettings(): DevSettings {
  const settings = useContext(DevSettingsContext);
  if (!settings) throw new Error('useDevSettings must be used inside <EnvironmentProvider>');
  return settings;
}
