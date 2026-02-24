import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

const STATUS_OPTS = ['active', 'maintenance', 'offline'];
const STATUS_COLORS_MAP: Record<string, string> = {
  active: Colors.green,
  maintenance: Colors.warning,
  offline: Colors.error,
};

export default function AdminLockers() {
  const { token } = useAuth();
  const [lockers, setLockers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLockers = async () => {
    try {
      const data = await api.get('/api/admin/lockers', token || undefined);
      setLockers(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchLockers(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchLockers(); };

  const handleStatusChange = (locker: any) => {
    const opts = STATUS_OPTS.filter(s => s !== locker.status);
    Alert.alert(
      `${locker.name}`,
      `Current status: ${locker.status}`,
      [
        ...opts.map(status => ({
          text: `Set ${status}`,
          style: status === 'offline' ? 'destructive' : 'default' as any,
          onPress: async () => {
            try {
              await api.put(`/api/admin/lockers/${locker.locker_id}`, { status }, token || undefined);
              fetchLockers();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Lockers</Text>
        <Text style={styles.count}>{lockers.filter(l => l.status === 'active').length} active</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={lockers}
          keyExtractor={item => item.locker_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <View testID={`admin-locker-${item.locker_id}`} style={styles.lockerCard}>
              <View style={styles.lockerTop}>
                <View style={styles.lockerIcon}>
                  <Text style={{ fontSize: 22 }}>📦</Text>
                </View>
                <View style={styles.lockerInfo}>
                  <Text style={styles.lockerName}>{item.name}</Text>
                  <Text style={styles.lockerAddr}>{item.address}</Text>
                  <Text style={styles.lockerDistrict}>{item.district}</Text>
                </View>
                <TouchableOpacity
                  testID={`locker-status-${item.locker_id}`}
                  style={[styles.statusBtn, { backgroundColor: STATUS_COLORS_MAP[item.status] + '20' }]}
                  onPress={() => handleStatusChange(item)}
                >
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS_MAP[item.status] }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLORS_MAP[item.status] }]}>{item.status}</Text>
                </TouchableOpacity>
              </View>
              {item.status === 'active' && (
                <View style={styles.compartments}>
                  {[
                    { size: 'S', avail: item.available_small, total: item.total_small },
                    { size: 'M', avail: item.available_medium, total: item.total_medium },
                    { size: 'L', avail: item.available_large, total: item.total_large },
                  ].map(c => (
                    <View key={c.size} style={styles.compItem}>
                      <Text style={styles.compSize}>{c.size}</Text>
                      <Text style={styles.compCount}>{c.avail}/{c.total}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
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
  lockerCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  lockerTop: { flexDirection: 'row', alignItems: 'center' },
  lockerIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  lockerInfo: { flex: 1 },
  lockerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  lockerAddr: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  lockerDistrict: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  compartments: { flexDirection: 'row', gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  compItem: { flex: 1, alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 8 },
  compSize: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  compCount: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
});
