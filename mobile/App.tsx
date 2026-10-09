import { SafeAreaProvider } from 'react-native-safe-area-context';

import Gallery from './src/dev/Gallery';
import { EnvironmentProvider, useDevSettings } from './src/hooks/useEnvironment';
import { CheckoutScreen } from './src/screens/CheckoutScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <EnvironmentProvider>
        <Root />
      </EnvironmentProvider>
    </SafeAreaProvider>
  );
}

// The component gallery is toggled from the dev menu ("Show component gallery").
function Root() {
  const { showGallery } = useDevSettings();
  return showGallery ? <Gallery /> : <CheckoutScreen />;
}
