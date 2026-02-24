import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

export default function AdminDashboard() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [recentParcels, setRecentParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [s, p] = await Promise.all([
        api.get('/api/admin/stats', token || undefined),
        api.get('/api/admin/parcels', token || undefined),
      ]);
      setStats(s);
      setRecentParcels(p.slice(0, 5));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const STAT_CARDS = stats ? [
    { label: 'Active Lockers', value: stats.active_lockers, total: stats.total_lockers, icon: 'cube', color: Colors.primary },
    { label: 'Users', value: stats.total_users, icon: 'people', color: Colors.green },
    { label: 'Couriers', value: stats.total_couriers, icon: 'bicycle', color: Colors.yellow, textColor: Colors.textPrimary },
    { label: 'In Transit', value: stats.in_transit, icon: 'car', color: Colors.warning },
    { label: 'Ready Pickup', value: stats.ready_for_pickup, icon: 'bag-check', color: Colors.primary },
    { label: 'Delivered', value: stats.delivered, icon: 'checkmark-circle', color: Colors.green },
  ] : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Admin Panel</Text>
            <Text style={styles.title}>Akabati Network</Text>
          </View>
          <TouchableOpacity style={styles.userBtn} onPress={() => router.push('/(user)/home')}>
            <Ionicons name="person-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Total Parcels Banner */}
            <View style={styles.banner}>
              <View>
                <Text style={styles.bannerLabel}>Total Parcels</Text>
                <Text testID="total-parcels" style={styles.bannerValue}>{stats?.total_parcels}</Text>
              </View>
              <Ionicons name="analytics" size={48} color="rgba(255,255,255,0.3)" />
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {STAT_CARDS.map((card, i) => (
                <View key={i} testID={`stat-${card.label}`} style={[styles.statCard, { borderTopColor: card.color }]}>
                  <Ionicons name={card.icon as any} size={22} color={card.color} />
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                  {card.total && <Text style={styles.statTotal}>of {card.total}</Text>}
                </View>
              ))}
            </View>

            {/* Recent Parcels */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Parcels</Text>
            </View>

            {recentParcels.map(p => (
              <View key={p.parcel_id} testID={`admin-parcel-${p.parcel_id}`} style={styles.parcelRow}>
                <View style={styles.parcelLeft}>
                  <Text style={styles.parcelTracking}>{p.tracking_code}</Text>
                  <Text style={styles.parcelRoute}>{p.origin_locker_name} → {p.destination_locker_name}</Text>
                </View>
                <View style={[styles.statusDot, {
                  backgroundColor: p.status === 'delivered' ? Colors.green :
                    p.status === 'in_transit' ? Colors.warning : Colors.primary
                }]} />
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  greeting: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  userBtn: {
    width: 40, height: 40, backgroundColor: Colors.primaryLight,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primary, marginHorizontal: 20, borderRadius: 16, padding: 20, marginBottom: 16,
  },
  bannerLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 4 },
  bannerValue: { fontSize: 40, fontWeight: '900', color: Colors.white },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    borderTopWidth: 3, alignItems: 'flex-start', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  statTotal: { fontSize: 11, color: Colors.textTertiary },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  parcelRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    marginHorizontal: 20, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  parcelLeft: { flex: 1 },
  parcelTracking: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  parcelRoute: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
});
