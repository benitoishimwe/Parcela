import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

// ── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
  color: string; bg: string; icon: string; label: string;
  description: string; permissions: string[];
}> = {
  user: {
    color: Colors.primary,
    bg: Colors.primaryLight,
    icon: '👤',
    label: 'User',
    description: 'Can send and receive parcels, track deliveries, and manage their account.',
    permissions: ['Send parcels', 'Track deliveries', 'View history', 'Manage profile'],
  },
  courier: {
    color: Colors.green,
    bg: Colors.greenLight,
    icon: '🚚',
    label: 'Courier',
    description: 'Can pick up and deliver parcels, scan QR codes, and update parcel status.',
    permissions: ['Pick up parcels', 'Deliver parcels', 'Scan QR codes', 'Update parcel status'],
  },
  admin: {
    color: Colors.yellowDark,
    bg: Colors.yellowLight,
    icon: '🛡️',
    label: 'Admin',
    description: 'Full access. Can manage all users, parcels, lockers, and system settings.',
    permissions: ['Manage all users', 'Manage parcels', 'Manage lockers', 'View analytics', 'Change roles'],
  },
};

const COURIER_REGIONS = ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'];
const COURIER_STATUSES = ['active', 'inactive', 'on_leave'] as const;
const PAGE_SIZE = 10;

