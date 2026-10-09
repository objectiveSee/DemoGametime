// A money label that rolls like an odometer when its value changes: each digit that differs slides
// out and the new one slides in behind it, staggered right to left; unchanged digits hold still.
//
// The real label is always rendered as one ordinary Text — it sizes the layout and is what
// VoiceOver and Maestro read ("$135.90", never "1", "3", ...). While a roll plays, that Text
// goes transparent and a per-column overlay draws the motion on top of it; when the last
// column lands the overlay unmounts and the plain Text shows again, in exactly the same place.
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { isRollable, planRoll, ROLL_MS, type RollColumn, type RollPlan } from '../lib/odometer';

type Props = { value: string; style?: StyleProp<TextStyle>; testID?: string };

const EASE = Easing.out(Easing.cubic);

// One eased 0→1 value per column (interpolate `easing` isn't supported on the native driver, so
// the easing lives on each column's own timing). Transforms run natively; grow/shrink widths
// can't, so those columns get a JS-driven twin.
type Roll = { plan: RollPlan; motion: Animated.Value[]; width: Animated.Value[] };

export function RollingText({ value, style, testID }: Props) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const [digitWidth, setDigitWidth] = useState(0);
  // Rolls start from the last money-shaped value, so a one-frame "Updating total…" in between
  // doesn't break the count.
  const [lastRollable, setLastRollable] = useState(value);
  const [roll, setRoll] = useState<Roll | null>(null);

  // Decided during render, not in an effect: the frame that first shows the new value must
  // already be the roll's first frame, or the final number flashes before the motion starts.
  if (isRollable(value) && value !== lastRollable) {
    const plan = planRoll(lastRollable, value);
    setLastRollable(value);
    setRoll(
      plan && !reduced && height && digitWidth
        ? // Fresh values per roll, so a new roll never inherits a finished one's position.
          {
            plan,
            motion: plan.columns.map(() => new Animated.Value(0)),
            width: plan.columns.map(() => new Animated.Value(0)),
          }
        : null,
    );
  }

  useEffect(() => {
    if (!roll) return;
    const { plan, motion, width } = roll;
    const timing = (v: Animated.Value, delay: number, useNativeDriver: boolean) =>
      Animated.timing(v, { toValue: 1, delay, duration: ROLL_MS, easing: EASE, useNativeDriver });
    const animation = Animated.parallel(
      plan.columns.flatMap(({ from, to }, i) =>
        from === to
          ? []
          : [timing(motion[i], plan.delays[i], true), ...(from && to ? [] : [timing(width[i], plan.delays[i], false)])],
      ),
    );
    animation.start(({ finished }) => finished && setRoll(null));
    return () => animation.stop();
  }, [roll]);

  return (
    <View testID={testID}>
      <Text style={[style, roll && styles.hidden]} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
        {value}
      </Text>
      {/* Width of one tabular digit, for columns that grow in or shrink away. */}
      <Text
        style={[style, styles.measure]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setDigitWidth(e.nativeEvent.layout.width)}
      >
        0
      </Text>
      {roll ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.overlay}
        >
          <Text style={style}>{roll.plan.prefix}</Text>
          {roll.plan.columns.map((column, i) => (
            <Column
              key={i}
              column={column}
              direction={roll.plan.direction}
              motion={roll.motion[i]}
              width={roll.width[i]}
              height={height}
              digitWidth={digitWidth}
              style={style}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ColumnProps = {
  column: RollColumn;
  direction: 1 | -1;
  motion: Animated.Value;
  width: Animated.Value;
  height: number;
  digitWidth: number;
  style?: StyleProp<TextStyle>;
};

function Column({
  column: { from, to },
  direction,
  motion,
  width: widthValue,
  height,
  digitWidth,
  style,
}: ColumnProps) {
  if (from === to) return <Text style={style}>{to}</Text>;

  const t = (outputRange: number[]) => motion.interpolate({ inputRange: [0, 1], outputRange });
  const travel = direction * height;
  // Grow/shrink columns animate their width so the label's left edge glides instead of jumping.
  const width = !from
    ? widthValue.interpolate({ inputRange: [0, 1], outputRange: [0, digitWidth] })
    : !to
      ? widthValue.interpolate({ inputRange: [0, 1], outputRange: [digitWidth, 0] })
      : undefined;

  return (
    <Animated.View style={[styles.column, { height, width }]}>
      {/* Sizes a fixed-width column to the character it ends on. */}
      {width === undefined ? <Text style={[style, styles.hidden]}>{to}</Text> : null}
      <Animated.Text
        style={[style, styles.glyph, { opacity: t([1, 0]), transform: [{ translateY: t([0, -travel]) }] }]}
      >
        {from}
      </Animated.Text>
      <Animated.Text style={[style, styles.glyph, { opacity: t([0, 1]), transform: [{ translateY: t([travel, 0]) }] }]}>
        {to}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hidden: { color: 'transparent' },
  measure: { position: 'absolute', opacity: 0 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  column: { overflow: 'hidden' },
  glyph: { position: 'absolute', top: 0, right: 0 },
});
