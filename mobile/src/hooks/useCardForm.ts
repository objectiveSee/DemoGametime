// Card form state. Formatting runs on every change (typing, paste and autofill all arrive as a
// whole-field value); error messages appear once a field is blurred or a submit was attempted,
// and from then on track every keystroke so a fixed field clears immediately.
import { useMemo, useState } from 'react';

import {
  detectBrand,
  formatCardNumber,
  formatCvc,
  formatExpiry,
  validateCardForm,
  type CardForm,
} from '../lib/cardValidation';

type Field = keyof CardForm;

const EMPTY: CardForm = { number: '', expiry: '', cvc: '' };
const NONE: Record<Field, boolean> = { number: false, expiry: false, cvc: false };

export function useCardForm() {
  const [values, setValues] = useState<CardForm>(EMPTY);
  const [touched, setTouched] = useState(NONE);

  const brand = detectBrand(values.number);
  const result = useMemo(() => validateCardForm(values), [values]);

  const setField = (field: Field, raw: string) =>
    setValues((prev) => {
      if (field === 'number') {
        const number = formatCardNumber(raw);
        // A brand change (e.g. Visa -> Amex) changes the CVC length; re-trim it.
        return { ...prev, number, cvc: formatCvc(prev.cvc, detectBrand(number)) };
      }
      if (field === 'expiry') return { ...prev, expiry: formatExpiry(raw) };
      return { ...prev, cvc: formatCvc(raw, detectBrand(prev.number)) };
    });

  const blur = (field: Field) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  const touchAll = () => setTouched({ number: true, expiry: true, cvc: true });

  /** The error to show for a field, if any — only once the fan has had a chance to finish it. */
  const errorFor = (field: Field) => (touched[field] ? result.errors[field] : undefined);
  const isFieldValid = (field: Field) => !result.errors[field];

  return { values, brand, valid: result.valid, setField, blur, touchAll, errorFor, isFieldValid };
}
