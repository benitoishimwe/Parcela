import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

const STATUS_OPTIONS = [
  { key: 'dropped_off', label: 'Dropped Off', icon: '📥' },
  { key: 'in_transit', label: 'In Transit', icon: '🚚' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: '📬' },
  { key: 'delivered', label: 'Delivered', icon: '✅' },
];

export default function CourierTask() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [parcelId, setParcelId] = useState('');
  const [parcel, setParcel] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleSearch = async () => {
    if (!parcelId.trim()) return;
    setLoading(true);
    setParcel(null);
    try {
      const data = await api.get(`/api/parcels/${parcelId.trim()}`, token || undefined);
      setParcel(data);
    } catch (err: any) {
      Alert.alert(t('error'), 'Parcel not found. Try tracking code or parcel ID');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!parcel) return;
    setUpdating(true);
    try {
      const updated = await api.put(`/api/parcels/${parcel.parcel_id}/status`, {
        status: newStatus, note: `Updated by courier`,
      }, token || undefined);
      setParcel(updated);
      Alert.alert('✅ Updated', `Status changed to: ${STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      Alert.alert(t('error'), err.message);
    } finally {
      setUpdating(false);
    }
  };

  const sc = parcel ? (STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B' }) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scan_qr')}</Text>
          <Text style={styles.subtitle}>Enter parcel ID to update status</Text>
        </View>

        {/* Search */}
        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <TextInput
              testID="parcel-search"
              style={styles.searchInput}
              value={parcelId}
              onChangeText={setParcelId}
              placeholder="Enter Parcel ID or tracking code"
              autoCapitalize="characters"
              placeholderTextColor={Colors.textTertiary}
            />
            <TouchableOpacity testID="search-parcel" style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} size="small" /> :
                <Ionicons name="search" size={22} color={Colors.white} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Parcel info */}
        {parcel && sc && (
          <View style={styles.parcelCard}>
            <View style={styles.parcelHeader}>
              <Text style={styles.parcelTracking}>{parcel.tracking_code}</Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.text }]}>{STATUS_LABELS[parcel.status]}</Text>
              </View>
            </View>

            <View style={styles.parcelDetails}>
              <Text style={styles.detailRow}>📦 {parcel.size?.charAt(0).toUpperCase() + parcel.size?.slice(1)}</Text>
              <Text style={styles.detailRow}>👤 {parcel.recipient_name} ({parcel.recipient_phone})</Text>
              <Text style={styles.detailRow}>📍 {parcel.origin_locker_name} → {parcel.destination_locker_name}</Text>
            </View>

            <Text style={styles.updateTitle}>{t('update_status')}</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  testID={`status-${opt.key}`}
                  style={[
                    styles.statusBtn,
                    parcel.status === opt.key && styles.statusBtnActive,
                  ]}
                  onPress={() => handleUpdateStatus(opt.key)}
                  disabled={updating || parcel.status === opt.key}
                >
                  {updating ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                    <>
                      <Text style={styles.statusBtnIcon}>{opt.icon}</Text>
                      <Text style={[styles.statusBtnText, parcel.status === opt.key && { color: Colors.primary }]}>
                        {opt.label}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!parcel && !loading && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={styles.emptyText}>Enter a parcel ID above to view details and update status</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  searchCard: {
    marginHorizontal: 20, backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 52, backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16,
    fontSize: 15, color: Colors.textPrimary,
  },
  searchBtn: {
    width: 52, height: 52, backgroundColor: Colors.primary,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  parcelCard: {
    margin: 20, backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  parcelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  parcelTracking: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  parcelDetails: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 16, gap: 8 },
  detailRow: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  updateTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 12 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusBtn: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.background,
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, gap: 6,
  },
  statusBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusBtnIcon: { fontSize: 24 },
  statusBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
