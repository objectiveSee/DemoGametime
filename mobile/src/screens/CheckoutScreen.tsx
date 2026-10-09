import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardField } from '../components/CardFields';
import { ExpressSheet } from '../components/ExpressSheet';
import { Fade } from '../components/Fade';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import { PayButton } from '../components/PayButton';
import { PaymentMethodList, type ExpressMethodId } from '../components/PaymentMethodRow';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { QuantityStepper } from '../components/QuantityStepper';
import { ResultView } from '../components/ResultView';
import { DevMenuButton } from '../dev/DevMenu';
import { useCardForm } from '../hooks/useCardForm';
import { useCheckout } from '../hooks/useCheckout';
import { useDevSettings, useEnvironment } from '../hooks/useEnvironment';
import { useOrder } from '../hooks/useOrder';
import { cvcLength, isCardNumberComplete, validateCardNumber, type CardBrand } from '../lib/cardValidation';
import { eligibleMethods, isExpressMethod } from '../lib/eligibility';
import { affirmCheckoutUrl, expressAuthToken, parseAffirmReturn } from '../lib/expressAuth';
import { haptics } from '../lib/haptics';
import { formatCents, summarizeOrder } from '../lib/orderDisplay';
import { API_BASE_URL, type Order } from '../lib/paymentsApi';
import { colors, spacing, type } from '../theme';

const DEFAULT_QUANTITY = 2;

const BRAND_LABEL: Record<CardBrand, string | undefined> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISC',
  unknown: undefined,
};

