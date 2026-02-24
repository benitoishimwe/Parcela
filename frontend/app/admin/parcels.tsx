import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

const STATUS_ORDER = ['awaiting_payment', 'awaiting_dropoff', 'dropped_off', 'in_transit', 'ready_for_pickup', 'delivered', 'returned'];

export default function AdminParcels() {
  const { token } = useAuth();
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchParcels = async () => {
    try {
      const data = await api.get('/api/admin/parcels', token || undefined);
      setParcels(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchParcels(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchParcels(); };

  const handleStatusUpdate = (parcelId: string, currentStatus: string) => {
    const next = STATUS_ORDER.filter(s => s !== currentStatus);
    Alert.alert('Update Status', `Current: ${STATUS_LABELS[currentStatus]}`, [
      ...next.slice(0, 4).map(s => ({
        text: STATUS_LABELS[s],
        onPress: async () => {
          try {
            await api.put(`/api/parcels/${parcelId}/status`, { status: s, note: 'Updated by admin' }, token || undefined);
            fetchParcels();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'ready_for_pickup', label: 'Ready' },
    { key: 'delivered', label: 'Done' },
  ];

  const filtered = parcels.filter(p => filter === 'all' || p.status === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Parcels</Text>
        <Text style={styles.count}>{parcels.length} total</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            testID={`parcel-filter-${f.key}`}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.parcel_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No parcels found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.status] || { bg: '#F1F5F9', text: '#64748B' };
            return (
              <View testID={`admin-parcel-item-${item.parcel_id}`} style={styles.parcelCard}>
                <View style={styles.parcelTop}>
                  <View style={styles.parcelLeft}>
                    <Text style={styles.tracking}>{item.tracking_code}</Text>
                    <Text style={styles.route}>{item.origin_locker_name} → {item.destination_locker_name}</Text>
                    <Text style={styles.recipient}>
                      📤 {item.sender_name} → 📥 {item.recipient_name}
                    </Text>
                  </View>
                  <View style={styles.parcelRight}>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>
                        {STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                    <Text style={styles.price}>{item.price?.toLocaleString()} RWF</Text>
                    <Text style={styles.size}>{item.size}</Text>
                  </View>
                </View>
                <View style={styles.parcelActions}>
                  <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  <TouchableOpacity
                    testID={`update-status-${item.parcel_id}`}
                    style={styles.updateBtn}
                    onPress={() => handleStatusUpdate(item.parcel_id, item.status)}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
                    <Text style={styles.updateBtnText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  count: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  parcelCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  parcelTop: { flexDirection: 'row', gap: 10 },
  parcelLeft: { flex: 1 },
  parcelRight: { alignItems: 'flex-end', gap: 4 },
  tracking: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  route: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  recipient: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  price: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  size: { fontSize: 11, color: Colors.textTertiary, textTransform: 'capitalize' },
  parcelActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  dateText: { fontSize: 11, color: Colors.textTertiary },
  updateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  updateBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
});
