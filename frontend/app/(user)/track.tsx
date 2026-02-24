import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

export default function Track() {
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code || '');
  const [loading, setLoading] = useState(false);
  const [parcel, setParcel] = useState<any>(null);
  const [error, setError] = useState('');

  const handleTrack = async (trackCode?: string) => {
    const searchCode = (trackCode || code).trim();
    if (!searchCode) return;
    setLoading(true);
    setError('');
    setParcel(null);
    try {
      const data = await api.get(`/api/parcels/track/${searchCode.toUpperCase()}`);
      setParcel(data);
    } catch (err: any) {
      setError(err.message || 'Parcel not found');
    } finally {
      setLoading(false);
    }
  };

  // Auto-search if code passed as param
  useEffect(() => {
    if (params.code) {
      setCode(params.code);
      handleTrack(params.code);
    }
  }, [params.code]);

  const sc = parcel ? (STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B' }) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('track_parcel')}</Text>
          </View>

          {/* Search Box */}
          <View style={styles.searchCard}>
            <Text style={styles.searchLabel}>{t('tracking_number')}</Text>
            <View style={styles.searchRow}>
              <TextInput
                testID="tracking-input"
                style={styles.searchInput}
                value={code}
                onChangeText={setCode}
                placeholder={t('enter_tracking')}
                autoCapitalize="characters"
                placeholderTextColor={Colors.textTertiary}
                onSubmitEditing={() => handleTrack()}
              />
              <TouchableOpacity
                testID="track-submit"
                style={[styles.searchBtn, !code.trim() && styles.searchBtnDisabled]}
                onPress={() => handleTrack()}
                disabled={!code.trim() || loading}
              >
                {loading ? <ActivityIndicator color={Colors.white} size="small" /> : <Ionicons name="search" size={22} color={Colors.white} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error !== '' && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Result */}
          {parcel && sc && (
            <View style={styles.resultCard}>
              {/* Top */}
              <View style={styles.resultHeader}>
                <Text style={styles.trackingCode}>{parcel.tracking_code}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{STATUS_LABELS[parcel.status]}</Text>
                </View>
              </View>

              {/* Route */}
              <View style={styles.routeRow}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.routeLabel}>From</Text>
                  <Text style={styles.routeName}>{parcel.origin_locker_name}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: Colors.green }]} />
                  <Text style={styles.routeLabel}>To</Text>
                  <Text style={styles.routeName}>{parcel.destination_locker_name}</Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.detailsRow}>
                <Detail icon="person" label="Recipient" value={parcel.recipient_name} />
                <Detail icon="cube" label="Size" value={parcel.size?.charAt(0).toUpperCase() + parcel.size?.slice(1)} />
                <Detail icon="cash" label="Payment" value={parcel.payment_status} />
              </View>

              {/* Timeline */}
              <Text style={styles.timelineTitle}>Status History</Text>
              {parcel.status_history?.slice().reverse().map((h: any, i: number) => (
                <View key={i} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, i === 0 && { backgroundColor: Colors.primary }]} />
                  {i < parcel.status_history.length - 1 && <View style={styles.timelineConnector} />}
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineStatus, i === 0 && { color: Colors.primary }]}>
                      {STATUS_LABELS[h.status] || h.status}
                    </Text>
                    <Text style={styles.timelineNote}>{h.note}</Text>
                    <Text style={styles.timelineDate}>
                      {new Date(h.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty state */}
          {!parcel && !loading && !error && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>Enter your tracking code to see the parcel status</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Detail({ icon, label, value }: any) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  searchCard: {
    margin: 20, backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  searchLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 52, backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16,
    fontSize: 16, color: Colors.textPrimary, fontWeight: '600',
  },
  searchBtn: {
    width: 52, height: 52, backgroundColor: Colors.primary,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20,
    backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, gap: 10, marginBottom: 12,
  },
  errorText: { color: Colors.error, fontSize: 14, fontWeight: '500', flex: 1 },
  resultCard: {
    margin: 20, backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trackingCode: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  routePoint: { flex: 1, alignItems: 'center' },
  routeDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 4 },
  routeLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  routeName: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  routeLine: { flex: 0.5, height: 2, backgroundColor: Colors.border, marginBottom: 24 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: Colors.background, borderRadius: 12, padding: 14 },
  detail: { alignItems: 'center', flex: 1, gap: 4 },
  detailLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  detailValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 12 },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.textTertiary, marginTop: 4, marginRight: 12, flexShrink: 0 },
  timelineConnector: { position: 'absolute', left: 5, top: 16, width: 2, height: 20, backgroundColor: Colors.border },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  timelineNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 3 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
