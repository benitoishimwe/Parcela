import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, Linking,
  Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const URGENT_HOURS = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting(h: number) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function getGreetingIcon(h: number): any {
  if (h < 12) return 'sunny-outline';
  if (h < 17) return 'partly-sunny-outline';
  return 'moon-outline';
}
function getAvatarColor(name: string): string {
  const palette = [Colors.green, '#0891B2', '#7C3AED', Colors.warning, '#EC4899', Colors.primary];
  return palette[(name?.charCodeAt(0) || 65) % palette.length];
}
function isUrgent(task: any): boolean {
  if (task.status === 'completed') return false;
  const diffH = (Date.now() - new Date(task.created_at).getTime()) / 3_600_000;
  return diffH >= URGENT_HOURS;
}
function relativeTime(iso: string): string {
  if (!iso) return '—';
  const diffM = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (diffM < 1)   return 'Just now';
  if (diffM < 60)  return `${Math.floor(diffM)}m ago`;
  const diffH = diffM / 60;
  if (diffH < 24)  return `${Math.floor(diffH)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function shortId(id: string): string {
  if (!id) return '—';
  return id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
}
function dateLabel(iso: string): string {
  if (!iso) return 'Unknown';
  const todayStr     = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();
  const d = new Date(iso).toDateString();
  if (d === todayStr)     return 'Today';
  if (d === yesterdayStr) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
function lockerInstruction(type: string): string {
  return type === 'collect'
    ? 'Scan QR code at origin locker to unlock compartment and collect parcel.'
    : 'Deliver parcel to destination locker and confirm via scan.';
}
function openNavigation(lockerName: string) {
  const q   = encodeURIComponent(`${lockerName}, Kigali, Rwanda`);
  const url = Platform.OS === 'ios' ? `maps:?q=${q}` : `geo:0,0?q=${q}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?q=${q}`),
  );
}

// Group tasks by date label → array of { label, tasks }
function groupTasks(tasks: any[]): { label: string; tasks: any[] }[] {
  const groups: Record<string, any[]> = {};
  for (const t of tasks) {
    const lbl = dateLabel(t.created_at);
    if (!groups[lbl]) groups[lbl] = [];
    groups[lbl].push(t);
  }
  return Object.entries(groups).map(([label, tasks]) => ({ label, tasks }));
}

// ── Pulsing dot (JS-only driver — safe on web) ────────────────────────────────
function PulsingDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.7, duration: 750, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 1,   duration: 750, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: color + '40',
          transform: [{ scale: anim }],
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ── Progress bar (layout-based, no Animated percentage strings) ───────────────
function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: ratio,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [ratio]);

  const fillWidth = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, trackW],
  });

  return (
    <View
      style={styles.progressTrack}
      onLayout={e => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.progressFill,
          { width: fillWidth, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CourierDashboard() {
  const { user, token, loading: authLoading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [tasks,      setTasks]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<'pending' | 'completed'>('pending');
  const [isOffline,  setIsOffline]  = useState(false);
  const [lastSync,   setLastSync]   = useState<Date | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const now         = new Date();
  const hour        = now.getHours();
  const firstName   = user?.name?.split(' ')[0] || 'Courier';
  const avatarColor = getAvatarColor(user?.name || 'C');

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.replace('/(auth)/login');
  }, [user, authLoading]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const data = await api.get(`/api/courier/tasks/by-courier/${user.user_id}`);
      setTasks(Array.isArray(data) ? data : []);
      setIsOffline(false);
      setLastSync(new Date());
    } catch {
      setIsOffline(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.user_id]);

  useEffect(() => {
    if (!authLoading && user?.user_id) fetchTasks();
    else if (!authLoading && !user) setLoading(false);
  }, [authLoading, user?.user_id]);

  const onRefresh = () => { setRefreshing(true); fetchTasks(); };

  // ── Derived data ───────────────────────────────────────────────────────────
  const pending   = useMemo(() => tasks.filter(t => t.status !== 'completed'), [tasks]);
  const completed = useMemo(() => tasks.filter(t => t.status === 'completed'),  [tasks]);
  const urgent    = useMemo(() => pending.filter(isUrgent), [pending]);
  const progress  = tasks.length > 0 ? completed.length / tasks.length : 0;

  const displayTasks = activeTab === 'pending' ? pending : completed;
  const groups       = useMemo(() => groupTasks(displayTasks), [displayTasks]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleComplete = (taskId: string) => {
    Alert.alert(
      'Mark as Complete?',
      'Confirm that you have finished this task.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setCompleting(taskId);
            try {
              await api.put(
                `/api/courier/tasks/${taskId}`,
                { status: 'completed' },
                token || undefined,
              );
              setTasks(prev =>
                prev.map(t => t.task_id === taskId ? { ...t, status: 'completed' } : t),
              );
            } catch {
              Alert.alert('Error', 'Failed to update task. Check your connection and retry.');
            } finally {
              setCompleting(null);
            }
          },
        },
      ],
    );
  };

  const handleStartRoute = () => {
    if (pending.length === 0) {
      Alert.alert('No Pending Tasks', 'All tasks are completed!');
      return;
    }
    const first = pending[0];
    Alert.alert(
      'Start Route',
      `Navigate to ${first.locker_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Maps', onPress: () => openNavigation(first.locker_name) },
      ],
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.white}
          />
        }
      >
        {/* ═══════════════════════════════════════
            HERO
        ═══════════════════════════════════════ */}
        <View style={styles.hero}>
          {/* Top row: badge + offline chip + logout */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="bicycle" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroBadgeText}>COURIER</Text>
            </View>
            <View style={styles.heroControls}>
              {isOffline && (
                <View style={styles.offlineChip}>
                  <Ionicons name="cloud-offline-outline" size={12} color={Colors.warning} />
                  <Text style={styles.offlineChipText}>Offline</Text>
                </View>
              )}
              <TouchableOpacity style={styles.logoutBtn} onPress={logout} testID="logout-btn">
                <Ionicons name="log-out-outline" size={17} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar + greeting */}
          <View style={styles.heroProfileRow}>
            <View style={[styles.heroAvatar, { backgroundColor: avatarColor + 'BB' }]}>
              <Text style={styles.heroAvatarText}>{user?.name?.[0]?.toUpperCase() || 'C'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.greetingRow}>
                <Ionicons name={getGreetingIcon(hour)} size={12} color="rgba(255,255,255,0.72)" />
                <Text style={styles.greetingText}>{getGreeting(hour)}</Text>
              </View>
              <Text style={styles.heroName}>{firstName}</Text>
              <Text style={styles.heroDate}>
                {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>

          {/* Daily progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Daily Progress</Text>
              <Text style={styles.progressCount}>
                {completed.length} / {tasks.length} tasks
              </Text>
            </View>
            <ProgressBar
              ratio={progress}
              color={progress >= 1 && tasks.length > 0 ? Colors.yellow : Colors.white}
            />
            {tasks.length > 0 && progress >= 1 && (
              <Text style={styles.progressDoneText}>All tasks complete — great work!</Text>
            )}
          </View>

          {/* KPI strip */}
          <View style={styles.kpiStrip}>
            {[
              { label: 'Pending',   value: pending.length,   urgent: false },
              { label: 'Done',      value: completed.length, urgent: false },
              { label: 'Urgent',    value: urgent.length,    urgent: urgent.length > 0 },
              { label: 'Total',     value: tasks.length,     urgent: false },
            ].map((item, i, arr) => (
              <View key={item.label} style={{ flex: 1, flexDirection: 'row' }}>
                <View style={styles.kpiCell}>
                  <Text style={[styles.kpiNum, item.urgent && { color: '#FCA5A5' }]}>
                    {item.value}
                  </Text>
                  <Text style={styles.kpiLbl}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.kpiDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ═══════════════════════════════════════
            SURFACE
        ═══════════════════════════════════════ */}
        <View style={styles.surface}>

          {/* Sync row */}
          {lastSync && (
            <View style={styles.syncRow}>
              <Ionicons
                name={isOffline ? 'cloud-offline-outline' : 'cloud-done-outline'}
                size={12}
                color={isOffline ? Colors.warning : Colors.green}
              />
              <Text style={[styles.syncText, isOffline && { color: Colors.warning }]}>
                {isOffline
                  ? 'Offline — showing cached data'
                  : `Synced ${relativeTime(lastSync.toISOString())}`}
              </Text>
              {isOffline && (
                <TouchableOpacity onPress={onRefresh}>
                  <Text style={styles.syncRetry}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Navigation actions */}
          <View style={styles.navActions}>
            <TouchableOpacity
              style={[
                styles.startRouteBtn,
                pending.length === 0 && styles.startRouteBtnDisabled,
              ]}
              onPress={handleStartRoute}
              testID="start-route-btn"
              activeOpacity={pending.length === 0 ? 1 : 0.8}
            >
              <Ionicons
                name="navigate"
                size={16}
                color={pending.length === 0 ? Colors.textTertiary : Colors.white}
              />
              <Text style={[
                styles.startRouteBtnText,
                pending.length === 0 && { color: Colors.textTertiary },
              ]}>
                Start Route
              </Text>
              {pending.length > 0 && (
                <View style={styles.routeCountBadge}>
                  <Text style={styles.routeCountText}>{pending.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanNavBtn}
              onPress={() => router.push('/(courier)/task' as any)}
              testID="scan-btn"
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={16} color={Colors.green} />
              <Text style={styles.scanNavBtnText}>Scan QR</Text>
            </TouchableOpacity>
          </View>

          {/* Urgent alert banner */}
          {urgent.length > 0 && activeTab === 'pending' && (
            <View style={styles.urgentBanner}>
              <PulsingDot color={Colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={styles.urgentTitle}>
                  {urgent.length} urgent task{urgent.length !== 1 ? 's' : ''} — over {URGENT_HOURS}h old
                </Text>
                <Text style={styles.urgentSub}>Complete these first to stay on schedule</Text>
              </View>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['pending', 'completed'] as const).map(tab => {
              const count    = tab === 'pending' ? pending.length : completed.length;
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  testID={`tab-${tab}`}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tab === 'pending' ? 'time-outline' : 'checkmark-circle-outline'}
                    size={15}
                    color={isActive ? Colors.white : Colors.textSecondary}
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab === 'pending' ? 'Pending' : 'Completed'}
                  </Text>
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Content ── */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.green} />
              <Text style={styles.loadingText}>Loading tasks…</Text>
            </View>

          ) : isOffline && tasks.length === 0 ? (
            /* Offline — no cache */
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconWrap, { backgroundColor: Colors.surfaceElevated }]}>
                <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>You're offline</Text>
              <Text style={styles.emptyBody}>
                No cached tasks. Pull down to retry when connected.
              </Text>
            </View>

          ) : displayTasks.length === 0 ? (
            /* Empty state */
            <View style={styles.emptyCard}>
              {activeTab === 'pending' && completed.length > 0 ? (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: Colors.greenLight }]}>
                    <Ionicons name="checkmark-circle" size={40} color={Colors.green} />
                  </View>
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptyBody}>
                    You've completed all {completed.length} task{completed.length !== 1 ? 's' : ''} — great work!
                  </Text>
                  <TouchableOpacity style={styles.emptyAction} onPress={onRefresh}>
                    <Ionicons name="refresh-outline" size={14} color={Colors.green} />
                    <Text style={[styles.emptyActionText, { color: Colors.green }]}>Check for new tasks</Text>
                  </TouchableOpacity>
                </>
              ) : activeTab === 'pending' ? (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: Colors.primaryLight }]}>
                    <Ionicons name="clipboard-outline" size={40} color={Colors.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No tasks assigned</Text>
                  <Text style={styles.emptyBody}>{t('no_tasks')}. Pull down to refresh.</Text>
                  <TouchableOpacity style={styles.emptyAction} onPress={onRefresh}>
                    <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
                    <Text style={styles.emptyActionText}>Refresh</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIconWrap, { backgroundColor: Colors.surfaceElevated }]}>
                    <Ionicons name="time-outline" size={40} color={Colors.textTertiary} />
                  </View>
                  <Text style={styles.emptyTitle}>No completed tasks yet</Text>
                  <Text style={styles.emptyBody}>Completed tasks will appear here.</Text>
                </>
              )}
            </View>

          ) : (
            /* Task groups */
            groups.map(group => (
              <View key={group.label}>
                {/* Date group header */}
                <View style={styles.groupHeader}>
                  <Text style={styles.groupHeaderText}>{group.label}</Text>
                  <Text style={styles.groupHeaderCount}>
                    {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                {group.tasks.map(task => (
                  <TaskCard
                    key={task.task_id}
                    task={task}
                    completing={completing}
                    onComplete={handleComplete}
                    onNavigate={() => openNavigation(task.locker_name)}
                    onScan={() => router.push('/(courier)/task' as any)}
                    t={t}
                  />
                ))}
              </View>
            ))
          )}

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task, completing, onComplete, onNavigate, onScan, t,
}: {
  task: any;
  completing: string | null;
  onComplete: (id: string) => void;
  onNavigate: () => void;
  onScan: () => void;
  t: (key: string) => string;
}) {
  const isCollect    = task.type === 'collect';
  const isDone       = task.status === 'completed';
  const urgent       = isUrgent(task);
  const isCompleting = completing === task.task_id;
  const typeColor    = isCollect ? Colors.primary : Colors.green;
  const typeBg       = isCollect ? Colors.primaryLight : Colors.greenLight;

  return (
    <View
      testID={`task-${task.task_id}`}
      style={[
        styles.taskCard,
        isDone   && styles.taskCardDone,
        urgent   && !isDone && styles.taskCardUrgent,
      ]}
    >
      {/* Urgent bar */}
      {urgent && !isDone && (
        <View style={styles.urgentBar}>
          <Ionicons name="warning" size={10} color={Colors.white} />
          <Text style={styles.urgentBarText}>URGENT — {URGENT_HOURS}h+ old</Text>
        </View>
      )}

      {/* Header: icon + type + task ID + status badge */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardTypeIcon, { backgroundColor: typeBg }]}>
          <Ionicons
            name={isCollect ? 'arrow-up-circle' : 'arrow-down-circle'}
            size={22}
            color={typeColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.typeRow}>
            <Text style={[styles.typeLabel, { color: typeColor }]}>
              {isCollect ? 'Collect' : 'Deliver'}
            </Text>
            {urgent && !isDone && <PulsingDot color={Colors.error} />}
          </View>
          <Text style={styles.taskIdText}>Task #{shortId(task.task_id)}</Text>
        </View>
        {isDone ? (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark-circle" size={13} color={Colors.green} />
            <Text style={styles.doneBadgeText}>Done</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, urgent && styles.statusBadgeUrgent]}>
            <View style={[styles.statusDot, { backgroundColor: urgent ? Colors.error : Colors.textTertiary }]} />
            <Text style={[styles.statusBadgeText, urgent && { color: Colors.error }]}>
              {urgent ? 'Urgent' : 'Pending'}
            </Text>
          </View>
        )}
      </View>

      {/* Locker info */}
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.lockerText}>{task.locker_name || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.metaText}>Assigned {relativeTime(task.created_at)}</Text>
          {task.parcel_count != null && (
            <>
              <View style={styles.dot} />
              <Ionicons name="archive-outline" size={13} color={Colors.textTertiary} />
              <Text style={[styles.metaText, { color: typeColor, fontWeight: '700' }]}>
                {task.parcel_count} parcel{task.parcel_count !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Instruction box */}
      {!isDone && (
        <View style={styles.instructionBox}>
          <Ionicons name="information-circle-outline" size={13} color={Colors.primary} />
          <Text style={styles.instructionText}>{lockerInstruction(task.type)}</Text>
        </View>
      )}

      {/* Action buttons */}
      {!isDone ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.btnNavigate}
            onPress={onNavigate}
            testID={`navigate-${task.task_id}`}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
            <Text style={styles.btnNavigateText}>Navigate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnScan}
            onPress={onScan}
            testID={`scan-${task.task_id}`}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={13} color={Colors.green} />
            <Text style={styles.btnScanText}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnComplete, isCompleting && { opacity: 0.55 }]}
            onPress={() => onComplete(task.task_id)}
            testID={`complete-task-${task.task_id}`}
            disabled={!!isCompleting}
            activeOpacity={0.85}
          >
            {isCompleting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={13} color={Colors.white} />
                <Text style={styles.btnCompleteText}>{t('complete')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.doneFooter}>
          <Ionicons name="checkmark-circle" size={13} color={Colors.green} />
          <Text style={styles.doneFooterText}>
            Completed · {relativeTime(task.updated_at || task.created_at)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.green },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.green,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
  },
  heroTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2 },
  heroControls:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offlineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  offlineChipText: { fontSize: 10, fontWeight: '700', color: Colors.warning },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroAvatar: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroAvatarText: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  greetingRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  greetingText:   { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '500' },
  heroName:       { fontSize: 24, fontWeight: '900', color: Colors.white, letterSpacing: -0.4 },
  heroDate:       { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  // Progress
  progressSection: { marginBottom: 16 },
  progressHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  progressCount:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  progressTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill:     { height: '100%', borderRadius: 4 },
  progressDoneText: {
    fontSize: 11, color: Colors.yellow, fontWeight: '700',
    marginTop: 5, textAlign: 'center',
  },

  // KPI strip
  kpiStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  kpiCell:    { flex: 1, alignItems: 'center' },
  kpiNum:     { fontSize: 22, fontWeight: '900', color: Colors.white },
  kpiLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.68)', fontWeight: '600', marginTop: 2 },
  kpiDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  // ── Surface ──────────────────────────────────────────────────────────────────
  surface: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20, paddingTop: 8,
    minHeight: 500,
  },

  // Sync row
  syncRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  syncText:  { flex: 1, fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  syncRetry: { fontSize: 11, color: Colors.warning, fontWeight: '700', paddingHorizontal: 6 },

  // Navigation actions
  navActions: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    gap: 10, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  startRouteBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 7,
    backgroundColor: Colors.green, borderRadius: 14, paddingVertical: 11,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  startRouteBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    shadowOpacity: 0, elevation: 0,
  },
  startRouteBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  routeCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  routeCountText: { fontSize: 10, fontWeight: '800', color: Colors.white },
  scanNavBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 7,
    backgroundColor: Colors.greenLight, borderRadius: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: Colors.green + '35',
  },
  scanNavBtnText: { fontSize: 13, fontWeight: '700', color: Colors.green },

  // Urgent banner
  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.errorLight,
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: Colors.error + '30',
  },
  urgentTitle: { fontSize: 13, fontWeight: '700', color: Colors.error },
  urgentSub:   { fontSize: 11, color: Colors.error + 'BB', marginTop: 1 },

  // Tabs
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  tabActive:     { backgroundColor: Colors.green, borderColor: Colors.green },
  tabText:       { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  tabBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText:       { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  tabBadgeTextActive: { color: Colors.white },

  // Loading
  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  // Empty state
  emptyCard: {
    alignItems: 'center', padding: 40,
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: Colors.white, borderRadius: 20,
    ...Shadows.card,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle:      { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody:       { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight,
  },
  emptyActionText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Group header
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderLight,
    marginTop: 4,
  },
  groupHeaderText:  { fontSize: 12, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.3 },
  groupHeaderCount: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },

  // ── Task card ─────────────────────────────────────────────────────────────
  taskCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    marginHorizontal: 16, marginTop: 10,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  taskCardDone:   { opacity: 0.65 },
  taskCardUrgent: {
    borderColor: Colors.error + '55',
    borderWidth: 1.5,
    shadowColor: Colors.error,
    shadowOpacity: 0.1,
    elevation: 3,
  },

  // Urgent top bar
  urgentBar: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.error,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  urgentBarText: { fontSize: 10, fontWeight: '800', color: Colors.white, letterSpacing: 0.8 },

  // Card header
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, padding: 14, paddingBottom: 10,
  },
  cardTypeIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  typeRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  typeLabel:    { fontSize: 15, fontWeight: '800' },
  taskIdText:   { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },

  // Status badges
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.greenLight,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11,
  },
  doneBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.green },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11,
  },
  statusBadgeUrgent: { backgroundColor: Colors.errorLight },
  statusDot:         { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText:   { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Card body
  cardBody: {
    paddingHorizontal: 14, paddingBottom: 10, gap: 5,
    borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10,
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockerText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  metaText:   { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  dot:        { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textTertiary, marginHorizontal: 2 },

  // Instruction box
  instructionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: Colors.primaryLight,
    marginHorizontal: 14, marginBottom: 10,
    borderRadius: 10, padding: 10,
  },
  instructionText: { flex: 1, fontSize: 11, color: Colors.primaryDark, fontWeight: '500', lineHeight: 16 },

  // Action buttons
  actionRow: {
    flexDirection: 'row', gap: 7,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  btnNavigate: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight,
  },
  btnNavigateText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  btnScan: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.green, backgroundColor: Colors.greenLight,
  },
  btnScanText: { fontSize: 11, fontWeight: '700', color: Colors.green },
  btnComplete: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.green,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 6, elevation: 4,
  },
  btnCompleteText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  // Done footer
  doneFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  doneFooterText: { fontSize: 11, color: Colors.green, fontWeight: '600' },
});
