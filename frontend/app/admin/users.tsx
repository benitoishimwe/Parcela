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

const ROLES = ['user', 'courier', 'admin'];
const ROLE_COLORS: Record<string, string> = {
  user: Colors.primary,
  courier: Colors.green,
  admin: Colors.yellow,
};

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await api.get('/api/admin/users', token || undefined);
      setUsers(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchUsers(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  const handleRoleChange = (userId: string, currentRole: string, userName: string) => {
    const options = ROLES.filter(r => r !== currentRole);
    Alert.alert(
      `Change Role: ${userName}`,
      `Current: ${currentRole}`,
      [
        ...options.map(role => ({
          text: `Set as ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          onPress: async () => {
            try {
              await api.put(`/api/admin/users/${userId}/role`, { role }, token || undefined);
              fetchUsers();
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
        <Text style={styles.title}>Users</Text>
        <Text style={styles.count}>{users.length} total</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.user_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <View testID={`user-${item.user_id}`} style={styles.userCard}>
              <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] || Colors.primary }]}>
                <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userContact}>{item.phone || item.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>
                    {item.role}
                  </Text>
                </View>
              </View>
              {item.email !== 'benishimwe31@gmail.com' && (
                <TouchableOpacity
                  testID={`change-role-${item.user_id}`}
                  style={styles.roleBtn}
                  onPress={() => handleRoleChange(item.user_id, item.role, item.name)}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
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
  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  userContact: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  roleText: { fontSize: 11, fontWeight: '700' },
  roleBtn: { padding: 8 },
});
