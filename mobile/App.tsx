// Throwaway component gallery: every component + variant, static props. Becomes the real checkout later.
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CardNumberInput, CvvInput, ExpiryInput, FieldState } from './src/components/CardFields';
import { DevMenuSheet } from './src/components/DevMenuSheet';
import { OrderSummaryCard } from './src/components/OrderSummaryCard';
import { PayButton } from './src/components/PayButton';
import { PaymentMethodList } from './src/components/PaymentMethodRow';
import { ProcessingOverlay } from './src/components/ProcessingOverlay';
import { QuantityStepper } from './src/components/QuantityStepper';
import { ResultView } from './src/components/ResultView';
import { colors, radii, spacing, type } from './src/theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const FIELD_STATES: FieldState[] = ['empty', 'invalid', 'valid'];

export default function App() {
  return (
    <View style={styles.root}>
      <ScrollView testID="gallery" contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Component Gallery</Text>

        <Section title="Order summary">
          <OrderSummaryCard />
        </Section>

        <Section title="Quantity stepper">
          <QuantityStepper />
          <QuantityStepper quantity={1} label="At minimum" />
        </Section>

        <Section title="Payment methods · iOS, wallet provisioned">
          <PaymentMethodList selected="apple_pay" hidden={['google_pay']} />
        </Section>

        <Section title="Payment methods · total under $100, no wallet">
          <PaymentMethodList
            selected="card"
            hidden={['apple_pay', 'google_pay']}
            disabled={{ affirm: 'Available on orders over $100' }}
          />
        </Section>

        {FIELD_STATES.map((s) => (
          <Section key={s} title={`Card form · ${s}`}>
            <CardNumberInput state={s} />
            <View style={styles.inline}>
              <ExpiryInput state={s} />
              <CvvInput state={s} />
            </View>
          </Section>
        ))}

        <Section title="Pay button">
          <PayButton />
          <PayButton variant="applePay" />
          <PayButton variant="disabled" />
        </Section>

        <Section title="Processing overlay">
          <View style={styles.overlayDemo}>
            <OrderSummaryCard />
            <ProcessingOverlay />
          </View>
        </Section>

        <Section title="Result · success">
          <ResultView variant="success" />
        </Section>

        <Section title="Result · declined">
          <ResultView variant="declined" />
        </Section>

        <Section title="Dev menu sheet">
          <DevMenuSheet />
        </Section>
      </ScrollView>
      <View style={styles.statusBarScrim} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  content: { paddingHorizontal: spacing.lg, paddingTop: 72, paddingBottom: spacing.xxxl },
  h1: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  section: { marginTop: spacing.xxl },
  sectionTitle: {
    ...type.micro,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  sectionBody: { gap: spacing.md },
  inline: { flexDirection: 'row', gap: spacing.md },
  overlayDemo: { borderRadius: radii.card, overflow: 'hidden' },
  // Opaque strip so scrolled content doesn't collide with the status bar.
  statusBarScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, backgroundColor: colors.bgBase },
});
