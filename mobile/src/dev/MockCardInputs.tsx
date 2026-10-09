// Display-only card fields pinned to demo values, one per FieldState. The gallery's only; the real
// form drives CardField directly.
import { CardField, type FieldState } from '../components/CardFields';

export function CardNumberInput({ state = 'empty' }: { state?: FieldState }) {
  const value = { empty: '', invalid: '4242 4242 4242 4241', valid: '4242 4242 4242 4242' }[state];
  return (
    <CardField
      testID={`card-number-${state}`}
      label="Card number"
      placeholder="1234 1234 1234 1234"
      value={value}
      state={state}
      error="That card number doesn't look right."
      trailing={state === 'valid' ? 'VISA ✓' : state === 'invalid' ? 'VISA' : undefined}
      keyboardType="number-pad"
      textContentType="creditCardNumber"
      autoComplete="cc-number"
    />
  );
}

export function ExpiryInput({ state = 'empty' }: { state?: FieldState }) {
  const value = { empty: '', invalid: '04/24', valid: '08/28' }[state];
  return (
    <CardField
      testID={`card-expiry-${state}`}
      label="Expiry"
      placeholder="MM/YY"
      value={value}
      state={state}
      error="Card has expired."
      trailing={state === 'valid' ? '✓' : undefined}
      keyboardType="number-pad"
      autoComplete="cc-exp"
    />
  );
}

export function CvvInput({ state = 'empty' }: { state?: FieldState }) {
  const value = { empty: '', invalid: '12', valid: '123' }[state];
  return (
    <CardField
      testID={`card-cvv-${state}`}
      label="CVC"
      placeholder="123"
      value={value}
      state={state}
      error="Too short."
      trailing={state === 'valid' ? '✓' : undefined}
      keyboardType="number-pad"
      autoComplete="cc-csc"
    />
  );
}
