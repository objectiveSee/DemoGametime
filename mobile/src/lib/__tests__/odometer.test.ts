import { planRoll, ROLL_MS, STAGGER_MS } from '../odometer';

const pairs = (plan: NonNullable<ReturnType<typeof planRoll>>) => plan.columns.map((c) => `${c.from}>${c.to}`);

describe('planRoll', () => {
  it('lines digits up from the right so cents roll over cents', () => {
    const plan = planRoll('$135.90', '$69.20')!;
    expect(plan.prefix).toBe('$');
    expect(pairs(plan)).toEqual(['1>', '3>6', '5>9', '.>.', '9>2', '0>0']);
  });

  it('grows a new leading column when the value gains a digit', () => {
    expect(pairs(planRoll('$69.20', '$135.90')!)).toEqual(['>1', '6>3', '9>5', '.>.', '2>9', '0>0']);
  });

  it('keeps a shared text prefix still', () => {
    const plan = planRoll('Pay $135.90', 'Pay $202.60')!;
    expect(plan.prefix).toBe('Pay $');
    expect(pairs(plan)).toEqual(['1>2', '3>0', '5>2', '.>.', '9>6', '0>0']);
  });

  it('keeps thousands separators in their columns', () => {
    expect(pairs(planRoll('$999.00', '$1,000.00')!)).toEqual(['>1', '>,', '9>0', '9>0', '9>0', '.>.', '0>0', '0>0']);
  });

  it('rolls up for a bigger value and down for a smaller one', () => {
    expect(planRoll('$69.20', '$135.90')!.direction).toBe(1);
    expect(planRoll('$135.90', '$69.20')!.direction).toBe(-1);
    expect(planRoll('$1,000.00', '$999.00')!.direction).toBe(-1);
  });

  it('staggers only the changed columns, rightmost first', () => {
    const plan = planRoll('$135.90', '$202.60')!;
    // columns: 1>2 3>0 5>2 .>. 9>6 0>0
    expect(plan.delays).toEqual([3 * STAGGER_MS, 2 * STAGGER_MS, STAGGER_MS, 0, 0, 0]);
    expect(plan.durationMs).toBe(ROLL_MS + 3 * STAGGER_MS);
  });

  it('declines to roll an unchanged value or a different kind of label', () => {
    expect(planRoll('$135.90', '$135.90')).toBeNull();
    expect(planRoll('Updating total…', 'Pay $69.20')).toBeNull();
    expect(planRoll('Pay $69.20', '$69.20')).toBeNull();
    expect(planRoll('Free', '$5.00')).toBeNull();
  });
});
