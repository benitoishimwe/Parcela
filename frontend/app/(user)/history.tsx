import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

export default function History() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchParcels = useCallback(async () => {
    try {
      const data = await api.get('/api/parcels/my', token || undefined);
      setParcels(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchParcels(); }, [fetchParcels]);
  const onRefresh = () => { setRefreshing(true); fetchParcels(); };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const filtered = parcels.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return !['delivered', 'returned'].includes(p.status);
    return p.status === filter;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('history')}</Text>
        <Text style={styles.count}>{parcels.length} total</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            testID={`filter-${f.key}`}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.parcel_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>{t('no_parcels')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.status] || { bg: '#F1F5F9', text: '#64748B' };
            return (
              <TouchableOpacity
                testID={`history-parcel-${item.parcel_id}`}
                style={styles.card}
                onPress={() => router.push({
                  pathname: '/(user)/qrcode',
                  params: {
                    parcelId: item.parcel_id,
                    qrData: item.qr_data || `AKABATI:${item.parcel_id}`,
                    trackingCode: item.tracking_code,
                    recipientName: item.recipient_name,
                    destinationLocker: item.destination_locker_name,
                    pickupCode: item.qr_code,
                  },
                })}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.sizeIcon, { backgroundColor: sc.bg }]}>
                    <Text style={{ fontSize: 20 }}>
                      {item.size === 'small' ? '📮' : item.size === 'large' ? '🗃️' : '📦'}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.tracking}>{item.tracking_code}</Text>
                    <Text style={styles.route}>
                      {item.origin_locker_name} → {item.destination_locker_name}
                    </Text>
                    <Text style={styles.recipient}>To: {item.recipient_name}</Text>
                  </View>
                  <View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>
                        {STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                    <Text style={styles.price}>{item.price?.toLocaleString()} RWF</Text>
                  </View>
                </View>
                <Text style={styles.dateText}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  count: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', gap: 12 },
  sizeIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  tracking: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  route: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  recipient: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-end', marginBottom: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  price: { fontSize: 12, fontWeight: '700', color: Colors.primary, textAlign: 'right' },
  dateText: { fontSize: 11, color: Colors.textTertiary, marginTop: 8 },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
});
