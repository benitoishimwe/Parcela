import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, Platform, Modal, Animated, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type InputState = 'idle' | 'focused' | 'valid' | 'invalid' | 'loading';
type ErrorType = 'not_found' | 'invalid_format' | 'offline' | 'generic' | null;

const STATUS_OPTIONS = [
  { key: 'dropped_off',      label: 'Dropped Off',       icon: '📥' },
  { key: 'in_transit',       label: 'In Transit',         icon: '🚚' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup',   icon: '📬' },
  { key: 'delivered',        label: 'Delivered',           icon: '✅' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function autoFormat(raw: string): string {
  // Strip non-alphanumeric except underscore / hyphen
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  // If it looks like a tracking code (no underscore start), insert dash at pos 3
  if (!cleaned.startsWith('PARCEL_') && cleaned.length > 3 && !cleaned.includes('-')) {
    return cleaned.slice(0, 3) + '-' + cleaned.slice(3);
  }
  return raw.toUpperCase();
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CourierScan() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  // Input
  const [manualId, setManualId] = useState('');
  const [inputState, setInputState] = useState<InputState>('idle');
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [errorMsg, setErrorMsg]   = useState('');

  // Data
  const [parcel, setParcel]     = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [scanned, setScanned]   = useState(false);

  // Animations
  const errorAnim   = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const inputRef    = useRef<TextInput>(null);

  // ── Animation helpers ──────────────────────────────────────────────────────
  const playError = useCallback(() => {
    errorAnim.setValue(0);
    Animated.sequence([
      Animated.timing(errorAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // Shake
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 40, useNativeDriver: true }),
    ]).start();
  }, [errorAnim, shakeAnim]);

  const playSuccess = useCallback(() => {
    successAnim.setValue(0);
    Animated.spring(successAnim, {
      toValue: 1, tension: 80, friction: 7, useNativeDriver: true,
    }).start();
  }, [successAnim]);

  // ── Core logic ─────────────────────────────────────────────────────────────
  const parseQRData = (data: string): string | null => {
    if (data.startsWith('PARCELA:')) {
      const parts = data.split(':');
      if (parts.length >= 2) return parts[1];
    }
    return null;
  };

  const fetchParcel = useCallback(async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;

    setLoading(true);
    setInputState('loading');
    setErrorType(null);
    setErrorMsg('');
    setParcel(null);

    try {
      let data;
      if (trimmed.startsWith('parcel_') || trimmed.startsWith('PARCEL_')) {
        data = await api.get(`/api/parcels/${trimmed.toLowerCase()}`, token || undefined);
      } else {
        data = await api.get(`/api/parcels/track/${trimmed.toUpperCase()}`);
        if (data?.parcel_id) {
          data = await api.get(`/api/parcels/${data.parcel_id}`, token || undefined);
        }
      }
      setParcel(data);
      setInputState('valid');
      setShowCamera(false);
      playSuccess();
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('Network') || msg.includes('fetch')) {
        setErrorType('offline');
        setErrorMsg('You appear to be offline. Check your connection and try again.');
      } else if (msg.includes('404') || msg.includes('not found') || msg.toLowerCase().includes('not found')) {
        setErrorType('not_found');
        setErrorMsg(`No parcel found for "${trimmed}". Double-check the ID or tracking code.`);
      } else {
        setErrorType('generic');
        setErrorMsg(msg || 'Something went wrong. Please try again.');
      }
      setInputState('invalid');
      playError();
    } finally {
      setLoading(false);
    }
  }, [token, playSuccess, playError]);

  const handleManualSearch = useCallback(() => {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    if (trimmed.length < 4) {
      setErrorType('invalid_format');
      setErrorMsg('Enter a valid Parcel ID (parcel_xxx) or Tracking Code (AKB-XXXXXXXX).');
      setInputState('invalid');
      playError();
      return;
    }
    fetchParcel(trimmed);
  }, [manualId, fetchParcel, playError]);

  const handleBarcodeScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowCamera(false);
    const parcelId = parseQRData(data);
    fetchParcel(parcelId ?? data);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!parcel) return;
    setUpdating(true);
    try {
      const updated = await api.put(`/api/parcels/${parcel.parcel_id}/status`, {
        status: newStatus,
        note: 'Updated by courier',
      }, token || undefined);
      setParcel(updated);
    } catch (err: any) {
      setErrorType('generic');
      setErrorMsg(err.message || 'Could not update status.');
      playError();
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setErrorType('generic');
        setErrorMsg('Camera access is required to scan QR codes. Enable it in your device settings.');
        setInputState('invalid');
        playError();
        return;
      }
    }
    setScanned(false);
    setShowCamera(true);
  };

  const resetScan = () => {
    setParcel(null);
    setScanned(false);
    setManualId('');
    setInputState('idle');
    setErrorType(null);
    setErrorMsg('');
    successAnim.setValue(0);
  };

  const handleChangeText = (text: string) => {
    const formatted = autoFormat(text);
    setManualId(formatted);
    setErrorType(null);
    setErrorMsg('');
    if (inputState === 'invalid') setInputState('focused');
  };

  // ── Derived styles ─────────────────────────────────────────────────────────
  const inputBorderColor = (() => {
    if (inputState === 'focused') return Colors.primary;
    if (inputState === 'valid')   return Colors.green;
    if (inputState === 'invalid') return Colors.error;
    return Colors.border;
  })();

  const sc = parcel ? (STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' }) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Camera Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
        <View style={styles.cameraContainer}>
          <SafeAreaView style={styles.cameraHeader}>
            <TouchableOpacity style={styles.cameraClose} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Scan QR Code</Text>
            <View style={{ width: 44 }} />
          </SafeAreaView>

          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
          />

          {/* Overlay */}
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.overlayTop} />
            <View style={styles.overlayRow}>
              <View style={styles.overlaySide} />
              <View style={styles.scanFrame}>
                {(['TL','TR','BL','BR'] as const).map(c => (
                  <View key={c} style={[styles.corner, styles[`corner${c}`]]} />
                ))}
                <View style={styles.scanLine} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.scanHint}>Align the QR code within the frame</Text>
            </View>
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity
              style={styles.manualFallbackBtn}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="keyboard-outline" size={16} color={Colors.white} />
              <Text style={styles.manualFallbackText}>Enter code manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          onPress={() => router.back()}
          android_ripple={{ color: Colors.primaryLight, radius: 20, borderless: true }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle}>{t('scan_qr') || 'Scan QR'}</Text>
        {parcel ? (
          <TouchableOpacity style={styles.newScanBtn} onPress={resetScan} activeOpacity={0.75}>
            <Ionicons name="refresh" size={14} color={Colors.primary} />
            <Text style={styles.newScanText}>New Scan</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!parcel && (
          <>
            {/* ── Camera Section ─────────────────────────────────────────── */}
            {Platform.OS !== 'web' ? (
              <Pressable
                style={({ pressed }) => [styles.cameraCard, pressed && styles.cameraCardPressed]}
                onPress={handleOpenCamera}
                android_ripple={{ color: Colors.primaryLight }}
              >
                <View style={styles.cameraIconWrap}>
                  <Ionicons name="qr-code" size={40} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cameraCardTitle}>Scan with Camera</Text>
                  <Text style={styles.cameraCardSub}>Point at the parcel's QR code to auto-fill</Text>
                </View>
                <View style={styles.cameraChevron}>
                  <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
                </View>
              </Pressable>
            ) : (
              <View style={[styles.cameraCard, styles.cameraCardDisabled]}>
                <View style={[styles.cameraIconWrap, { backgroundColor: Colors.surfaceElevated }]}>
                  <Ionicons name="qr-code-outline" size={40} color={Colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cameraCardTitle, { color: Colors.textTertiary }]}>Camera scanning</Text>
                  <Text style={styles.cameraCardSub}>Available on the iOS & Android app</Text>
                </View>
                <View style={[styles.webBadge]}>
                  <Text style={styles.webBadgeText}>Web</Text>
                </View>
              </View>
            )}

            {/* ── Divider ────────────────────────────────────────────────── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or enter manually</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Manual Entry Card ──────────────────────────────────────── */}
            <Animated.View style={[styles.inputCard, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={styles.inputCardLabel}>Parcel ID / Tracking Code</Text>

              <View style={[
                styles.inputRow,
                { borderColor: inputBorderColor },
                inputState === 'focused' && styles.inputRowFocused,
                inputState === 'invalid' && styles.inputRowError,
                inputState === 'valid'   && styles.inputRowValid,
              ]}>
                {/* Left icon */}
                <View style={styles.inputIconLeft}>
                  {inputState === 'loading' ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : inputState === 'valid' ? (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
                  ) : inputState === 'invalid' ? (
                    <Ionicons name="alert-circle" size={20} color={Colors.error} />
                  ) : (
                    <Ionicons name="barcode-outline" size={20} color={
                      inputState === 'focused' ? Colors.primary : Colors.textTertiary
                    } />
                  )}
                </View>

                <TextInput
                  ref={inputRef}
                  testID="parcel-manual-input"
                  style={styles.textInput}
                  value={manualId}
                  onChangeText={handleChangeText}
                  placeholder="parcel_xxx or AKB-XXXXXXXX"
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="search"
                  onSubmitEditing={handleManualSearch}
                  onFocus={() => !loading && setInputState('focused')}
                  onBlur={() => {
                    if (inputState === 'focused') setInputState('idle');
                  }}
                  editable={!loading}
                />

                {/* Clear button */}
                {manualId.length > 0 && !loading && (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => { setManualId(''); setInputState('idle'); setErrorType(null); setErrorMsg(''); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>
                )}

                {/* Search button */}
                <Pressable
                  testID="manual-search-btn"
                  style={({ pressed }) => [
                    styles.searchBtn,
                    !manualId.trim() && styles.searchBtnDisabled,
                    pressed && manualId.trim() && styles.searchBtnPressed,
                  ]}
                  onPress={handleManualSearch}
                  disabled={!manualId.trim() || loading}
                  android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
                >
                  {loading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Ionicons name="search" size={20} color={Colors.white} />
                  }
                </Pressable>
              </View>

              {/* Hint text */}
              {!errorType && (
                <Text style={styles.inputHint}>
                  Enter a Parcel ID (parcel_xxx) or Tracking Code (e.g. AKB-AB123456)
                </Text>
              )}

              {/* Error message */}
              {errorType && errorMsg ? (
                <Animated.View
                  style={[styles.errorBanner, { opacity: errorAnim }]}
                >
                  <Ionicons
                    name={errorType === 'offline' ? 'wifi-outline' : errorType === 'not_found' ? 'search-outline' : 'warning-outline'}
                    size={15}
                    color={errorType === 'offline' ? Colors.warning : Colors.error}
                  />
                  <Text style={[
                    styles.errorBannerText,
                    errorType === 'offline' && { color: Colors.warning },
                  ]}>
                    {errorMsg}
                  </Text>
                </Animated.View>
              ) : null}
            </Animated.View>

            {/* ── Empty State ────────────────────────────────────────────── */}
            {!loading && !errorType && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="cube-outline" size={36} color={Colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No parcel loaded</Text>
                <Text style={styles.emptySubtitle}>
                  {Platform.OS === 'web'
                    ? 'Enter a Parcel ID or Tracking Code above to look up a parcel.'
                    : 'Scan a QR code or enter a Parcel ID / Tracking Code to get started.'}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Loading State ──────────────────────────────────────────────── */}
        {loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTitle}>Looking up parcel…</Text>
            <Text style={styles.loadingSubtitle}>This usually takes a moment</Text>
          </View>
        )}

        {/* ── Parcel Result ──────────────────────────────────────────────── */}
        {parcel && sc && !loading && (
          <Animated.View style={[
            styles.parcelCard,
            { opacity: successAnim, transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
          ]}>
            {/* Success badge */}
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
              <Text style={styles.successBadgeText}>Parcel Found</Text>
            </View>

            {/* Tracking & status */}
            <View style={styles.parcelHeader}>
              <Text style={styles.parcelTracking}>{parcel.tracking_code}</Text>
              <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                <Text style={[styles.statusPillText, { color: sc.text }]}>
                  {STATUS_LABELS[parcel.status]}
                </Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.detailsBox}>
              <DetailRow icon="resize-outline"    label="Size"      value={parcel.size?.charAt(0).toUpperCase() + parcel.size?.slice(1)} />
              <DetailRow icon="person-outline"    label="Recipient" value={`${parcel.recipient_name} · ${parcel.recipient_phone}`} />
              <DetailRow icon="location-outline"  label="From"      value={parcel.origin_locker_name} />
              <DetailRow icon="navigate-outline"  label="To"        value={parcel.destination_locker_name} />
              <DetailRow icon="card-outline"      label="Payment"   value={parcel.payment_status === 'paid' ? 'Paid' : 'Pending'} paymentStatus={parcel.payment_status} />
            </View>

            {/* Status update */}
            <Text style={styles.sectionLabel}>Update Status</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map(opt => {
                const isCurrent = parcel.status === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    testID={`status-opt-${opt.key}`}
                    style={({ pressed }) => [
                      styles.statusOpt,
                      isCurrent  && styles.statusOptActive,
                      pressed && !isCurrent && styles.statusOptPressed,
                    ]}
                    onPress={() => !isCurrent && handleUpdateStatus(opt.key)}
                    disabled={isCurrent || updating}
                    android_ripple={{ color: Colors.primaryLight }}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Text style={styles.statusOptIcon}>{opt.icon}</Text>
                        <Text style={[styles.statusOptLabel, isCurrent && styles.statusOptLabelActive]}>
                          {opt.label}
                        </Text>
                        {isCurrent && (
                          <View style={styles.statusOptCheck}>
                            <Ionicons name="checkmark" size={12} color={Colors.primary} />
                          </View>
                        )}
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Error in update */}
            {errorType && errorMsg ? (
              <View style={styles.updateError}>
                <Ionicons name="warning-outline" size={14} color={Colors.error} />
                <Text style={styles.updateErrorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Pickup code */}
            {parcel.qr_code && (
              <View style={styles.pickupBox}>
                <Ionicons name="keypad-outline" size={18} color={Colors.primaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickupLabel}>Courier Pickup Code</Text>
                  <Text style={styles.pickupCode}>{parcel.qr_code}</Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Detail Row ────────────────────────────────────────────────────────────────
function DetailRow({
  icon, label, value, paymentStatus,
}: {
  icon: string; label: string; value: string; paymentStatus?: string;
}) {
  const isPaid = paymentStatus === 'paid';
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon as any} size={14} color={Colors.primary} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        {paymentStatus !== undefined ? (
          <View style={[styles.paymentPill, { backgroundColor: isPaid ? Colors.greenLight : Colors.warningLight }]}>
            <Text style={[styles.paymentText, { color: isPaid ? Colors.green : Colors.warning }]}>
              {isPaid ? 'Paid' : 'Pending'}
            </Text>
          </View>
        ) : (
          <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CORNER = 20;
const STROKE = 3;
const CORNER_COLOR = Colors.yellow;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPressed: { backgroundColor: Colors.surfaceElevated },
  topBarTitle: {
    flex: 1, fontSize: 17, fontWeight: '700', color: Colors.textPrimary,
    paddingLeft: 4,
  },
  newScanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  newScanText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  // Camera card
  cameraCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Colors.primaryLight,
    ...{
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
  },
  cameraCardDisabled: {
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.7,
  },
  cameraCardPressed: { opacity: 0.88, borderColor: Colors.primary },
  cameraIconWrap: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  cameraCardSub:   { fontSize: 12, color: Colors.textSecondary },
  cameraChevron: {
    width: 32, height: 32, backgroundColor: Colors.primaryLight,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  webBadge: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  webBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerLabel: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },

  // Input card
  inputCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },
    gap: 10,
  },
  inputCardLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, backgroundColor: Colors.background,
    overflow: 'hidden',
    minHeight: 52,
  },
  inputRowFocused: { borderColor: Colors.primary, backgroundColor: Colors.white },
  inputRowError:   { borderColor: Colors.error,   backgroundColor: '#FFF8F8' },
  inputRowValid:   { borderColor: Colors.green,   backgroundColor: '#F8FFF9' },
  inputIconLeft: {
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  textInput: {
    flex: 1, height: 52, fontSize: 15, color: Colors.textPrimary,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
  },
  clearBtn: {
    paddingHorizontal: 8, height: 52, alignItems: 'center', justifyContent: 'center',
  },
  searchBtn: {
    width: 52, height: 52, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnDisabled: { backgroundColor: Colors.textTertiary },
  searchBtnPressed:  { backgroundColor: Colors.primaryDark },
  inputHint: { fontSize: 11, color: Colors.textTertiary, paddingHorizontal: 2 },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.errorLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  errorBannerText: {
    flex: 1, fontSize: 12, color: Colors.error, fontWeight: '500', lineHeight: 18,
  },

  // Empty state
  emptyState: {
    alignItems: 'center', paddingVertical: 36, gap: 10,
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySubtitle: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

  // Loading card
  loadingCard: {
    alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16,
    padding: 36, gap: 12,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },
  },
  loadingTitle:    { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  loadingSubtitle: { fontSize: 13, color: Colors.textTertiary },

  // Parcel card
  parcelCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 0,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  successBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.greenLight, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    marginBottom: 14,
  },
  successBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.green },

  parcelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  parcelTracking: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  // Details box
  detailsBox: {
    backgroundColor: Colors.background, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 20, gap: 2,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7, gap: 10,
  },
  detailIconWrap: {
    width: 26, height: 26, backgroundColor: Colors.primaryLight,
    borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  detailLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', width: 72 },
  detailValueWrap: { flex: 1 },
  detailValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  paymentPill: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  paymentText: { fontSize: 11, fontWeight: '700' },

  // Section label
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },

  // Status grid
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statusOpt: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.background,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  statusOptActive:  { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusOptPressed: { backgroundColor: Colors.surfaceElevated },
  statusOptIcon:    { fontSize: 22 },
  statusOptLabel:   { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  statusOptLabelActive: { color: Colors.primary, fontWeight: '800' },
  statusOptCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  // Update error
  updateError: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: Colors.errorLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  updateErrorText: { flex: 1, fontSize: 12, color: Colors.error, fontWeight: '500' },

  // Pickup box
  pickupBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.yellowLight, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  pickupLabel: { fontSize: 11, fontWeight: '600', color: Colors.yellowDark, marginBottom: 2 },
  pickupCode:  { fontSize: 22, fontWeight: '900', color: Colors.yellowDark, letterSpacing: 4 },

  // Camera modal
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, zIndex: 10,
  },
  cameraClose: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  cameraFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 20,
  },
  manualFallbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  manualFallbackText: { color: Colors.white, fontSize: 14, fontWeight: '600' },

  // Camera overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  overlayTop:    { flex: 1.2, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayRow:    { flexDirection: 'row', height: 260 },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'flex-start', paddingTop: 24,
  },
  scanFrame:   { width: 260, height: 260, position: 'relative' },
  scanHint:    { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  scanLine: {
    position: 'absolute', left: 10, right: 10, top: '50%',
    height: 2, backgroundColor: Colors.primary, opacity: 0.7,
  },
  corner: {
    position: 'absolute', width: CORNER, height: CORNER,
    borderColor: CORNER_COLOR, borderWidth: STROKE,
  },
  cornerTL: { top: 0,    left: 0,    borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0,    right: 0,   borderLeftWidth: 0,  borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0,    borderRightWidth: 0, borderTopWidth: 0    },
  cornerBR: { bottom: 0, right: 0,   borderLeftWidth: 0,  borderTopWidth: 0    },
});
