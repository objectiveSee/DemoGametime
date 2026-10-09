import { act, create } from 'react-test-renderer';

import { useCardForm } from '../useCardForm';

function mountForm() {
  const ref: { current: ReturnType<typeof useCardForm> | null } = { current: null };
  function Probe() {
    ref.current = useCardForm();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return ref as { current: ReturnType<typeof useCardForm> };
}

describe('useCardForm: when errors show', () => {
  it('hides errors on fields the fan has not finished', () => {
    const form = mountForm();
    act(() => form.current.setField('cvc', '12'));
    expect(form.current.valid).toBe(false);
    expect(form.current.errorFor('cvc')).toBeUndefined();
  });

  it('shows a field error once that field is blurred', () => {
    const form = mountForm();
    act(() => form.current.setField('cvc', '12'));
    act(() => form.current.blur('cvc'));
    expect(form.current.errorFor('cvc')).toBe('Security code is incomplete.');
    expect(form.current.errorFor('number')).toBeUndefined();
  });

  // A refused Pay tap touches every field, so an autofilled or never-blurred form explains itself.
  it('touchAll surfaces every field error at once', () => {
    const form = mountForm();
    act(() => {
      form.current.setField('number', '4242424242424242');
      form.current.setField('expiry', '1230');
      form.current.setField('cvc', '12');
    });
    act(() => form.current.touchAll());
    expect(form.current.errorFor('number')).toBeUndefined();
    expect(form.current.errorFor('expiry')).toBeUndefined();
    expect(form.current.errorFor('cvc')).toBe('Security code is incomplete.');
  });

  it('reset clears values and touched state', () => {
    const form = mountForm();
    act(() => form.current.touchAll());
    act(() => form.current.reset());
    expect(form.current.values).toEqual({ number: '', expiry: '', cvc: '' });
    expect(form.current.errorFor('number')).toBeUndefined();
  });
});
