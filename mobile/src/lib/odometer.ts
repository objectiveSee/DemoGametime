// Pure layout + timing for the rolling (odometer) money display. The component in
// components/RollingText.tsx only animates what this decides.
//
// "Pay $135.90" -> "Pay $69.20": the shared label ("Pay $") stays put, the numeric part is
// lined up from the right (so cents sit over cents) and each column that differs rolls from
// its old character to its new one. A column with no old character grows in; one with no
// new character shrinks away.

export type RollColumn = { from: string; to: string };
export type RollPlan = {
  prefix: string;
  columns: RollColumn[];
  /** +1: the value went up, digits roll upward (new ones enter from below). -1: the reverse. */
  direction: 1 | -1;
  /** Start delay (ms) per column; changed columns are staggered right to left, like a carry. */
  delays: number[];
  /** When the last column lands. */
  durationMs: number;
};

export const ROLL_MS = 320;
export const STAGGER_MS = 35;

const SHAPE = /^(.*?)(\d[\d,]*(?:\.\d+)?)$/;

/** Whether a label has the "text then money" shape that can roll at all. */
export const isRollable = (label: string) => SHAPE.test(label);

const numeric = (digits: string) => Number(digits.replace(/,/g, ''));

/**
 * How to roll `from` into `to`, or null when it shouldn't roll (unchanged, or not the same kind of
 * label: "Updating total…" -> "Pay $69.20" is a swap, not a count).
 */
export function planRoll(from: string, to: string): RollPlan | null {
  if (from === to) return null;
  const a = from.match(SHAPE);
  const b = to.match(SHAPE);
  if (!a || !b || a[1] !== b[1]) return null;

  const [oldDigits, newDigits] = [a[2], b[2]];
  const width = Math.max(oldDigits.length, newDigits.length);
  const pad = (s: string) => Array<string>(width - s.length).fill('').concat(s.split(''));
  const olds = pad(oldDigits);
  const news = pad(newDigits);
  const columns = news.map((to, i) => ({ from: olds[i], to }));

  const delays = columns.map(() => 0);
  let rank = 0;
  for (let i = columns.length - 1; i >= 0; i--) {
    if (columns[i].from !== columns[i].to) delays[i] = STAGGER_MS * rank++;
  }

  return {
    prefix: b[1],
    columns,
    direction: numeric(newDigits) >= numeric(oldDigits) ? 1 : -1,
    delays,
    durationMs: ROLL_MS + STAGGER_MS * Math.max(rank - 1, 0),
  };
}
