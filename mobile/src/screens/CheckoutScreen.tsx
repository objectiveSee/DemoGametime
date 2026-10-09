import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardField } from '../components/CardFields';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import { PayButton } from '../components/PayButton';
import { PaymentMethodList, type ExpressMethodId } from '../components/PaymentMethodRow';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { QuantityStepper } from '../components/QuantityStepper';
import { ResultView } from '../components/ResultView';
import { useCardForm } from '../hooks/useCardForm';
import { useCheckout } from '../hooks/useCheckout';
import { useEnvironment } from '../hooks/useEnvironment';
import { useOrder } from '../hooks/useOrder';
import { cvcLength, isCardNumberComplete, validateCardNumber, type CardBrand } from '../lib/cardValidation';
import { eligibleMethods, isExpressMethod } from '../lib/eligibility';
import { formatCents, summarizeOrder } from '../lib/orderDisplay';
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
  const environment = useEnvironment();
  const card = useCardForm();
  const checkout = useCheckout();
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

  const { state, busy } = checkout;
  const canPay = card.valid && current !== null && !busy;
  const pay = () => {
    if (!current || !canPay) return;
    Keyboard.dismiss();
    checkout.payWithCard(current, card.values);
  };

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

  let body;
  if (state.status === 'succeeded' || state.status === 'declined') {
    body = (
      <ScrollView contentContainerStyle={[styles.resultContent, { paddingBottom: insets.bottom + spacing.xl }]}>
        {state.status === 'succeeded' ? (
          <ResultView variant="success" confirmationCode={state.receipt.confirmationCode} />
        ) : (
          <ResultView variant="declined" reason={state.failure.message} onRetry={checkout.retry} />
        )}
      </ScrollView>
    );
  } else if (!order) {
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
          onCardPress={() => !busy && setCardExpanded((open) => !open)}
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
                label={current ? `Pay ${formatCents(current.pricing.totalCents)}` : 'Updating total…'}
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
      </View>
      {body}
      {state.status === 'processing' || state.status === 'validating' ? <ProcessingOverlay /> : null}
      {state.status === 'checking' ? <ProcessingOverlay variant="checking" /> : null}
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgBase,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  title: { ...type.h1, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  resultContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  stepper: { paddingHorizontal: spacing.xs },
  sectionTitle: { ...type.h3, color: colors.textPrimary, marginTop: spacing.sm },
  notice: { ...type.meta, color: colors.textSecondary },
  inline: { flexDirection: 'row', gap: spacing.md },
  orderError: { alignSelf: 'stretch', gap: spacing.md },
  orderErrorText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