type RoleStep = 'select' | 'confirm' | 'courier_fields';

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const { token, loading: authLoading } = useAuth();

  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [allParcels, setAllParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Search + filter + pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'courier' | 'admin'>('all');
  const [page, setPage] = useState(1);

  // Role change flow
  const [roleTarget, setRoleTarget] = useState<any>(null);
  const [roleStep, setRoleStep] = useState<RoleStep>('select');
  const [pendingRole, setPendingRole] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState('');

  // Courier-specific fields
  const [courierStatus, setCourierStatus] = useState<typeof COURIER_STATUSES[number]>('active');
  const [maxParcels, setMaxParcels] = useState('5');
  const [assignedRegion, setAssignedRegion] = useState('Kigali');

  // Profile modal
  const [profileUser, setProfileUser] = useState<any>(null);

  // Add user modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<'user' | 'courier' | 'admin'>('user');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [userData, parcelData] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/parcels'),
      ]);
      setUsers(Array.isArray(userData) ? userData : []);
      setAllParcels(Array.isArray(parcelData) ? parcelData : []);
      setFetchError('');
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load users');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading]);
  const onRefresh = () => { setRefreshing(true); setPage(1); fetchData(); };

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter(u => {
      const matchesSearch = !q ||
        u.name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const displayedUsers = useMemo(
    () => filteredUsers.slice(0, page * PAGE_SIZE),
    [filteredUsers, page],
  );

  const hasMore = displayedUsers.length < filteredUsers.length;

  const userCount    = users.filter(u => u.role === 'user').length;
  const courierCount = users.filter(u => u.role === 'courier').length;
  const adminCount   = users.filter(u => u.role === 'admin').length;

  const parcelCountFor = (userId: string) =>
    allParcels.filter(p => p.sender_id === userId || p.recipient_id === userId).length;

  // ── Role change flow ───────────────────────────────────────────────────────

  const openRolePicker = (item: any) => {
    setRoleTarget(item);
    setRoleStep('select');
    setPendingRole('');
    setRoleError('');
    setCourierStatus('active');
    setMaxParcels('5');
    setAssignedRegion('Kigali');
  };

  const selectRole = (role: string) => {
    setPendingRole(role);
    setRoleStep('confirm');
  };

  const confirmRole = async () => {
    if (pendingRole === 'courier') {
      setRoleStep('courier_fields');
      return;
    }
    await doApplyRole();
  };

  const doApplyRole = async () => {
    setRoleLoading(true);
    setRoleError('');
    try {
      const body: Record<string, any> = { role: pendingRole };
      if (pendingRole === 'courier') {
        body.courier_status = courierStatus;
        body.max_parcels    = parseInt(maxParcels, 10) || 5;
        body.region         = assignedRegion;
      }
      await api.put(`/api/admin/users/${roleTarget.user_id}/role`, body, token || undefined);
      closeRolePicker();
      fetchData();
    } catch (err: any) {
      setRoleError(err.message || 'Failed to update role');
    } finally {
      setRoleLoading(false);
    }
  };

  const closeRolePicker = () => {
    setRoleTarget(null);
    setRoleStep('select');
    setPendingRole('');
    setRoleError('');
  };

  // ── Add user ───────────────────────────────────────────────────────────────

  const handleAddUser = async () => {
    if (!addName.trim() || !addPhone.trim() || !addPassword.trim()) {
      setAddError('Name, phone, and password are required'); return;
    }
    if (addPassword.length < 6) { setAddError('Password must be at least 6 characters'); return; }
    setAddLoading(true); setAddError('');
    try {
      const result = await api.post('/api/auth/signup', {
        name: addName.trim(), phone: addPhone.trim(),
        email: addEmail.trim() || undefined, password: addPassword,
      });
      if (addRole !== 'user') {
        await api.put(`/api/admin/users/${result.user.user_id}/role`, { role: addRole }, token || undefined);
      }
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create user');
    } finally { setAddLoading(false); }
  };

  const openAddModal = () => {
    // Reset all fields explicitly before opening so browser autofill from a
    // previous session doesn't persist across modal openings.
    setAddName('');
    setAddPhone('');
    setAddEmail('');
    setAddPassword('');
    setAddRole('user');
    setAddError('');
    setShowAddModal(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>ADMIN · USERS</Text>
            <Text style={styles.heroTitle}>Users</Text>
          </View>
          <View style={styles.heroRight}>
            <TouchableOpacity testID="add-user-btn" style={styles.addUserBtn} onPress={openAddModal}>
              <Ionicons name="person-add-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.totalPill}>
              <Text style={styles.totalNum}>{users.length}</Text>
              <Text style={styles.totalLbl}>total</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroStats}>
          {(['user', 'courier', 'admin'] as const).map((r, i) => (
            <View key={r} style={{ flexDirection: 'row', flex: 1 }}>
              {i > 0 && <View style={styles.heroStatDivider} />}
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatEmoji}>{ROLE_CONFIG[r].icon}</Text>
                <Text style={styles.heroStatNum}>
                  {r === 'user' ? userCount : r === 'courier' ? courierCount : adminCount}
                </Text>
                <Text style={styles.heroStatLbl}>{ROLE_CONFIG[r].label}s</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Search + Filter ── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={t => { setSearch(t); setPage(1); }}
            placeholder="Search by name, phone or email…"
            placeholderTextColor={Colors.textTertiary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setPage(1); }}>
              <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8 }}>
          {(['all', 'user', 'courier', 'admin'] as const).map(r => {
            const active = roleFilter === r;
            const cfg = r === 'all' ? null : ROLE_CONFIG[r];
            return (
              <TouchableOpacity
                key={r}
                style={[styles.filterChip, active && { backgroundColor: cfg?.color || Colors.textPrimary, borderColor: cfg?.color || Colors.textPrimary }]}
                onPress={() => { setRoleFilter(r); setPage(1); }}
              >
                {cfg && <Text style={styles.filterChipEmoji}>{cfg.icon}</Text>}
                <Text style={[styles.filterChipText, active && { color: Colors.white }]}>
                  {r === 'all' ? 'All Roles' : cfg!.label + 's'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {filteredUsers.length !== users.length && (
          <Text style={styles.resultCount}>
            {filteredUsers.length} of {users.length} users
          </Text>
        )}
      </View>

      {/* ── Error banner ── */}
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── User list ── */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayedUsers}
          keyExtractor={item => item.user_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptyBody}>Try adjusting your search or filter.</Text>
            </View>
          }
          ListFooterComponent={hasMore ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setPage(p => p + 1)}>
              <Text style={styles.loadMoreText}>Load more ({filteredUsers.length - displayedUsers.length} remaining)</Text>
              <Ionicons name="chevron-down" size={14} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
          renderItem={({ item }) => {
            const cfg = ROLE_CONFIG[item.role] || ROLE_CONFIG.user;
            const parcelCount = parcelCountFor(item.user_id);
            return (
              <View testID={`user-${item.user_id}`} style={styles.userCard}>
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: cfg.color }]}>
                  <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
                {/* Info */}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userContact}>{item.phone || item.email || '—'}</Text>
                  <View style={styles.badgeRow}>
                    {/* Role badge */}
                    <View style={[styles.roleBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={styles.roleBadgeEmoji}>{cfg.icon}</Text>
                      <Text style={[styles.roleBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {/* Parcel count pill */}
                    {parcelCount > 0 && (
                      <View style={styles.parcelPill}>
                        <Ionicons name="cube-outline" size={10} color={Colors.textSecondary} />
                        <Text style={styles.parcelPillText}>{parcelCount} parcel{parcelCount !== 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {/* Actions */}
                {item.email !== 'benishimwe31@gmail.com' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      testID={`view-profile-${item.user_id}`}
                      style={styles.profileBtn}
                      onPress={() => setProfileUser(item)}
                    >
                      <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`change-role-${item.user_id}`}
                      style={styles.roleBtn}
                      onPress={() => openRolePicker(item)}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════
          ROLE CHANGE MODAL (multi-step)
      ════════════════════════════════════════════════════ */}
      <Modal visible={!!roleTarget} transparent animationType="slide" onRequestClose={closeRolePicker}>
        <Pressable style={styles.sheetBackdrop} onPress={closeRolePicker} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* ── Step: Select role ── */}
          {roleStep === 'select' && (
            <>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>{roleTarget?.name}</Text>
                  <View style={[styles.currentRoleBadge, { backgroundColor: ROLE_CONFIG[roleTarget?.role]?.bg }]}>
                    <Text style={styles.currentRoleEmoji}>{ROLE_CONFIG[roleTarget?.role]?.icon}</Text>
                    <Text style={[styles.currentRoleText, { color: ROLE_CONFIG[roleTarget?.role]?.color }]}>
                      Currently: {ROLE_CONFIG[roleTarget?.role]?.label}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => { closeRolePicker(); setProfileUser(roleTarget); }} style={styles.viewProfileBtn}>
                  <Ionicons name="person-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.viewProfileBtnText}>View Profile</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sheetSectionLabel}>CHANGE ROLE TO</Text>

              {Object.entries(ROLE_CONFIG)
                .filter(([r]) => r !== roleTarget?.role)
                .map(([r, cfg]) => (
                  <TouchableOpacity key={r} style={styles.roleCard} onPress={() => selectRole(r)}>
                    <View style={[styles.roleCardIcon, { backgroundColor: cfg.bg }]}>
                      <Text style={styles.roleCardEmoji}>{cfg.icon}</Text>
                    </View>
                    <View style={styles.roleCardBody}>
                      <Text style={[styles.roleCardLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      <Text style={styles.roleCardDesc}>{cfg.description}</Text>
                      <View style={styles.permissionsRow}>
                        {cfg.permissions.slice(0, 3).map(p => (
                          <View key={p} style={styles.permChip}>
                            <Text style={styles.permChipText}>{p}</Text>
                          </View>
                        ))}
                        {cfg.permissions.length > 3 && (
                          <Text style={styles.permMore}>+{cfg.permissions.length - 3}</Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                  </TouchableOpacity>
                ))}

              <TouchableOpacity style={styles.cancelBtn} onPress={closeRolePicker}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step: Confirm ── */}
          {roleStep === 'confirm' && pendingRole && (
            <>
              <View style={styles.confirmIconWrap}>
                <Text style={styles.confirmEmoji}>{ROLE_CONFIG[pendingRole]?.icon}</Text>
              </View>
              <Text style={styles.confirmTitle}>
                Set as {ROLE_CONFIG[pendingRole]?.label}?
              </Text>
              <Text style={styles.confirmBody}>
                <Text style={{ fontWeight: '700' }}>{roleTarget?.name}</Text>
                {' will be able to:\n'}
                {ROLE_CONFIG[pendingRole]?.permissions.map(p => `• ${p}`).join('\n')}
              </Text>
              {roleError ? (
                <View style={styles.roleErrorBanner}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                  <Text style={styles.roleErrorText}>{roleError}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: ROLE_CONFIG[pendingRole]?.color }, roleLoading && { opacity: 0.6 }]}
                onPress={confirmRole}
                disabled={roleLoading}
              >
                {roleLoading ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={styles.confirmBtnText}>
                    {pendingRole === 'courier' ? 'Next — Set Courier Details' : 'Confirm'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRoleStep('select')}>
                <Text style={styles.cancelBtnText}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step: Courier fields ── */}
          {roleStep === 'courier_fields' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.confirmIconWrap, { backgroundColor: Colors.greenLight }]}>
                <Text style={styles.confirmEmoji}>🚚</Text>
              </View>
              <Text style={styles.confirmTitle}>Courier Details</Text>
              <Text style={styles.confirmSubtitle}>Optional info to make the courier role operational</Text>

              {/* Courier status */}
              <Text style={styles.fieldLabel}>Courier Status</Text>
              <View style={styles.statusChips}>
                {COURIER_STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, courierStatus === s && styles.statusChipActive]}
                    onPress={() => setCourierStatus(s)}
                  >
                    <Text style={[styles.statusChipText, courierStatus === s && styles.statusChipTextActive]}>
                      {s === 'on_leave' ? 'On Leave' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Max parcels */}
              <Text style={styles.fieldLabel}>Max Parcels per Trip</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setMaxParcels(p => String(Math.max(1, parseInt(p) - 1)))}>
                  <Ionicons name="remove" size={18} color={Colors.green} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{maxParcels}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setMaxParcels(p => String(Math.min(20, parseInt(p) + 1)))}>
                  <Ionicons name="add" size={18} color={Colors.green} />
                </TouchableOpacity>
              </View>

              {/* Assigned region */}
              <Text style={styles.fieldLabel}>Assigned Region</Text>
              <View style={styles.regionGrid}>
                {COURIER_REGIONS.map(reg => (
                  <TouchableOpacity
                    key={reg}
                    style={[styles.regionChip, assignedRegion === reg && styles.regionChipActive]}
                    onPress={() => setAssignedRegion(reg)}
                  >
                    <Text style={[styles.regionChipText, assignedRegion === reg && styles.regionChipTextActive]}>
                      {reg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {roleError ? (
                <View style={styles.roleErrorBanner}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                  <Text style={styles.roleErrorText}>{roleError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: Colors.green }, roleLoading && { opacity: 0.6 }]}
                onPress={doApplyRole}
                disabled={roleLoading}
              >
                {roleLoading ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={styles.confirmBtnText}>Save & Assign as Courier</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRoleStep('confirm')}>
                <Text style={styles.cancelBtnText}>← Back</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════
          FULL PROFILE MODAL
      ════════════════════════════════════════════════════ */}
      <Modal visible={!!profileUser} transparent animationType="slide" onRequestClose={() => setProfileUser(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setProfileUser(null)} />
        <View style={[styles.sheet, { maxHeight: '80%' }]}>
          <View style={styles.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {profileUser && (() => {
              const cfg = ROLE_CONFIG[profileUser.role] || ROLE_CONFIG.user;
              const pCount = parcelCountFor(profileUser.user_id);
              const joined = profileUser.created_at
                ? new Date(profileUser.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—';
              return (
                <>
                  {/* Profile header */}
                  <View style={styles.profileHeaderWrap}>
                    <View style={[styles.profileAvatar, { backgroundColor: cfg.color }]}>
                      <Text style={styles.profileAvatarText}>{profileUser.name?.[0]?.toUpperCase() || 'U'}</Text>
                    </View>
                    <Text style={styles.profileName}>{profileUser.name}</Text>
                    <View style={[styles.profileRoleBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={styles.profileRoleEmoji}>{cfg.icon}</Text>
                      <Text style={[styles.profileRoleText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {/* Account info */}
                  <Text style={styles.sheetSectionLabel}>ACCOUNT INFO</Text>
                  <View style={styles.infoCard}>
                    <InfoRow icon="call-outline" label="Phone" value={profileUser.phone || '—'} />
                    <InfoRow icon="mail-outline" label="Email" value={profileUser.email || '—'} />
                    <InfoRow icon="calendar-outline" label="Joined" value={joined} />
                    <InfoRow icon="finger-print-outline" label="User ID" value={profileUser.user_id} mono />
                  </View>

                  {/* Role permissions */}
                  <Text style={styles.sheetSectionLabel}>PERMISSIONS</Text>
                  <View style={styles.infoCard}>
                    {cfg.permissions.map((p, i) => (
                      <View key={p} style={[styles.permRow, i > 0 && styles.permRowBorder]}>
                        <Ionicons name="checkmark-circle" size={16} color={cfg.color} />
                        <Text style={styles.permRowText}>{p}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Activity */}
                  <Text style={styles.sheetSectionLabel}>ACTIVITY</Text>
                  <View style={styles.activityRow}>
                    <View style={[styles.activityCard, { borderColor: cfg.color + '40' }]}>
                      <Text style={[styles.activityNum, { color: cfg.color }]}>{pCount}</Text>
                      <Text style={styles.activityLbl}>Total Parcels</Text>
                    </View>
                    <View style={[styles.activityCard, { borderColor: Colors.green + '40' }]}>
                      <Text style={[styles.activityNum, { color: Colors.green }]}>
                        {allParcels.filter(p => p.sender_id === profileUser.user_id && p.status === 'delivered').length}
                      </Text>
                      <Text style={styles.activityLbl}>Delivered</Text>
                    </View>
                    <View style={[styles.activityCard, { borderColor: Colors.warning + '40' }]}>
                      <Text style={[styles.activityNum, { color: Colors.warning }]}>
                        {allParcels.filter(p => p.sender_id === profileUser.user_id && !['delivered', 'returned'].includes(p.status)).length}
                      </Text>
                      <Text style={styles.activityLbl}>Active</Text>
                    </View>
                  </View>

                  {/* Recent parcels */}
                  {pCount > 0 && (
                    <>
                      <Text style={styles.sheetSectionLabel}>RECENT PARCELS</Text>
                      {allParcels
                        .filter(p => p.sender_id === profileUser.user_id || p.recipient_id === profileUser.user_id)
                        .slice(0, 4)
                        .map(p => (
                          <View key={p.parcel_id} style={styles.miniParcelRow}>
                            <View style={styles.miniParcelLeft}>
                              <Text style={styles.miniParcelCode}>{p.tracking_code}</Text>
                              <Text style={styles.miniParcelDest} numberOfLines={1}>→ {p.destination_locker_name || 'Unknown'}</Text>
                            </View>
                            <View style={[styles.miniStatusBadge, { backgroundColor: statusBg(p.status) }]}>
                              <Text style={[styles.miniStatusText, { color: statusText(p.status) }]}>
                                {statusLabel(p.status)}
                              </Text>
                            </View>
                          </View>
                        ))}
                    </>
                  )}

                  {profileUser.email !== 'benishimwe31@gmail.com' && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: cfg.color, marginTop: 20 }]}
                      onPress={() => { setProfileUser(null); openRolePicker(profileUser); }}
                    >
                      <Text style={styles.confirmBtnText}>Change Role</Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ height: 28 }} />
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════
          ADD USER MODAL
      ════════════════════════════════════════════════════ */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { maxHeight: '85%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.addModalHeader}>
              <Text style={styles.sheetTitle}>Add New User</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {addError ? (
                <View style={styles.roleErrorBanner}>
                  <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                  <Text style={styles.roleErrorText}>{addError}</Text>
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput testID="add-name" style={styles.fieldInput} value={addName} onChangeText={setAddName} placeholder="John Doe" placeholderTextColor={Colors.textTertiary} autoComplete="off" autoCorrect={false} />
              <Text style={styles.fieldLabel}>Phone *</Text>
              <TextInput testID="add-phone" style={styles.fieldInput} value={addPhone} onChangeText={setAddPhone} placeholder="+250 7XX XXX XXX" keyboardType="phone-pad" placeholderTextColor={Colors.textTertiary} autoComplete="off" />
              <Text style={styles.fieldLabel}>Email (optional)</Text>
              <TextInput testID="add-email" style={styles.fieldInput} value={addEmail} onChangeText={setAddEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textTertiary} autoComplete="off" />
              <Text style={styles.fieldLabel}>Password *</Text>
              <TextInput testID="add-password" style={styles.fieldInput} value={addPassword} onChangeText={setAddPassword} placeholder="Min 6 characters" secureTextEntry placeholderTextColor={Colors.textTertiary} autoComplete="new-password" textContentType="newPassword" />
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.addRoleChips}>
                {(['user', 'courier', 'admin'] as const).map(r => {
                  const cfg = ROLE_CONFIG[r];
                  return (
                    <TouchableOpacity
                      key={r}
                      testID={`add-role-${r}`}
                      style={[styles.addRoleChip, addRole === r && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                      onPress={() => setAddRole(r)}
                    >
                      <Text style={styles.addRoleEmoji}>{cfg.icon}</Text>
                      <Text style={[styles.addRoleChipText, addRole === r && { color: Colors.white }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                testID="add-user-submit"
                style={[styles.confirmBtn, { backgroundColor: Colors.green, marginTop: 20 }, addLoading && { opacity: 0.6 }]}
                onPress={handleAddUser}
                disabled={addLoading}
              >
                {addLoading ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={styles.confirmBtnText}>Create User</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, mono }: { icon: string; label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color={Colors.textTertiary} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, mono && styles.infoMono]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function statusBg(s: string) {
  const map: Record<string, string> = {
    delivered: Colors.greenLight, in_transit: Colors.warningLight,
    awaiting_dropoff: Colors.primaryLight, dropped_off: '#E0E7FF',
    ready_for_pickup: Colors.greenLight, returned: Colors.errorLight,
  };
  return map[s] || Colors.surfaceElevated;
}
function statusText(s: string) {
  const map: Record<string, string> = {
    delivered: Colors.green, in_transit: Colors.warning,
    awaiting_dropoff: Colors.primary, dropped_off: '#4F46E5',
    ready_for_pickup: Colors.green, returned: Colors.error,
  };
  return map[s] || Colors.textSecondary;
}
function statusLabel(s: string) {
  return s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || s;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Hero
  hero: { backgroundColor: Colors.green, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: Colors.white, marginTop: 2 },
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addUserBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  totalPill: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  totalNum: { fontSize: 24, fontWeight: '900', color: Colors.white },
  totalLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 12 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatEmoji: { fontSize: 16, marginBottom: 2 },
  heroStatNum: { fontSize: 20, fontWeight: '900', color: Colors.white },
  heroStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },

  // Search & filter
  searchWrap: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  filterRow: { marginTop: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  filterChipEmoji: { fontSize: 12 },
  filterChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  resultCount: { fontSize: 11, color: Colors.textTertiary, marginTop: 8 },

  // Error
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorLight, borderRadius: 12, margin: 16, padding: 12 },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: '500', flex: 1 },
  retryText: { color: Colors.error, fontWeight: '700', fontSize: 13 },

  // User card
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 18, padding: 14, marginBottom: 10, ...Shadows.card },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  userContact: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleBadgeEmoji: { fontSize: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  parcelPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, backgroundColor: Colors.surfaceElevated },
  parcelPillText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileBtn: { padding: 8 },
  roleBtn: { padding: 8 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyBody: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  // Pagination
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  loadMoreText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },

  // Sheet (bottom modal)
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sheetSectionLabel: { fontSize: 10, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },

  // Current role (in select step)
  currentRoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  currentRoleEmoji: { fontSize: 11 },
  currentRoleText: { fontSize: 11, fontWeight: '700' },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary },
  viewProfileBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },

  // Role option cards
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1.5, borderColor: Colors.border },
  roleCardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleCardEmoji: { fontSize: 20 },
  roleCardBody: { flex: 1 },
  roleCardLabel: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  roleCardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: 6 },
  permissionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  permChip: { backgroundColor: Colors.surfaceElevated, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  permChipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  permMore: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', alignSelf: 'center' },

  // Confirm step
  confirmIconWrap: { width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  confirmEmoji: { fontSize: 36 },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  confirmSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 14 },
  confirmBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  confirmBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  confirmBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  // Courier fields
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  fieldInput: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, height: 48, fontSize: 15, color: Colors.textPrimary },
  statusChips: { flexDirection: 'row', gap: 8 },
  statusChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  statusChipActive: { backgroundColor: Colors.green, borderColor: Colors.green },
  statusChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  statusChipTextActive: { color: Colors.white },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.green, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.greenLight },
  stepperVal: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, minWidth: 30, textAlign: 'center' },
  regionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  regionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  regionChipActive: { backgroundColor: Colors.green, borderColor: Colors.green },
  regionChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  regionChipTextActive: { color: Colors.white },

  // Role error
  roleErrorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.errorLight, borderRadius: 10, padding: 10, marginBottom: 12 },
  roleErrorText: { flex: 1, color: Colors.error, fontSize: 12, fontWeight: '500' },

  // Cancel
  cancelBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },

  // Profile modal
  profileHeaderWrap: { alignItems: 'center', paddingVertical: 20 },
  profileAvatar: { width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileAvatarText: { fontSize: 32, fontWeight: '800', color: Colors.white },
  profileName: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  profileRoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  profileRoleEmoji: { fontSize: 14 },
  profileRoleText: { fontSize: 13, fontWeight: '700' },

  // Info card
  infoCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoLabel: { fontSize: 10, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginTop: 1 },
  infoMono: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12 },

  // Permissions in profile
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  permRowBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  permRowText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

  // Activity cards
  activityRow: { flexDirection: 'row', gap: 10 },
  activityCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', backgroundColor: Colors.white },
  activityNum: { fontSize: 26, fontWeight: '900' },
  activityLbl: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  // Mini parcel rows in profile
  miniParcelRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  miniParcelLeft: { flex: 1 },
  miniParcelCode: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  miniParcelDest: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  miniStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  miniStatusText: { fontSize: 10, fontWeight: '700' },

  // Add user modal
  addModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addRoleChips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addRoleChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, gap: 4 },
  addRoleEmoji: { fontSize: 16 },
  addRoleChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
});
