// Component gallery: every component + variant, static props. Dev-only; toggle "Show component gallery" in the dev menu.
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FieldState } from '../components/CardFields';
import { DevMenuSheet } from '../components/DevMenuSheet';
import { OrderSummaryCard } from '../components/OrderSummaryCard';
import { PayButton } from '../components/PayButton';
import { PaymentMethodList } from '../components/PaymentMethodRow';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { QuantityStepper } from '../components/QuantityStepper';
import { ResultView } from '../components/ResultView';
import { colors, radii, spacing, type } from '../theme';
import { DevMenuButton } from './DevMenu';
import { CardNumberInput, CvvInput, ExpiryInput } from './MockCardInputs';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const FIELD_STATES: FieldState[] = ['empty', 'invalid', 'valid'];

export default function Gallery() {
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

        <Section title="Payment · iOS, wallet provisioned, over $100">
          <PaymentMethodList express={['apple_pay', 'affirm']} />
        </Section>

        <Section title="Payment · Android, card selected">
          <PaymentMethodList
            express={['google_pay']}
            cardExpanded
            cardForm={
              <>
                <CardNumberInput state="valid" />
                <View style={styles.inline}>
                  <ExpiryInput state="valid" />
                  <CvvInput state="valid" />
                </View>
                <PayButton />
              </>
            }
          />
        </Section>

        <Section title="Payment · no wallet, under $100">
          <PaymentMethodList express={['affirm']} disabled={{ affirm: 'Available on orders over $100' }} />
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

        <Section title="Card pay button">
          <PayButton />
          <PayButton disabled />
        </Section>

        <Section title="Overlay · processing">
          <View style={styles.overlayDemo}>
            <OrderSummaryCard />
            <ProcessingOverlay />
          </View>
        </Section>

        <Section title="Overlay · restoring / checking">
          <View style={styles.overlayDemo}>
            <OrderSummaryCard />
            <ProcessingOverlay variant="checking" />
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
      <View style={styles.devMenu}>
        <DevMenuButton />
      </View>
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
  devMenu: { position: 'absolute', top: 60, right: spacing.sm },
  statusBarScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, backgroundColor: colors.bgBase },
});
