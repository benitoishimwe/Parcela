export const Colors = {
  primary: '#00A1DE',
  primaryDark: '#0077A3',
  primaryLight: '#E0F2FE',
  yellow: '#FAD201',
  yellowDark: '#C7A600',
  yellowLight: '#FEFCE8',
  green: '#20603D',
  greenDark: '#143D26',
  greenLight: '#DCFCE7',
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#20603D',
  overlay: 'rgba(0,0,0,0.5)',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  awaiting_payment: { bg: '#FEF3C7', text: '#92400E' },
  awaiting_dropoff: { bg: '#DBEAFE', text: '#1E40AF' },
  dropped_off: { bg: '#E0E7FF', text: '#3730A3' },
  in_transit: { bg: '#FEF3C7', text: '#92400E' },
  ready_for_pickup: { bg: '#DCFCE7', text: '#14532D' },
  delivered: { bg: '#DCFCE7', text: '#14532D' },
  returned: { bg: '#FEE2E2', text: '#991B1B' },
};

export const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting Payment',
  awaiting_dropoff: 'Awaiting Drop-off',
  dropped_off: 'Dropped Off',
  in_transit: 'In Transit',
  ready_for_pickup: 'Ready for Pickup',
  delivered: 'Delivered',
  returned: 'Returned',
};
