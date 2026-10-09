import { SafeAreaProvider } from 'react-native-safe-area-context';

import Gallery from './src/dev/Gallery';
import { CheckoutScreen } from './src/screens/CheckoutScreen';

// Flip to review every component variant in the dev gallery.
const SHOW_GALLERY = false;

export default function App() {
  return <SafeAreaProvider>{SHOW_GALLERY ? <Gallery /> : <CheckoutScreen />}</SafeAreaProvider>;
}
