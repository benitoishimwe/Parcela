import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SectionList, Pressable, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Switch, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';
import { supabase } from '../../utils/supabase';

// ─── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  ready_for_pickup: { icon: '📬', color: Colors.green,       bg: Colors.greenLight   },
  in_transit:       { icon: '🚚', color: Colors.warning,     bg: Colors.warningLight },
  dropped_off:      { icon: '📥', color: Colors.primaryDark, bg: Colors.primaryLight },
  delivered:        { icon: '✅', color: Colors.green,       bg: Colors.greenLight   },
  awaiting_dropoff: { icon: '📋', color: Colors.primary,     bg: Colors.primaryLight },
  awaiting_payment: { icon: '💳', color: Colors.warning,     bg: Colors.warningLight },
  returned:         { icon: '↩️', color: Colors.error,       bg: Colors.errorLight   },
  delay:            { icon: '⚠️', color: Colors.error,       bg: Colors.errorLight   },
  task_assigned:    { icon: '📋', color: Colors.primary,     bg: Colors.primaryLight },
  task_completed:   { icon: '🎉', color: Colors.green,       bg: Colors.greenLight   },
  new_parcel:       { icon: '📦', color: Colors.primary,     bg: Colors.primaryLight },
  payment:          { icon: '💳', color: Colors.warning,     bg: Colors.warningLight },
  status:           { icon: '🔄', color: Colors.primary,     bg: Colors.primaryLight },
  feedback:         { icon: '💬', color: Colors.yellowDark,  bg: Colors.yellowLight  },
  feedback_prompt:  { icon: '⭐', color: Colors.yellowDark,  bg: Colors.yellowLight  },
  default:          { icon: '🔔', color: Colors.primary,     bg: Colors.primaryLight },
};

// ─── Category definitions ──────────────────────────────────────────────────────
const CATEGORY_TYPES: Record<string, string[]> = {
  parcel: [
    'ready_for_pickup','in_transit','dropped_off','delivered',
    'awaiting_dropoff','awaiting_payment','returned','new_parcel',
    'task_assigned','task_completed','payment',
  ],
  promo:  ['feedback', 'feedback_prompt'],
  system: ['delay', 'status', 'default'],
};

const CATEGORY_META: Record<string, { title: string; iconName: keyof typeof Ionicons.glyphMap; color: string }> = {
  parcel: { title: 'Parcel Updates',  iconName: 'cube-outline',         color: Colors.primary    },
  promo:  { title: 'Promotions',      iconName: 'gift-outline',         color: Colors.yellowDark },
  system: { title: 'System Alerts',   iconName: 'alert-circle-outline', color: Colors.error      },
};

function getCategoryKey(type: string): 'parcel' | 'promo' | 'system' {
  for (const [key, types] of Object.entries(CATEGORY_TYPES)) {
    if (types.includes(type)) return key as 'parcel' | 'promo' | 'system';
  }
  return 'system';
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Animated notification card ────────────────────────────────────────────────
type NotifCardProps = {
  item: any;
  isNew: boolean;
  onPress: () => void;
};

function NotifCard({ item, isNew, onPress }: NotifCardProps) {
  const meta      = TYPE_META[item.type] || TYPE_META.default;
  const entryAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.spring(entryAnim, {
        toValue: 1, tension: 55, friction: 8, useNativeDriver: true,
      }).start();
    }
  }, []);

  const pressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View
        style={[
          styles.notifCard,
          !item.read && styles.notifUnread,
          {
            opacity: entryAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            ],
          },
        ]}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: meta.bg }]}>
          <Text style={styles.notifIconEmoji}>{meta.icon}</Text>
        </View>

        <View style={styles.notifContent}>
          <View style={styles.notifTopRow}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleBold]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          {item.tracking_code && (
            <View style={styles.trackingChip}>
              <Ionicons name="barcode-outline" size={11} color={Colors.primary} />
              <Text style={styles.trackingCode}>{item.tracking_code}</Text>
            </View>
          )}
        </View>

        {!item.read && <View style={[styles.unreadDot, { backgroundColor: meta.color }]} />}
      </Animated.View>
    </Pressable>
  );
}

