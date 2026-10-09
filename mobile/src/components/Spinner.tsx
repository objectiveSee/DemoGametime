// The app's loading indicator: a looping brand-green Lottie (assets/lottie/loading.json, recolored
// from the stock black to green-500). With Reduce Motion on it falls back to the system spinner.
import LottieView from 'lottie-react-native';
import { ActivityIndicator, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme';

// The animation's own canvas is 470×744; keep that aspect so it isn't squashed.
const ASPECT = 470 / 744;

export function Spinner({ size = 64, testID }: { size?: number; testID?: string }) {
  const reduced = useReducedMotion();
  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {reduced ? (
        <ActivityIndicator size="large" color={colors.green500} />
      ) : (
        <LottieView
          source={require('../assets/lottie/loading.json')}
          autoPlay
          loop
          style={{ width: size * ASPECT, height: size }}
        />
      )}
    </View>
  );
}
