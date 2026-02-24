import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, TextInput, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

const STATUS_OPTIONS = [
  { key: 'dropped_off', label: 'Dropped Off', icon: '📥', next: true },
  { key: 'in_transit', label: 'In Transit', icon: '🚚', next: true },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: '📬', next: true },
  { key: 'delivered', label: 'Delivered', icon: '✅', next: false },
];

export default function CourierScan() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<'scan' | 'manual'>(Platform.OS === 'web' ? 'manual' : 'scan');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualId, setManualId] = useState('');
  const [parcel, setParcel] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const parseQRData = (data: string): string | null => {
    // Format: AKABATI:{parcel_id}:{tracking_code}:{pickup_code}
    if (data.startsWith('AKABATI:')) {
      const parts = data.split(':');
      if (parts.length >= 2) return parts[1];
    }
    return null;
  };

  const fetchParcel = async (id: string) => {
    setLoading(true);
    setParcel(null);
    try {
      // Try as parcel ID first, then as tracking code
      let data;
      if (id.startsWith('parcel_')) {
        data = await api.get(`/api/parcels/${id}`, token || undefined);
      } else {
        data = await api.get(`/api/parcels/track/${id.toUpperCase()}`);
        // If tracking code, fetch full parcel for status update
        if (data?.parcel_id) {
          data = await api.get(`/api/parcels/${data.parcel_id}`, token || undefined);
        }
      }
      setParcel(data);
      setShowCamera(false);
    } catch {
      Alert.alert(t('error'), 'Parcel not found. Check the ID or tracking code.');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setShowCamera(false);
    const parcelId = parseQRData(data);
    if (parcelId) {
      fetchParcel(parcelId);
    } else {
      // Might be raw parcel_id or tracking code
      fetchParcel(data);
    }
  };

  const handleManualSearch = () => {
    if (!manualId.trim()) return;
    fetchParcel(manualId.trim());
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!parcel) return;
    Alert.alert(
      'Confirm Update',
      `Change status to: ${STATUS_LABELS[newStatus]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            setUpdating(true);
            try {
              const updated = await api.put(`/api/parcels/${parcel.parcel_id}/status`, {
                status: newStatus,
                note: `Updated by courier`,
              }, token || undefined);
              setParcel(updated);
            } catch (err: any) {
              Alert.alert(t('error'), err.message);
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const resetScan = () => {
    setParcel(null);
    setScanned(false);
    setManualId('');
    if (Platform.OS !== 'web') {
      setShowCamera(true);
    }
  };

  const sc = parcel ? (STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B' }) : null;

  // Camera permission handling
  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is needed to scan QR codes. Please enable it in settings.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setScanned(false);
    setShowCamera(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
        <View style={styles.cameraContainer}>
          {/* Camera Header */}
          <SafeAreaView style={styles.cameraHeader}>
            <TouchableOpacity style={styles.cameraClose} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={28} color={Colors.white} />
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
          <View style={styles.overlay}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddle}>
              <View style={styles.overlayLeft} />
              <View style={styles.scanWindow}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.overlayRight} />
            </View>
            <View style={styles.overlayBottom}>
              <Text style={styles.scanHint}>Point at the parcel QR code</Text>
              <TouchableOpacity
                style={styles.manualFallbackBtn}
                onPress={() => { setShowCamera(false); setScanMode('manual'); }}
              >
                <Text style={styles.manualFallbackText}>Enter code manually instead</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('scan_qr')}</Text>
          {parcel && (
            <TouchableOpacity style={styles.resetBtn} onPress={resetScan}>
              <Ionicons name="refresh" size={16} color={Colors.primary} />
              <Text style={styles.resetText}>New Scan</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode Toggle (only show when no parcel loaded) */}
        {!parcel && (
          <>
            {/* Scan Button */}
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.scanBtn} onPress={openCamera}>
                <View style={styles.scanBtnIcon}>
                  <Ionicons name="qr-code-outline" size={48} color={Colors.primary} />
                </View>
                <Text style={styles.scanBtnTitle}>Tap to Scan QR Code</Text>
                <Text style={styles.scanBtnSub}>Point camera at parcel's QR code</Text>
              </TouchableOpacity>
            )}

            {Platform.OS === 'web' && (
              <View style={styles.webNote}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.webNoteText}>Camera scanning available on mobile app. Use manual entry below.</Text>
              </View>
            )}

            {/* Divider */}
            {Platform.OS !== 'web' && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or enter manually</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {/* Manual Entry */}
            <View style={styles.manualCard}>
              <Text style={styles.manualLabel}>Parcel ID / Tracking Code</Text>
              <View style={styles.manualRow}>
                <TextInput
                  testID="parcel-manual-input"
                  style={styles.manualInput}
                  value={manualId}
                  onChangeText={setManualId}
                  placeholder="parcel_xxx or AKB-XXXXXXXX"
                  autoCapitalize="characters"
                  placeholderTextColor={Colors.textTertiary}
                  onSubmitEditing={handleManualSearch}
                />
                <TouchableOpacity
                  testID="manual-search-btn"
                  style={[styles.manualBtn, !manualId.trim() && { opacity: 0.5 }]}
                  onPress={handleManualSearch}
                  disabled={!manualId.trim() || loading}
                >
                  {loading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Ionicons name="search" size={22} color={Colors.white} />}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Looking up parcel...</Text>
          </View>
        )}

        {/* Parcel Info & Status Update */}
        {parcel && sc && !loading && (
          <View style={styles.parcelCard}>
            {/* Success indicator */}
            <View style={styles.scannedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
              <Text style={styles.scannedText}>Parcel Found</Text>
            </View>

            {/* Tracking & Status */}
            <View style={styles.parcelHeader}>
              <Text style={styles.parcelTracking}>{parcel.tracking_code}</Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.text }]}>
                  {STATUS_LABELS[parcel.status]}
                </Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.detailsBox}>
              <DetailRow icon="cube-outline" label="Size" value={parcel.size?.charAt(0).toUpperCase() + parcel.size?.slice(1)} />
              <DetailRow icon="person-outline" label="Recipient" value={`${parcel.recipient_name} · ${parcel.recipient_phone}`} />
              <DetailRow icon="location-outline" label="From" value={parcel.origin_locker_name} />
              <DetailRow icon="navigate-outline" label="To" value={parcel.destination_locker_name} />
              <DetailRow icon="cash-outline" label="Payment" value={parcel.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'} />
            </View>

            {/* Status Update */}
            <Text style={styles.updateTitle}>Update Parcel Status</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map(opt => {
                const isCurrent = parcel.status === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    testID={`status-opt-${opt.key}`}
                    style={[styles.statusOpt, isCurrent && styles.statusOptCurrent]}
                    onPress={() => !isCurrent && handleUpdateStatus(opt.key)}
                    disabled={isCurrent || updating}
                  >
                    {updating ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                      <>
                        <Text style={styles.statusOptIcon}>{opt.icon}</Text>
                        <Text style={[styles.statusOptLabel, isCurrent && { color: Colors.primary, fontWeight: '800' }]}>
                          {opt.label}
                        </Text>
                        {isCurrent && (
                          <View style={styles.currentDot}>
                            <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                          </View>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pickup Code (visible to courier) */}
            {parcel.qr_code && (
              <View style={styles.pickupBox}>
                <Ionicons name="keypad-outline" size={18} color={Colors.primaryDark} />
                <Text style={styles.pickupLabel}>Pickup Code: </Text>
                <Text style={styles.pickupCode}>{parcel.qr_code}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color={Colors.primary} style={{ width: 20 }} />
      <Text style={styles.detailLabel}>{label}: </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.65)';
const CORNER_SIZE = 22;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  resetText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, zIndex: 10,
  },
  cameraClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cameraTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlayTop: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayMiddle: { flexDirection: 'row', height: 260 },
  overlayLeft: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayRight: { flex: 1, backgroundColor: OVERLAY_COLOR },
  scanWindow: { width: 260, height: 260, position: 'relative' },
  overlayBottom: { flex: 1, backgroundColor: OVERLAY_COLOR, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scanHint: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  manualFallbackBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  manualFallbackText: { color: Colors.white, fontSize: 13 },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.yellow, borderWidth: CORNER_WIDTH },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  // Scan button
  scanBtn: {
    marginHorizontal: 20, backgroundColor: Colors.white, borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 10,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
    borderWidth: 2, borderColor: Colors.primaryLight,
  },
  scanBtnIcon: {
    width: 96, height: 96, backgroundColor: Colors.primaryLight,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  scanBtnTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  scanBtnSub: { fontSize: 14, color: Colors.textSecondary },

  // Web note
  webNote: {
    marginHorizontal: 20, backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4,
  },
  webNoteText: { flex: 1, fontSize: 13, color: Colors.primaryDark, fontWeight: '500' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, marginHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textTertiary, paddingHorizontal: 12, fontSize: 13 },

  // Manual entry
  manualCard: {
    marginHorizontal: 20, backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  manualLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1, height: 52, backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16,
    fontSize: 15, color: Colors.textPrimary,
  },
  manualBtn: {
    width: 52, height: 52, backgroundColor: Colors.primary,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },

  // Loading
  loadingWrap: { alignItems: 'center', paddingTop: 40, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  // Parcel card
  parcelCard: {
    margin: 20, backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 5,
  },
  scannedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14,
    backgroundColor: Colors.greenLight, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  scannedText: { fontSize: 12, fontWeight: '700', color: Colors.green },
  parcelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  parcelTracking: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Details
  detailsBox: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

  // Status options
  updateTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 12 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statusOpt: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.background,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  statusOptCurrent: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusOptIcon: { fontSize: 24 },
  statusOptLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  currentDot: { position: 'absolute', top: 8, right: 8 },

  // Pickup code
  pickupBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.yellowLight,
    borderRadius: 12, padding: 14, gap: 8,
  },
  pickupLabel: { fontSize: 13, color: Colors.yellowDark, fontWeight: '600' },
  pickupCode: { fontSize: 22, fontWeight: '900', color: Colors.yellowDark, letterSpacing: 4 },
});
