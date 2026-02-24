import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

export default function CourierDashboard() {
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.get('/api/courier/tasks', token || undefined);
      setTasks(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  const onRefresh = () => { setRefreshing(true); fetchTasks(); };

  const handleComplete = async (taskId: string) => {
    Alert.alert(t('confirm'), 'Mark this task as completed?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('complete'), onPress: async () => {
          try {
            await api.put(`/api/courier/tasks/${taskId}/complete`, {}, token || undefined);
            fetchTasks();
          } catch (err: any) {
            Alert.alert(t('error'), err.message);
          }
        }
      },
    ]);
  };

  const pending = tasks.filter(t => t.status === 'pending').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, Courier 🚚</Text>
          <Text style={styles.name}>{user?.name}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="time-outline" label="Pending" value={pending} color={Colors.warning} />
        <StatCard icon="checkmark-circle-outline" label="Done Today" value={completed} color={Colors.green} />
      </View>

      <Text style={styles.sectionTitle}>{t('my_tasks')}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item.task_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>{t('no_tasks')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isCollect = item.type === 'collect';
            const isDone = item.status === 'completed';
            return (
              <View testID={`task-${item.task_id}`} style={[styles.taskCard, isDone && styles.taskDone]}>
                <View style={styles.taskTop}>
                  <View style={[styles.taskIcon, { backgroundColor: isCollect ? Colors.primaryLight : Colors.greenLight }]}>
                    <Ionicons
                      name={isCollect ? 'arrow-up-circle' : 'arrow-down-circle'}
                      size={26}
                      color={isCollect ? Colors.primary : Colors.green}
                    />
                  </View>
                  <View style={styles.taskInfo}>
                    <Text style={styles.taskType}>
                      {isCollect ? `📤 ${t('collect')}` : `📥 ${t('deliver')}`}
                    </Text>
                    <Text style={styles.taskLocker}>{item.locker_name}</Text>
                    <Text style={styles.taskCount}>{item.parcel_count} parcels</Text>
                  </View>
                  {isDone ? (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneBadgeText}>Done</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      testID={`complete-task-${item.task_id}`}
                      style={styles.completeBtn}
                      onPress={() => handleComplete(item.task_id)}
                    >
                      <Ionicons name="checkmark" size={20} color={Colors.white} />
                      <Text style={styles.completeBtnText}>{t('complete')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.taskDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color }: any) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  greeting: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  logoutBtn: { padding: 8 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, marginBottom: 4 },
  taskCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  taskDone: { opacity: 0.6 },
  taskTop: { flexDirection: 'row', alignItems: 'center' },
  taskIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  taskInfo: { flex: 1 },
  taskType: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  taskLocker: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  taskCount: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  completeBtn: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  completeBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  doneBadge: { backgroundColor: Colors.greenLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  doneBadgeText: { color: Colors.green, fontSize: 13, fontWeight: '700' },
  taskDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 8 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: Colors.textSecondary },
});
