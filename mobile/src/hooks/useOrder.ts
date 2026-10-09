// Fetches the priced order for a quantity. Keeps the last good order on screen while a new
// quantity loads, and ignores responses for requests the fan has already moved past.
import { useCallback, useEffect, useState } from 'react';
import { LayoutAnimation } from 'react-native';

import { getOrder, type Order } from '../lib/paymentsApi';

type Settled = { request: string; order?: Order; error?: string };

export function useOrder(quantity: number) {
  const [order, setOrder] = useState<Order | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);
  const request = `${quantity}#${attempt}`;

  useEffect(() => {
    let stale = false;
    getOrder(quantity)
      .then((next) => {
        if (stale) return;
        // Animate the re-layout a new total causes (e.g. Affirm appearing or leaving) instead of jumping.
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOrder(next);
        setSettled({ request, order: next });
      })
      .catch(() => {
        if (!stale) setSettled({ request, error: "We couldn't load your order." });
      });
    return () => {
      stale = true;
    };
  }, [quantity, request]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const loading = settled?.request !== request;
  const error = loading ? null : (settled?.error ?? null);
  // Only an order priced for the current quantity is safe to pay for.
  const current = !loading && settled?.order ? settled.order : null;
  return { order, current, loading, error, retry };
}
