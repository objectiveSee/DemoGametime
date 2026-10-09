import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [taps, setTaps] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gametime Demo</Text>
      <Pressable
        testID="tap-me"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setTaps((n) => n + 1)}
      >
        <Text style={styles.buttonLabel}>
          {taps === 0 ? 'Tap me' : `Tapped ${taps}x`}
        </Text>
      </Pressable>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  button: {
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#111',
    fontSize: 16,
    fontWeight: '500',
  },
});
