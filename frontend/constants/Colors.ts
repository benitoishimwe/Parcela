export const Colors = {
  // Brand
  primary: '#00A1DE',
  primaryDark: '#0077A3',
  primaryLight: '#E0F2FE',
  primaryMid: '#38BDF8',

  // Accent
  yellow: '#FAD201',
  yellowDark: '#C7A600',
  yellowLight: '#FEFCE8',

  // Success / Green (Rwanda flag green)
  green: '#16A34A',
  greenDark: '#14532D',
  greenLight: '#DCFCE7',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Semantic
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  success: '#16A34A',
  successLight: '#DCFCE7',
  info: '#00A1DE',
  infoLight: '#E0F2FE',

  // Overlays
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.08)',
};

// Shadows (use as spread: ...Shadows.card)
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  primary: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  green: {
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  awaiting_payment:  { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  awaiting_dropoff:  { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
  dropped_off:       { bg: '#E0E7FF', text: '#3730A3', dot: '#6366F1' },
  in_transit:        { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  ready_for_pickup:  { bg: '#DCFCE7', text: '#14532D', dot: '#16A34A' },
  delivered:         { bg: '#DCFCE7', text: '#14532D', dot: '#16A34A' },
  returned:          { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
};

export const STATUS_LABELS: Record<string, string> = {
  awaiting_payment:  'Awaiting Payment',
  awaiting_dropoff:  'Awaiting Drop-off',
  dropped_off:       'Dropped Off',
  in_transit:        'In Transit',
  ready_for_pickup:  'Ready for Pickup',
  delivered:         'Delivered',
  returned:          'Returned',
};

export const STATUS_ICONS: Record<string, string> = {
  awaiting_payment:  '💳',
  awaiting_dropoff:  '📋',
  dropped_off:       '📥',
  in_transit:        '🚚',
  ready_for_pickup:  '📬',
  delivered:         '✅',
  returned:          '↩️',
};