export function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
  const { order, current, error, retry: retryOrder } = useOrder(quantity);
  const liveEnvironment = useEnvironment();
  const { forceExpressDecline } = useDevSettings();
  const card = useCardForm();
  const checkout = useCheckout();
  const { state, busy } = checkout;

  // Dev-menu environment changes apply live, but never mid-attempt: while a payment is busy the
  // methods stay as they were, and the new environment lands on the next idle render.
  const [environment, setEnvironment] = useState(liveEnvironment);
  if (!busy && environment !== liveEnvironment) setEnvironment(liveEnvironment);
  const [cardExpanded, setCardExpanded] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const expiryRef = useRef<TextInput>(null);
  const cvcRef = useRef<TextInput>(null);

  const express = useMemo(
    () =>
      order
        ? (eligibleMethods({ ...environment, totalCents: order.pricing.totalCents }).filter(
            isExpressMethod,
          ) as ExpressMethodId[])
        : [],
    [environment, order],
  );

  // Keep the Pay button above the keyboard while the card form is being filled.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (cardExpanded) scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, [cardExpanded]);

  const canPay = card.valid && current !== null && !busy;

  // While a new quantity is being priced the Pay button is disabled either way. A local reprice
  // lands in a frame or two, so it keeps showing the last amount and then rolls to the new one;
  // only a slow one admits to "Updating total…".
  const repricing = order !== null && current === null && !error;
  const [slowReprice, setSlowReprice] = useState(false);
  useEffect(() => {
    if (!repricing) return;
    const timer = setTimeout(() => setSlowReprice(true), 300);
    return () => {
      clearTimeout(timer);
      setSlowReprice(false);
    };
  }, [repricing]);
  const shownTotal = current ?? (repricing && !slowReprice ? order : null);
  const pay = () => {
    if (!current || !canPay) return;
    Keyboard.dismiss();
    checkout.payWithCard(current, card.values);
  };

  // Whether the in-progress express authorization should come back declined (long-press test hook,
  // or "Force express decline" in the dev menu).
  const simulateDecline = useRef(false);

  // The Affirm stub is redirect-shaped: a real browser opens over the app (which loses focus, like
  // a real Affirm handoff), and the hosted page deep-links back with a token or a cancel. The
  // ephemeral session skips iOS's sign-in consent alert; the await spans the whole round trip,
  // including any backgrounding while the browser is up.
  const startAffirm = async (order: Order, declined: boolean) => {
    checkout.startExpress('affirm');
    const returnUrl = Linking.createURL('affirm');
    const url = affirmCheckoutUrl({
      baseUrl: API_BASE_URL,
      returnUrl,
      amountCents: order.pricing.totalCents,
      orderId: order.id,
      simulateDecline: declined,
    });
    let result: WebBrowser.WebBrowserAuthSessionResult;
    try {
      result = await WebBrowser.openAuthSessionAsync(url, returnUrl, { preferEphemeralSession: true });
    } catch {
      checkout.cancelExpress();
      return;
    }
    const outcome = result.type === 'success' ? parseAffirmReturn(result.url) : { kind: 'cancelled' as const };
    if (outcome.kind === 'approved') checkout.completeExpress(order, 'affirm', outcome.token);
    else checkout.cancelExpress();
  };

  const onExpressPress = (method: ExpressMethodId, declined = false) => {
    if (!current || busy) return;
    Keyboard.dismiss();
    simulateDecline.current = declined || forceExpressDecline;
    if (method === 'affirm') startAffirm(current, simulateDecline.current);
    else checkout.startExpress(method); // the wallet sheet below takes it from here
  };

  // The wallet sheet drives apple_pay / google_pay authorization; affirm authorizes in the browser.
  const walletSheet =
    state.status === 'authorizing' && (state.method === 'apple_pay' || state.method === 'google_pay') && current
      ? { method: state.method, order: current }
      : null;

  // Decline haptic, once per settled decline. (Success plays its own, in time with the check.)
  useEffect(() => {
    if (state.status === 'declined') haptics.warning();
  }, [state.status]);

  const onNumberChange = (raw: string) => {
    card.setField('number', raw);
    // Advance only past a good number; a bad one keeps focus so the fan can fix it.
    if (isCardNumberComplete(raw) && validateCardNumber(raw).valid) expiryRef.current?.focus();
  };
  const onExpiryChange = (raw: string) => {
    card.setField('expiry', raw);
    if (raw.replace(/\D/g, '').length === 4) cvcRef.current?.focus();
  };

  const fieldState = (field: 'number' | 'expiry' | 'cvc') =>
    card.errorFor(field) ? 'invalid' : card.values[field] && card.isFieldValid(field) ? 'valid' : 'empty';

  // The result is a layer over the form rather than a replacement, so Try Again lands the fan
  // back exactly where they were: same scroll position, same card details.
  const showingResult = state.status === 'succeeded' || state.status === 'declined';
  const result = showingResult ? (
    <ScrollView
      style={styles.resultLayer}
      contentContainerStyle={[styles.resultContent, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      {state.status === 'succeeded' ? (
        <ResultView variant="success" confirmationCode={state.receipt.confirmationCode} />
      ) : (
        <ResultView variant="declined" reason={state.failure.message} onRetry={checkout.retry} />
      )}
    </ScrollView>
  ) : null;

  let body;
  if (!order) {
    body = (
      <View style={[styles.centered, { paddingBottom: insets.bottom }]}>
        {error ? (
          <OrderError message={error} onRetry={retryOrder} />
        ) : (
          <ActivityIndicator testID="order-loading" size="large" color={colors.green500} />
        )}
      </View>
    );
  } else {
    const summary = summarizeOrder(order);
    body = (
      <ScrollView
        ref={scrollRef}
        testID="checkout-scroll"
        accessibilityElementsHidden={showingResult}
        importantForAccessibility={showingResult ? 'no-hide-descendants' : 'auto'}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <OrderSummaryCard {...summary} />
        <View style={styles.stepper}>
          <QuantityStepper quantity={quantity} onChange={setQuantity} disabled={busy} />
        </View>
        {error ? <OrderError message={error} onRetry={retryOrder} /> : null}

        <Text style={styles.sectionTitle}>Payment</Text>
        {checkout.notice ? (
          <Text testID="checkout-notice" style={styles.notice}>
            {checkout.notice}
          </Text>
        ) : null}
        <PaymentMethodList
          express={express}
          cardExpanded={cardExpanded}
          onExpressPress={onExpressPress}
          onExpressLongPress={(method) => onExpressPress(method, true)}
          onCardPress={() => {
            if (busy) return;
            haptics.tap();
            setCardExpanded((open) => !open);
          }}
          cardForm={
            <>
              <CardField
                testID="card-number"
                label="Card number"
                placeholder="1234 1234 1234 1234"
                value={card.values.number}
                state={fieldState('number')}
                error={card.errorFor('number')}
                trailing={
                  BRAND_LABEL[card.brand] && `${BRAND_LABEL[card.brand]}${card.isFieldValid('number') ? ' ✓' : ''}`
                }
                onChangeText={onNumberChange}
                onBlur={() => card.blur('number')}
                editable={!busy}
                keyboardType="number-pad"
                textContentType="creditCardNumber"
                autoComplete="cc-number"
              />
              <View style={styles.inline}>
                <CardField
                  testID="card-expiry"
                  inputRef={expiryRef}
                  label="Expiry"
                  placeholder="MM/YY"
                  value={card.values.expiry}
                  state={fieldState('expiry')}
                  error={card.errorFor('expiry')}
                  trailing={fieldState('expiry') === 'valid' ? '✓' : undefined}
                  onChangeText={onExpiryChange}
                  onBlur={() => card.blur('expiry')}
                  editable={!busy}
                  keyboardType="number-pad"
                  textContentType="creditCardExpiration"
                  autoComplete="cc-exp"
                />
                <CardField
                  testID="card-cvc"
                  inputRef={cvcRef}
                  label="CVC"
                  placeholder={cvcLength(card.brand) === 4 ? '1234' : '123'}
                  value={card.values.cvc}
                  state={fieldState('cvc')}
                  error={card.errorFor('cvc')}
                  trailing={fieldState('cvc') === 'valid' ? '✓' : undefined}
                  onChangeText={(raw) => card.setField('cvc', raw)}
                  onBlur={() => card.blur('cvc')}
                  editable={!busy}
                  keyboardType="number-pad"
                  textContentType="creditCardSecurityCode"
                  autoComplete="cc-csc"
                />
              </View>
              <PayButton
                testID="pay-button"
                label={shownTotal ? `Pay ${formatCents(shownTotal.pricing.totalCents)}` : 'Updating total…'}
                disabled={!canPay}
                onPress={pay}
              />
            </>
          }
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Checkout</Text>
        <DevMenuButton />
      </View>
      <View style={styles.body}>
        {body}
        {result}
      </View>
      <Fade visible={state.status === 'processing' || state.status === 'validating'}>
        <ProcessingOverlay />
      </Fade>
      <Fade visible={state.status === 'checking'}>
        <ProcessingOverlay variant="checking" />
      </Fade>
      {walletSheet ? (
        <ExpressSheet
          method={walletSheet.method}
          eventTitle={walletSheet.order.event.title}
          quantity={walletSheet.order.quantity}
          totalLabel={formatCents(walletSheet.order.pricing.totalCents)}
          onCancel={checkout.cancelExpress}
          onAuthorized={() =>
            checkout.completeExpress(
              walletSheet.order,
              walletSheet.method,
              expressAuthToken(walletSheet.method, { declined: simulateDecline.current }),
            )
          }
        />
      ) : null}
    </View>
  );
}

function OrderError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View testID="order-error" style={styles.orderError}>
      <Text style={styles.orderErrorText}>{message} Check your connection and try again.</Text>
      <PayButton testID="order-retry" label="Retry" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgBase,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  title: { ...type.h1, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  body: { flex: 1 },
  resultLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bgBase },
  resultContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  stepper: { paddingHorizontal: spacing.xs },
  sectionTitle: { ...type.h3, color: colors.textPrimary, marginTop: spacing.sm },
  notice: { ...type.meta, color: colors.textSecondary },
  inline: { flexDirection: 'row', gap: spacing.md },
  orderError: { alignSelf: 'stretch', gap: spacing.md },
  orderErrorText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
