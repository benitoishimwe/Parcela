import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

const TYPE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  ready_for_pickup: { icon: '📬', color: Colors.green, bg: Colors.greenLight },
  in_transit: { icon: '🚚', color: Colors.warning, bg: '#FEF3C7' },
  dropped_off: { icon: '📥', color: Colors.primaryDark, bg: Colors.primaryLight },
  delivered: { icon: '✅', color: Colors.green, bg: Colors.greenLight },
  awaiting_dropoff: { icon: '📋', color: Colors.primary, bg: Colors.primaryLight },
  default: { icon: '🔔', color: Colors.primary, bg: Colors.primaryLight },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Notifications() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get('/api/notifications', token);
      setNotifications(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

  const markAsRead = async (notifId: string) => {
    try {
      await api.put(`/api/notifications/${notifId}/read`, {}, token || undefined);
      setNotifications(prev =>
        prev.map(n => n.notification_id === notifId ? { ...n, read: true } : n)
      );
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all', {}, token || undefined);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity testID="mark-all-read" onPress={markAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 80 }} />}
      </View>

      {/* Unread count pill */}
      {unreadCount > 0 && (
        <View style={styles.unreadPill}>
          <View style={styles.unreadDot} />
          <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.notification_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>You'll be notified when your parcel status changes</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = TYPE_ICONS[item.type] || TYPE_ICONS.default;
            return (
              <TouchableOpacity
                testID={`notif-${item.notification_id}`}
                style={[styles.notifCard, !item.read && styles.notifUnread]}
                onPress={() => {
                  markAsRead(item.notification_id);
                  if (item.tracking_code) {
                    router.push({ pathname: '/(user)/track', params: { code: item.tracking_code } });
                  }
                }}
              >
                <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
                  <Text style={styles.notifIconText}>{meta.icon}</Text>
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifRow}>
                    <Text style={[styles.notifTitle, !item.read && styles.notifTitleBold]}>
                      {item.title}
                    </Text>
                    {!item.read && <View style={[styles.unreadDot, { backgroundColor: Colors.primary }]} />}
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                  <View style={styles.notifFooter}>
                    {item.tracking_code && (
                      <Text style={styles.notifCode}>{item.tracking_code}</Text>
                    )}
                    <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={Colors.textTertiary}
                />
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  markAllText: { fontSize: 13, color: Colors.primary, fontWeight: '600', width: 80, textAlign: 'right' },
  unreadPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start',
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  unreadText: { fontSize: 13, color: Colors.primaryDark, fontWeight: '600' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.white,
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  notifUnread: {
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  notifIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  notifIconText: { fontSize: 22 },
  notifContent: { flex: 1 },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
  notifTitleBold: { fontWeight: '700' },
  notifBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6 },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifCode: {
    fontSize: 11, color: Colors.primary, fontWeight: '700',
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: 10,
  },
  notifTime: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
