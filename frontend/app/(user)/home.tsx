import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

export default function Home() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('good_morning');
    if (h < 17) return t('good_afternoon');
    return t('good_evening');
  };

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

  const QUICK_ACTIONS = [
    { key: 'send', icon: 'send', label: t('send_parcel'), color: Colors.primary, route: '/(user)/send' },
    { key: 'track', icon: 'search', label: t('track_parcel'), color: Colors.green, route: '/(user)/track' },
    { key: 'map', icon: 'map', label: t('find_lockers'), color: Colors.yellow, textColor: Colors.textPrimary, route: '/(user)/map' },
    { key: 'history', icon: 'list', label: t('history'), color: Colors.textSecondary, route: '/(user)/history' },
  ];

  const activeCount = parcels.filter(p => !['delivered', 'returned'].includes(p.status)).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName} testID="user-name">{user?.name?.split(' ')[0] || 'User'} 👋</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(user)/profile')}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </TouchableOpacity>
        </View>

        {/* Active parcel banner */}
        {activeCount > 0 && (
          <TouchableOpacity
            testID="active-parcels-banner"
            style={styles.banner}
            onPress={() => router.push('/(user)/history')}
          >
            <Ionicons name="cube" size={20} color={Colors.white} />
            <Text style={styles.bannerText}>
              {activeCount} parcel{activeCount !== 1 ? 's' : ''} in progress
            </Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.key}
              testID={`action-${action.key}`}
              style={[styles.actionCard, { backgroundColor: action.color }]}
              onPress={() => router.push(action.route as any)}
            >
              <Ionicons name={action.icon as any} size={28} color={action.textColor || Colors.white} />
              <Text style={[styles.actionLabel, { color: action.textColor || Colors.white }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Parcels */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('recent_parcels')}</Text>
          {parcels.length > 3 && (
            <TouchableOpacity onPress={() => router.push('/(user)/history')}>
              <Text style={styles.viewAll}>{t('view_all')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : parcels.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>{t('no_parcels')}</Text>
            <TouchableOpacity
              testID="send-first-parcel"
              style={styles.emptyBtn}
              onPress={() => router.push('/(user)/send')}
            >
              <Text style={styles.emptyBtnText}>{t('send_parcel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          parcels.slice(0, 3).map(parcel => (
            <ParcelCard key={parcel.parcel_id} parcel={parcel} onPress={() =>
              router.push({ pathname: '/(user)/qrcode', params: { parcelId: parcel.parcel_id, qrData: parcel.qr_data, trackingCode: parcel.tracking_code, recipientName: parcel.recipient_name, destinationLocker: parcel.destination_locker_name, pickupCode: parcel.qr_code } })
            } />
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ParcelCard({ parcel, onPress }: { parcel: any; onPress: () => void }) {
  const sc = STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B' };
  return (
    <TouchableOpacity testID={`parcel-card-${parcel.parcel_id}`} style={styles.parcelCard} onPress={onPress}>
      <View style={styles.parcelRow}>
        <View style={[styles.parcelIcon, { backgroundColor: sc.bg }]}>
          <Text style={{ fontSize: 20 }}>📦</Text>
        </View>
        <View style={styles.parcelInfo}>
          <Text style={styles.parcelTracking}>{parcel.tracking_code}</Text>
          <Text style={styles.parcelTo}>→ {parcel.destination_locker_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>
            {STATUS_LABELS[parcel.status] || parcel.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  greeting: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  avatar: {
    width: 44, height: 44, backgroundColor: Colors.primary,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  banner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.green,
    marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 8, gap: 10,
  },
  bannerText: { flex: 1, color: Colors.white, fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  viewAll: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  actionCard: {
    width: '47%', borderRadius: 16, padding: 18,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  actionLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  emptyCard: {
    margin: 20, backgroundColor: Colors.white, borderRadius: 16,
    padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  parcelCard: {
    backgroundColor: Colors.white, marginHorizontal: 20, marginBottom: 10,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  parcelRow: { flexDirection: 'row', alignItems: 'center' },
  parcelIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  parcelInfo: { flex: 1 },
  parcelTracking: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  parcelTo: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
});