// ─── Preference toggle row ─────────────────────────────────────────────────────
function PrefRow({
  label, subtitle, value, onChange,
}: { label: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefTextWrap}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefRowSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Notifications() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [filter, setFilter]               = useState<'all' | 'unread'>('all');
  const [showPrefs, setShowPrefs]         = useState(false);
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const newNotifIds  = useRef<Set<string>>(new Set());

  // Notification preferences (persisted via backend in a full implementation)
  const [prefs, setPrefs] = useState({
    parcelUpdates:  true,
    promotions:     true,
    reminders:      true,
    systemAlerts:   true,
  });

  // ── Feedback state ────────────────────────────────────────────────────────
  const [feedbackNotif, setFeedbackNotif]       = useState<any>(null);
  const [rating, setRating]                     = useState(0);
  const [feedbackText, setFeedbackText]         = useState('');
  const [feedbackLoading, setFeedbackLoading]   = useState(false);
  const [feedbackSent, setFeedbackSent]         = useState(false);
  const [feedbackError, setFeedbackError]       = useState('');

  const handleFeedback = async () => {
    if (rating === 0) { setFeedbackError('Please select a rating'); return; }
    setFeedbackLoading(true); setFeedbackError('');
    try {
      await api.post('/api/feedback', { rating, message: feedbackText.trim() || undefined }, token || undefined);
      setFeedbackSent(true);
      setTimeout(() => setFeedbackNotif(null), 1800);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to send feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
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

  // ── Supabase realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.user_id) return;
    const channel = supabase
      .channel('notifications-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.user_id}` },
        (payload) => {
          const n = payload.new as any;
          newNotifIds.current.add(n.notification_id);
          setNotifications(prev => [n, ...prev]);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user?.user_id]);

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

  const openFeedback = (notif: any) => {
    setFeedbackNotif(notif);
    setRating(0); setFeedbackText('');
    setFeedbackSent(false); setFeedbackError('');
    markAsRead(notif.notification_id);
  };

  const handleNotifPress = (item: any) => {
    if (item.type === 'feedback_prompt') { openFeedback(item); return; }
    markAsRead(item.notification_id);
    if (item.tracking_code) {
      router.push({ pathname: '/(user)/track', params: { code: item.tracking_code } });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Build sections ────────────────────────────────────────────────────────
  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const sections = filter === 'all'
    ? (Object.keys(CATEGORY_META) as Array<'parcel' | 'promo' | 'system'>)
        .map(key => ({
          key,
          ...CATEGORY_META[key],
          data: filtered.filter(n => getCategoryKey(n.type) === key),
        }))
        .filter(s => s.data.length > 0)
    : [{ key: 'unread', title: '', iconName: null, color: Colors.primary, data: filtered }];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowPrefs(true)}>
            <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <View style={styles.filterRow}>
        {(['all', 'unread'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 64 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.notification_id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>{section.data.length}</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <NotifCard
                item={item}
                isNew={newNotifIds.current.has(item.notification_id)}
                onPress={() => handleNotifPress(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {/* Illustration */}
              <View style={styles.emptyIllustration}>
                <View style={styles.emptyRingOuter}>
                  <View style={styles.emptyRingInner}>
                    <Ionicons name="notifications-outline" size={44} color={Colors.primary} />
                  </View>
                </View>
                {/* Decorative accents */}
                <View style={[styles.accentDot, { top: 12, right: 20, width: 10, height: 10, backgroundColor: Colors.warningLight, borderColor: Colors.warning }]} />
                <View style={[styles.accentDot, { top: 32, left: 12, width: 8, height: 8, backgroundColor: Colors.greenLight, borderColor: Colors.green }]} />
                <View style={[styles.accentDot, { bottom: 16, right: 8, width: 12, height: 12, backgroundColor: Colors.primaryLight, borderColor: Colors.primaryMid }]} />
              </View>

              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'You have no unread notifications right now. Check back later.'
                  : "You'll be notified when your parcel status changes or there's something important for you."}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Notification preferences sheet ───────────────────────────────── */}
      <Modal
        visible={showPrefs}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrefs(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowPrefs(false)}>
          <Pressable style={styles.prefsSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.prefsHeader}>
              <Text style={styles.prefsTitle}>Notification Preferences</Text>
              <TouchableOpacity onPress={() => setShowPrefs(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.prefsSub}>Choose which notifications you'd like to receive.</Text>

            <View style={styles.prefsList}>
              <PrefRow
                label="Parcel Updates"
                subtitle="Status changes, delivery alerts, pickups"
                value={prefs.parcelUpdates}
                onChange={v => setPrefs(p => ({ ...p, parcelUpdates: v }))}
              />
              <View style={styles.prefDivider} />
              <PrefRow
                label="Promotional Messages"
                subtitle="Offers, campaigns, and rewards"
                value={prefs.promotions}
                onChange={v => setPrefs(p => ({ ...p, promotions: v }))}
              />
              <View style={styles.prefDivider} />
              <PrefRow
                label="Reminders"
                subtitle="Pickup deadlines and pending actions"
                value={prefs.reminders}
                onChange={v => setPrefs(p => ({ ...p, reminders: v }))}
              />
              <View style={styles.prefDivider} />
              <PrefRow
                label="System Alerts"
                subtitle="Delays, outages, and service updates"
                value={prefs.systemAlerts}
                onChange={v => setPrefs(p => ({ ...p, systemAlerts: v }))}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Post-delivery feedback modal ──────────────────────────────────── */}
      <Modal
        visible={!!feedbackNotif}
        transparent
        animationType="slide"
        onRequestClose={() => setFeedbackNotif(null)}
      >
        <View style={styles.fbOverlay}>
          <View style={styles.fbCard}>
            {feedbackSent ? (
              <View style={styles.fbSuccess}>
                <Text style={styles.fbSuccessEmoji}>✅</Text>
                <Text style={styles.fbSuccessTitle}>Thank you!</Text>
                <Text style={styles.fbSuccessBody}>Your feedback helps us improve Parcela.</Text>
              </View>
            ) : (
              <>
                <View style={styles.fbHeader}>
                  <Text style={styles.fbTitle}>Rate Your Delivery ⭐</Text>
                  <TouchableOpacity onPress={() => setFeedbackNotif(null)}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.fbSub}>How was your Parcela experience for this delivery?</Text>
                {feedbackNotif?.tracking_code && (
                  <View style={styles.fbTrackingChip}>
                    <Ionicons name="cube-outline" size={12} color={Colors.primary} />
                    <Text style={styles.fbTrackingText}>{feedbackNotif.tracking_code}</Text>
                  </View>
                )}
                <View style={styles.fbStarsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <TouchableOpacity key={s} onPress={() => setRating(s)} style={styles.fbStarBtn}>
                      <Ionicons
                        name={s <= rating ? 'star' : 'star-outline'}
                        size={38}
                        color={s <= rating ? Colors.yellow : Colors.border}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {rating > 0 && (
                  <Text style={styles.fbRatingLabel}>
                    {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'][rating]}
                  </Text>
                )}
                <TextInput
                  style={styles.fbInput}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="What went well? Any issues? (optional)"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
                {feedbackError ? (
                  <View style={styles.fbError}>
                    <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                    <Text style={styles.fbErrorText}>{feedbackError}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.fbSubmit, feedbackLoading && { opacity: 0.6 }]}
                  onPress={handleFeedback}
                  disabled={feedbackLoading}
                >
                  {feedbackLoading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.fbSubmitText}>Send Feedback</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.fbSkip} onPress={() => setFeedbackNotif(null)}>
                  <Text style={styles.fbSkipText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  badge: {
    backgroundColor: Colors.error, borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.primaryLight, borderRadius: 20,
  },
  markAllText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '700' },

  // ── Filter tabs
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTabTextActive: { color: Colors.white },

  // ── List
  listContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 4, flexGrow: 1 },

  // ── Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 2, marginTop: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    flex: 1, fontSize: 11, fontWeight: '700',
    color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase',
  },
  sectionCountPill: {
    backgroundColor: Colors.surfaceElevated, paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: 10,
  },
  sectionCountText: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary },

  // ── Notification card
  cardWrap: { marginBottom: 8 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.white, borderRadius: 16, padding: 14, gap: 12,
    ...Shadows.card,
  },
  notifUnread: {
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  notifIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifIconEmoji: { fontSize: 22 },
  notifContent: { flex: 1 },
  notifTopRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8,
  },
  notifTitle: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  notifTitleBold: { fontWeight: '800' },
  notifTime: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500', flexShrink: 0 },
  notifBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 4, marginBottom: 6 },
  trackingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  trackingCode: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },

  // ── Empty state
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 56, paddingHorizontal: 32, gap: 14,
  },
  emptyIllustration: {
    width: 140, height: 140, alignItems: 'center',
    justifyContent: 'center', marginBottom: 4,
  },
  emptyRingOuter: {
    width: 112, height: 112, borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyRingInner: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.card,
  },
  accentDot: {
    position: 'absolute', borderRadius: 99,
    borderWidth: 1.5,
  },
  emptyTitle: {
    fontSize: 20, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22, maxWidth: 272,
  },

  // ── Preferences sheet
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  prefsSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
    ...Shadows.large,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20,
  },
  prefsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  prefsTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  prefsSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 19 },
  prefsList: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  prefRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  prefTextWrap: { flex: 1, gap: 2 },
  prefLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  prefRowSub: { fontSize: 12, color: Colors.textSecondary },
  prefDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // ── Feedback modal
  fbOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  fbCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  fbHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  fbTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  fbSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  fbTrackingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginBottom: 14,
  },
  fbTrackingText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  fbStarsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  fbStarBtn: { padding: 4 },
  fbRatingLabel: {
    textAlign: 'center', fontSize: 13, fontWeight: '700',
    color: Colors.yellowDark, marginBottom: 12,
  },
  fbInput: {
    backgroundColor: Colors.background, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 12,
  },
  fbError: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.errorLight, borderRadius: 10, padding: 10, marginBottom: 10,
  },
  fbErrorText: { flex: 1, color: Colors.error, fontSize: 12, fontWeight: '500' },
  fbSubmit: {
    backgroundColor: Colors.primary, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  fbSubmitText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  fbSkip: { alignItems: 'center', paddingVertical: 10 },
  fbSkipText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  fbSuccess: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  fbSuccessEmoji: { fontSize: 56 },
  fbSuccessTitle: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  fbSuccessBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
