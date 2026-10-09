// Wallet capability checks. Stubs for what Expo Go can't reach: PassKit's
// PKPaymentAuthorizationController.canMakePayments(usingNetworks:) and Google Pay's
// PaymentsClient.isReadyToPay. They keep the real calls' shape (async, may answer false), so
// returning false here, or swapping in the SDK call, is all a real integration changes.
const CHECK_LATENCY_MS = 50;

const answer = (ready: boolean) =>
  new Promise<boolean>((resolve) => setTimeout(() => resolve(ready), CHECK_LATENCY_MS));

/** Stub for canMakePayments(usingNetworks:): a Wallet card is provisioned. */
export const checkApplePayCapability = (): Promise<boolean> => answer(true);

/** Stub for isReadyToPay: Google Pay is set up. */
export const checkGooglePaySetUp = (): Promise<boolean> => answer(true);

export type WalletCapability = { applePayCapable: boolean; googlePaySetUp: boolean };

/** Until the checks answer, no wallet is offered. Card and Affirm don't wait on them. */
export const WALLETS_PENDING: WalletCapability = { applePayCapable: false, googlePaySetUp: false };

/** Both checks: the platform override can swap in the other platform's wallet. A failed check is a no. */
export async function checkWallets(
  checks = { applePay: checkApplePayCapability, googlePay: checkGooglePaySetUp },
): Promise<WalletCapability> {
  const [applePayCapable, googlePaySetUp] = await Promise.all([
    checks.applePay().catch(() => false),
    checks.googlePay().catch(() => false),
  ]);
  return { applePayCapable, googlePaySetUp };
}
