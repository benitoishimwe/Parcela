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
import { Colors, STATUS_COLORS, STATUS_LABELS, STATUS_ICONS, Shadows } from '../../constants/Colors';
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
    { key: 'all', label: 'All', icon: 'layers-outline' },
    { key: 'active', label: 'Active', icon: 'time-outline' },
    { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline' },
    { key: 'returned', label: 'Returned', icon: 'return-down-back-outline' },
  ];

  const filtered = parcels.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return !['delivered', 'returned'].includes(p.status);
    return p.status === filter;
  });

  const activeCount = parcels.filter(p => !['delivered', 'returned'].includes(p.status)).length;
  const deliveredCount = parcels.filter(p => p.status === 'delivered').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('history')}</Text>
          <Text style={styles.count}>{parcels.length} parcels total</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary strip */}
      {!loading && parcels.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{activeCount}</Text>
            <Text style={styles.summaryLbl}>Active</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{deliveredCount}</Text>
            <Text style={styles.summaryLbl}>Delivered</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{parcels.length - activeCount - deliveredCount}</Text>
            <Text style={styles.summaryLbl}>Other</Text>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            testID={`filter-${f.key}`}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons
              name={f.icon as any}
              size={14}
              color={filter === f.key ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.parcel_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIcon}>📭</Text>
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'No parcels yet' : `No ${filter} parcels`}
              </Text>
              <Text style={styles.emptyBody}>
                {filter === 'all'
                  ? 'Send your first parcel to see it here'
                  : 'Try a different filter'}
              </Text>
              {filter === 'all' && (
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => router.push('/(user)/send')}
                >
                  <Ionicons name="send" size={14} color={Colors.white} />
                  <Text style={styles.sendBtnText}>{t('send_parcel')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.status] || { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
            const icon = STATUS_ICONS[item.status] || '📦';
            const isActive = !['delivered', 'returned'].includes(item.status);

            return (
              <TouchableOpacity
                testID={`history-parcel-${item.parcel_id}`}
                style={styles.card}
                onPress={() => router.push({
                  pathname: '/(user)/qrcode',
                  params: {
                    parcelId: item.parcel_id,
                    qrData: item.qr_data || `PARCELA:${item.parcel_id}`,
                    trackingCode: item.tracking_code,
                    recipientName: item.recipient_name,
                    destinationLocker: item.destination_locker_name,
                    pickupCode: item.qr_code,
                  },
                })}
              >
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: sc.bg }]}>
                    <Text style={styles.iconEmoji}>{icon}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.trackingRow}>
                      <Text style={styles.tracking}>{item.tracking_code}</Text>
                      {isActive && <View style={[styles.liveDot, { backgroundColor: sc.dot }]} />}
                    </View>
                    <Text style={styles.route} numberOfLines={1}>
                      {item.origin_locker_name} → {item.destination_locker_name}
                    </Text>
                    <Text style={styles.recipient} numberOfLines={1}>To: {item.recipient_name}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>
                        {STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                    {item.price && (
                      <Text style={styles.price}>{item.price?.toLocaleString()} RWF</Text>
                    )}
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.sizeChip}>
                    <Ionicons name="cube-outline" size={12} color={Colors.textTertiary} />
                    <Text style={styles.sizeText}>
                      {item.size ? item.size.charAt(0).toUpperCase() + item.size.slice(1) : '—'}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                </View>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  count: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },

  summaryStrip: {
    flexDirection: 'row', backgroundColor: Colors.white,
    marginHorizontal: 16, borderRadius: 14, paddingVertical: 12,
    ...Shadows.sm, marginBottom: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  summaryLbl: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  filterScroll: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },

  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },

  card: {
    backgroundColor: Colors.white, borderRadius: 18, padding: 14,
    ...Shadows.card,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tracking: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  route: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  recipient: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700' },
  price: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 8,
  },
  sizeChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sizeText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  dateText: { flex: 1, fontSize: 11, color: Colors.textTertiary },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIcon: { fontSize: 38 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 4,
  },
  sendBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
