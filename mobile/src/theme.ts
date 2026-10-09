// Dark theme tokens, from mobile/STYLE_GUIDE.md. Components reference these only.

export const colors = {
  green500: '#2BD17E',
  green400: '#4AE3A0',
  green700: '#1FA864',
  bgBase: '#0E0F11',
  bgDeep: '#05070F',
  surface1: '#1A1B1E',
  surface2: '#25262A',
  surface3: '#6E6E73',
  borderSubtle: '#2C2D31',
  borderStrong: '#8A8A8F',
  textPrimary: '#FFFFFF',
  textSecondary: '#C9CACD',
  textTertiary: '#8E8F94',
  textOnGreen: '#0B1A12',
  error: '#FF5A5F',
  scrim: 'rgba(0,0,0,0.6)',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  control: 6,
  card: 12,
  sheet: 16,
  pill: 9999,
} as const;

export const type = {
  h1: { fontSize: 28, fontWeight: '800' },
  h2: { fontSize: 22, fontWeight: '700' },
  h3: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  meta: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  micro: { fontSize: 11, fontWeight: '400' },
} as const;

export const touchTarget = 44;
export const controlHeight = 56;
