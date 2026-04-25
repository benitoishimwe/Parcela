import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
  useWindowDimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_ICON_MAP: Record<string, any> = {
  awaiting_payment:  'card-outline',
  awaiting_dropoff:  'clipboard-outline',
  dropped_off:       'download-outline',
  in_transit:        'car-outline',
  ready_for_pickup:  'mail-outline',
  delivered:         'checkmark-circle-outline',
  returned:          'return-down-back-outline',
};

// Ordered pipeline steps (excludes returned — it's a side branch)
const PARCEL_STEPS = [
  'awaiting_payment',
  'awaiting_dropoff',
  'dropped_off',
  'in_transit',
  'ready_for_pickup',
  'delivered',
];

const FILTER_OPTIONS = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'awaiting', label: 'Awaiting' },
  { key: 'ready',    label: 'Ready' },
  { key: 'delivered',label: 'Delivered' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting(h: number) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingIcon(h: number) {
  if (h < 12) return 'sunny-outline';
  if (h < 17) return 'partly-sunny-outline';
  return 'moon-outline';
}

function getETA(parcel: any): string {
  if (parcel.status === 'delivered') return 'Delivered';
  if (parcel.status === 'returned')  return 'Returned';
  if (!parcel.created_at) return '—';
  const eta = new Date(parcel.created_at);
  eta.setDate(eta.getDate() + 2);
  const now = new Date();
  if (eta <= now) return 'Today';
  return eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH  = diffMs / (1000 * 60 * 60);
  if (diffH < 1)   return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffH < 24)  return `${Math.floor(diffH)}h ago`;
  if (diffH < 48)  return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAvatarColor(name: string): string {
  const palette = [Colors.primary, Colors.green, '#7C3AED', Colors.warning, '#0891B2', '#EC4899'];
  return palette[(name?.charCodeAt(0) || 65) % palette.length];
}

function getStepProgress(status: string): { step: number; total: number } {
  const idx = PARCEL_STEPS.indexOf(status);
  if (idx === -1) return { step: 0, total: PARCEL_STEPS.length };
  return { step: idx + 1, total: PARCEL_STEPS.length };
}

// ── Pulsing dot ───────────────────────────────────────────────────────────────
function PulsingDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute',
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: color + '40',
        transform: [{ scale: pulse }],
      }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [parcels,      setParcels]      = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [isOffline,    setIsOffline]    = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSearch,   setShowSearch]   = useState(false);

  const now    = new Date();
  const hour   = now.getHours();
  const firstName    = user?.name?.split(' ')[0] || 'User';
  const avatarColor  = getAvatarColor(user?.name || 'U');

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchParcels = useCallback(async () => {
    if (!user?.user_id) { setLoading(false); setRefreshing(false); return; }
    try {
      const params = new URLSearchParams();
      if (user.phone) params.set('phone', user.phone);
      if (user.email) params.set('email', user.email);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get(`/api/parcels/by-user/${user.user_id}${query}`);
      setParcels(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.user_id, user?.phone, user?.email]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.get('/api/notifications', token);
      setUnreadCount(data.filter((n: any) => !n.read).length);
    } catch {}
  }, [token]);

  useEffect(() => { fetchParcels(); fetchNotifications(); }, [fetchParcels, fetchNotifications]);

  const onRefresh = () => { setRefreshing(true); fetchParcels(); };

  // ── Derived metrics ───────────────────────────────────────────────────────
  const totalCount        = parcels.length;
  const activeCount       = parcels.filter(p => !['delivered', 'returned'].includes(p.status)).length;
  const deliveredCount    = parcels.filter(p => p.status === 'delivered').length;
  const awaitingDropoff   = parcels.filter(p => p.status === 'awaiting_dropoff').length;
  const readyPickupCount  = parcels.filter(p => p.status === 'ready_for_pickup').length;
  const inTransitCount    = parcels.filter(p => p.status === 'in_transit').length;
  const returnedCount     = parcels.filter(p => p.status === 'returned').length;

  // ── Quick actions ─────────────────────────────────────────────────────────
  const QUICK_ACTIONS = [
    {
      key: 'send',    icon: 'send-outline' as any,
      label: t('send_parcel'),  desc: 'Ship to any locker',
      color: Colors.primary,    bg: Colors.primaryLight,
      route: '/(user)/send',
    },
    {
      key: 'track',   icon: 'location-outline' as any,
      label: t('track_parcel'), desc: 'Real-time status',
      color: Colors.green,      bg: Colors.greenLight,
      route: '/(user)/track',
    },
    {
      key: 'map',     icon: 'map-outline' as any,
      label: t('find_lockers'), desc: 'Near you on map',
      color: Colors.yellowDark, bg: Colors.yellowLight,
      route: '/(user)/map',
    },
    {
      key: 'history', icon: 'time-outline' as any,
      label: t('history'),      desc: 'All your parcels',
      color: '#7C3AED',         bg: '#EDE9FE',
      route: '/(user)/history',
    },
  ];

  // ── Filtered + searched parcel list ───────────────────────────────────────
  const displayParcels = useMemo(() => {
    let list = [...parcels].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    if (statusFilter === 'active')
      list = list.filter(p => !['delivered', 'returned'].includes(p.status));
    else if (statusFilter === 'awaiting')
      list = list.filter(p => ['awaiting_payment', 'awaiting_dropoff', 'dropped_off'].includes(p.status));
    else if (statusFilter === 'ready')
      list = list.filter(p => p.status === 'ready_for_pickup');
    else if (statusFilter === 'delivered')
      list = list.filter(p => p.status === 'delivered');

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.tracking_code?.toLowerCase().includes(q) ||
        p.destination_locker_name?.toLowerCase().includes(q) ||
        p.origin_locker_name?.toLowerCase().includes(q) ||
        p.recipient_name?.toLowerCase().includes(q),
      );
    }

    return list.slice(0, 6);
  }, [parcels, statusFilter, search]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.white} />
        }
      >
        {/* ═══════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════ */}
        <View style={styles.hero}>
          {/* Top row: greeting + controls */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeft}>
              <View style={styles.greetingRow}>
                <Ionicons name={getGreetingIcon(hour)} size={14} color="rgba(255,255,255,0.75)" />
                <Text style={styles.greetingText}>{getGreeting(hour)}</Text>
              </View>
              <Text style={styles.heroName} testID="user-name">{firstName}</Text>
              <Text style={styles.heroDate}>
                {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>

            <View style={styles.heroControls}>
              <TouchableOpacity
                testID="notifications-bell"
                style={styles.headerIconBtn}
                onPress={() => router.push('/(user)/notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.9)" />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.avatarCircle, { backgroundColor: avatarColor + 'CC' }]}
                onPress={() => router.push('/(user)/profile')}
                testID="profile-avatar"
              >
                <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{totalCount}</Text>
              <Text style={styles.statLbl}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{activeCount}</Text>
              <Text style={styles.statLbl}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{deliveredCount}</Text>
              <Text style={styles.statLbl}>Delivered</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNum}>{returnedCount}</Text>
              <Text style={styles.statLbl}>Returned</Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════
            CONTENT SURFACE
        ═══════════════════════════════════════════ */}
        <View style={styles.surface}>

          {/* Active parcel banner */}
          {activeCount > 0 && (
            <TouchableOpacity
              testID="active-parcels-banner"
              style={styles.activeBanner}
              onPress={() => router.push('/(user)/history')}
              activeOpacity={0.8}
            >
              <View style={styles.activeBannerLeft}>
                <PulsingDot color={Colors.primary} />
                <View>
                  <Text style={styles.activeBannerTitle}>
                    {activeCount} parcel{activeCount !== 1 ? 's' : ''} in progress
                  </Text>
                  <Text style={styles.activeBannerSub}>Tap to view all active parcels</Text>
                </View>
              </View>
              <View style={styles.activeBannerRight}>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Deeper metrics row (horizontal scroll) ── */}
          {parcels.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.metricsScroll}
              contentContainerStyle={styles.metricsScrollContent}
            >
              {[
                { label: 'Awaiting Drop-off', value: awaitingDropoff, icon: 'clipboard-outline' as any, color: '#3B82F6', bg: '#DBEAFE' },
                { label: 'In Transit',         value: inTransitCount,  icon: 'car-outline' as any,       color: Colors.warning, bg: Colors.warningLight },
                { label: 'Ready Pickup',        value: readyPickupCount,icon: 'mail-outline' as any,      color: Colors.green,   bg: Colors.greenLight },
                { label: 'Returned',            value: returnedCount,   icon: 'return-down-back-outline' as any, color: Colors.error, bg: Colors.errorLight },
              ].map(m => (
                <View key={m.label} style={[styles.metricChip, { backgroundColor: m.bg }]}>
                  <View style={[styles.metricChipIcon, { backgroundColor: m.color }]}>
                    <Ionicons name={m.icon} size={13} color={Colors.white} />
                  </View>
                  <View>
                    <Text style={[styles.metricChipValue, { color: m.color }]}>{m.value}</Text>
                    <Text style={styles.metricChipLabel}>{m.label}</Text>
                  </View>
                </View>
              ))}

              {lastUpdated && (
                <View style={[styles.metricChip, { backgroundColor: Colors.surfaceElevated }]}>
                  <Ionicons name="refresh-outline" size={14} color={Colors.textTertiary} style={{ marginRight: 4 }} />
                  <View>
                    <Text style={[styles.metricChipValue, { color: Colors.textSecondary, fontSize: 11 }]}>
                      Updated
                    </Text>
                    <Text style={styles.metricChipLabel}>{formatTimestamp(lastUpdated.toISOString())}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── Quick Actions ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
          </View>

          <View style={[styles.actionsGrid, isTablet && styles.actionsGridTablet]}>
            {QUICK_ACTIONS.map(action => (
              <TouchableOpacity
                key={action.key}
                testID={`action-${action.key}`}
                style={[
                  styles.actionCard,
                  isTablet && styles.actionCardTablet,
                  { backgroundColor: action.bg },
                ]}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={20} color={Colors.white} />
                </View>
                <View style={styles.actionTextBlock}>
                  <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
                  <Text style={styles.actionDesc}>{action.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={action.color + '80'} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Recent Parcels section header ── */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>{t('recent_parcels')}</Text>
            <View style={styles.sectionHeaderRight}>
              <TouchableOpacity
                style={styles.searchToggleBtn}
                onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
              >
                <Ionicons
                  name={showSearch ? 'close-outline' : 'search-outline'}
                  size={17}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
              {parcels.length > 3 && (
                <TouchableOpacity onPress={() => router.push('/(user)/history')}>
                  <Text style={styles.viewAll}>{t('view_all')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search bar */}
          {showSearch && (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={15} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tracking code, locker, or recipient…"
                placeholderTextColor={Colors.textTertiary}
                value={search}
                onChangeText={setSearch}
                autoFocus
                returnKeyType="search"
                testID="parcel-search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={15} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            {FILTER_OPTIONS.map(f => {
              const isActive = statusFilter === f.key;
              let count = 0;
              if (f.key === 'all')       count = parcels.length;
              else if (f.key === 'active')  count = activeCount;
              else if (f.key === 'awaiting')count = awaitingDropoff + parcels.filter(p => ['awaiting_payment','dropped_off'].includes(p.status)).length;
              else if (f.key === 'ready')   count = readyPickupCount;
              else if (f.key === 'delivered')count = deliveredCount;

              return (
                <TouchableOpacity
                  key={f.key}
                  testID={`parcel-filter-${f.key}`}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setStatusFilter(f.key)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                  <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Parcel list / states ── */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading parcels…</Text>
            </View>

          ) : isOffline ? (
            <View style={styles.offlineState}>
              <View style={styles.offlineIconWrap}>
                <Ionicons name="cloud-offline-outline" size={40} color={Colors.textTertiary} />
              </View>
              <Text style={styles.offlineTitle}>You're offline</Text>
              <Text style={styles.offlineDesc}>
                Check your internet connection and pull down to refresh.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Ionicons name="refresh-outline" size={15} color={Colors.primary} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>

          ) : displayParcels.length === 0 && parcels.length === 0 ? (
            /* No parcels at all */
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('no_parcels')}</Text>
              <Text style={styles.emptyBody}>
                Ship your first parcel using Rwanda's smartest locker network
              </Text>
              <TouchableOpacity
                testID="send-first-parcel"
                style={styles.emptyPrimaryBtn}
                onPress={() => router.push('/(user)/send')}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={15} color={Colors.white} />
                <Text style={styles.emptyPrimaryBtnText}>{t('send_parcel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptySecondaryBtn}
                onPress={() => router.push('/(user)/map')}
              >
                <Ionicons name="map-outline" size={15} color={Colors.primary} />
                <Text style={styles.emptySecondaryBtnText}>Find Lockers Near Me</Text>
              </TouchableOpacity>
            </View>

          ) : displayParcels.length === 0 ? (
            /* No results for current filter/search */
            <View style={styles.noResultsState}>
              <Ionicons name="filter-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.noResultsTitle}>No parcels found</Text>
              <Text style={styles.noResultsDesc}>
                {search ? `No match for "${search}"` : 'Nothing in this category yet'}
              </Text>
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => { setStatusFilter('all'); setSearch(''); }}
              >
                <Text style={styles.clearFilterText}>Clear filters</Text>
              </TouchableOpacity>
            </View>

          ) : (
            <View style={styles.parcelList}>
              {displayParcels.map(parcel => (
                <EnhancedParcelCard
                  key={parcel.parcel_id}
                  parcel={parcel}
                  onView={() => router.push({
                    pathname: '/(user)/qrcode',
                    params: {
                      parcelId: parcel.parcel_id,
                      qrData: parcel.qr_data,
                      trackingCode: parcel.tracking_code,
                      recipientName: parcel.recipient_name,
                      destinationLocker: parcel.destination_locker_name,
                      pickupCode: parcel.qr_code,
                    },
                  })}
                  onTrack={() => router.push('/(user)/track' as any)}
                />
              ))}

              {parcels.length > 6 && (
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => router.push('/(user)/history')}
                >
                  <Text style={styles.viewAllBtnText}>
                    View all {parcels.length} parcels
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Enhanced Parcel Card ───────────────────────────────────────────────────────
function EnhancedParcelCard({
  parcel,
  onView,
  onTrack,
}: {
  parcel: any;
  onView: () => void;
  onTrack: () => void;
}) {
  const sc       = STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
  const iconName = STATUS_ICON_MAP[parcel.status] || 'cube-outline';
  const isActive = !['delivered', 'returned'].includes(parcel.status);
  const { step, total } = getStepProgress(parcel.status);
  const eta      = getETA(parcel);
  const created  = formatTimestamp(parcel.created_at);

  return (
    <TouchableOpacity
      testID={`parcel-card-${parcel.parcel_id}`}
      style={styles.parcelCard}
      onPress={onView}
      activeOpacity={0.88}
    >
      {/* ── Top: tracking + status badge ── */}
      <View style={styles.parcelCardTop}>
        <View style={styles.parcelTrackRow}>
          {isActive && <PulsingDot color={sc.dot} />}
          <Text style={styles.parcelTracking}>{parcel.tracking_code}</Text>
          {parcel.size ? (
            <View style={styles.sizePill}>
              <Text style={styles.sizePillText}>{parcel.size.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.dot }]}>
          <Ionicons name={iconName} size={11} color={sc.text} />
          <Text style={[styles.statusBadgeText, { color: sc.text }]}>
            {STATUS_LABELS[parcel.status] || parcel.status}
          </Text>
        </View>
      </View>

      {/* ── Route: origin → destination with locker names ── */}
      <View style={styles.parcelRouteRow}>
        <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
        <Text style={styles.parcelRouteText} numberOfLines={1}>
          {parcel.origin_locker_name || '—'}  →  {parcel.destination_locker_name || '—'}
        </Text>
      </View>

      {/* ── Recipient ── */}
      {parcel.recipient_name ? (
        <View style={styles.recipientRow}>
          <Ionicons name="person-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.recipientText} numberOfLines={1}>
            To: {parcel.recipient_name}
          </Text>
        </View>
      ) : null}

      {/* ── Progress bar (only for non-terminal statuses) ── */}
      {parcel.status !== 'returned' && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(step / total) * 100}%` as any,
                  backgroundColor: parcel.status === 'delivered' ? Colors.green : Colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            Step {step}/{total}
          </Text>
        </View>
      )}

      {/* ── Meta: timestamp + ETA + price ── */}
      <View style={styles.parcelMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.metaText}>{created}</Text>
        </View>
        <View style={styles.metaDot} />
        <View style={styles.metaItem}>
          <Ionicons name="flag-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.metaText}>ETA {eta}</Text>
        </View>
        {parcel.price != null && (
          <>
            <View style={styles.metaDot} />
            <Text style={styles.metaPrice}>{parcel.price.toLocaleString()} RWF</Text>
          </>
        )}
      </View>

      {/* ── Action buttons ── */}
      <View style={styles.parcelActions}>
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={onTrack}
          testID={`track-btn-${parcel.parcel_id}`}
          activeOpacity={0.8}
        >
          <Ionicons name="location-outline" size={14} color={Colors.primary} />
          <Text style={styles.trackBtnText}>Track</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewDetailsBtn}
          onPress={onView}
          testID={`view-btn-${parcel.parcel_id}`}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-outline" size={14} color={Colors.white} />
          <Text style={styles.viewDetailsBtnText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.primary },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroLeft: { flex: 1 },
  greetingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2,
  },
  greetingText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroName: {
    fontSize: 28, fontWeight: '900', color: Colors.white,
    letterSpacing: -0.5, marginBottom: 2,
  },
  heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '400' },

  heroControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: Colors.error,
    borderRadius: 9, minWidth: 17, height: 17,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  notifBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitial: { color: Colors.white, fontSize: 16, fontWeight: '800' },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statCell:    { flex: 1, alignItems: 'center' },
  statNum:     { fontSize: 22, fontWeight: '900', color: Colors.white },
  statLbl:     { fontSize: 10, color: 'rgba(255,255,255,0.68)', fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  // ── Surface (white card area) ─────────────────────────────────────────────
  surface: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 8,
    minHeight: 600,
  },

  // Active banner
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.primary + '25',
    ...Shadows.card,
  },
  activeBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeBannerRight: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  activeBannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  activeBannerSub:   { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  // Metrics scroll
  metricsScroll: { marginTop: 14 },
  metricsScrollContent: {
    paddingHorizontal: 16, gap: 8,
    flexDirection: 'row', paddingBottom: 4,
  },
  metricChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  metricChipIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  metricChipValue: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  metricChipLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', marginTop: 1 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 22, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchToggleBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  viewAll: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 13, paddingVertical: 10,
    marginHorizontal: 16, marginBottom: 10,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },

  // Filter chips
  filterScroll: { marginBottom: 4 },
  filterScrollContent: {
    paddingHorizontal: 16, gap: 7, flexDirection: 'row', paddingBottom: 4,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.white,
  },
  filterChipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText:      { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive:{ color: Colors.white, fontWeight: '700' },
  filterCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterCountActive:    { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText:      { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  filterCountTextActive:{ color: Colors.white },

  // ── Quick Actions ─────────────────────────────────────────────────────────
  actionsGrid: {
    paddingHorizontal: 16, gap: 10,
  },
  actionsGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    marginBottom: 0,
    ...Shadows.card,
  },
  actionCardTablet: { width: '47%' },
  actionIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  actionTextBlock: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 1 },
  actionDesc:  { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  // ── Loading ────────────────────────────────────────────────────────────────
  loadingWrap: {
    alignItems: 'center', paddingVertical: 48, gap: 12,
  },
  loadingText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    ...Shadows.card,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody:  {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 22,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
    marginBottom: 10,
    ...Shadows.primary,
  },
  emptyPrimaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  emptySecondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  emptySecondaryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  // ── Offline state ──────────────────────────────────────────────────────────
  offlineState: {
    alignItems: 'center', padding: 36, marginHorizontal: 16,
    backgroundColor: Colors.white, borderRadius: 20, ...Shadows.card,
    marginTop: 8,
  },
  offlineIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  offlineTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  offlineDesc:  {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  retryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  // ── No results state ───────────────────────────────────────────────────────
  noResultsState: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32,
  },
  noResultsTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 12, marginBottom: 5 },
  noResultsDesc:  { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  clearFilterBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8 },
  clearFilterText:{ color: Colors.primary, fontWeight: '700', fontSize: 13 },

  // ── Parcel list ────────────────────────────────────────────────────────────
  parcelList: { paddingHorizontal: 16, gap: 10 },

  parcelCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },

  // Tracking + status
  parcelCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  parcelTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  parcelTracking: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sizePill: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  sizePillText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  // Route
  parcelRouteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4,
  },
  parcelRouteText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  // Recipient
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  recipientText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },

  // Progress bar
  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  progressTrack: {
    flex: 1, height: 5, backgroundColor: Colors.surfaceElevated,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600', minWidth: 44 },

  // Meta row
  parcelMeta: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10,
  },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:  { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  metaDot:   { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textTertiary, marginHorizontal: 2 },
  metaPrice: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  // Action buttons
  parcelActions: {
    flexDirection: 'row', gap: 8,
    paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  trackBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 11,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  trackBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  viewDetailsBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 11,
    backgroundColor: Colors.primary,
    ...Shadows.primary,
  },
  viewDetailsBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 16,
  },
  viewAllBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
});
