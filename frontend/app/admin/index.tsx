import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type SortKey = 'newest' | 'oldest' | 'status';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_ICON_MAP: Record<string, any> = {
  awaiting_payment: 'card-outline',
  awaiting_dropoff: 'clipboard-outline',
  dropped_off:      'download-outline',
  in_transit:       'car-outline',
  ready_for_pickup: 'mail-outline',
  delivered:        'checkmark-circle-outline',
  returned:         'return-down-back-outline',
};

const FILTER_OPTIONS = [
  { key: 'all',             label: 'All' },
  { key: 'in_transit',      label: 'In Transit' },
  { key: 'ready_for_pickup',label: 'Ready' },
  { key: 'delivered',       label: 'Delivered' },
  { key: 'awaiting_dropoff',label: 'Awaiting' },
  { key: 'returned',        label: 'Returned' },
];

const SORT_OPTIONS: { key: SortKey; label: string; icon: any }[] = [
  { key: 'newest', label: 'Newest First',  icon: 'arrow-down-outline' },
  { key: 'oldest', label: 'Oldest First',  icon: 'arrow-up-outline' },
  { key: 'status', label: 'By Status',     icon: 'funnel-outline' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getETA(parcel: any): string {
  if (parcel.status === 'delivered') return 'Delivered';
  if (parcel.status === 'returned')  return 'Returned';
  if (!parcel.created_at) return '—';
  const eta = new Date(parcel.created_at);
  eta.setDate(eta.getDate() + 2);
  return eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token, logout, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [stats,       setStats]       = useState<any>(null);
  const [allParcels,  setAllParcels]  = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('all');
  const [sortKey,     setSortKey]     = useState<SortKey>('newest');
  const [showSort,    setShowSort]    = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const p = await api.get('/api/parcels');
      setAllParcels(Array.isArray(p) ? p : []);
    } catch {}
    try {
      const s = await api.get('/api/admin/stats', token || undefined);
      setStats(s);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!authLoading && token)  fetchData();
    else if (!authLoading && !token) setLoading(false);
  }, [authLoading, token]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Derived metrics ───────────────────────────────────────────────────────
  const todayStr     = new Date().toDateString();
  const parcelsToday = allParcels.filter(p => new Date(p.created_at).toDateString() === todayStr).length;
  const returnedCount= allParcels.filter(p => p.status === 'returned').length;

  const METRIC_CARDS = [
    {
      testID: 'metric-today', label: 'Parcels Today',
      value: parcelsToday,   icon: 'today-outline' as any,
      color: Colors.primary, bg: Colors.primaryLight,
    },
    {
      testID: 'metric-transit', label: 'In Transit',
      value: stats?.in_transit ?? '—', icon: 'car-outline' as any,
      color: Colors.warning,  bg: Colors.warningLight,
    },
    {
      testID: 'metric-delivered', label: 'Delivered',
      value: stats?.delivered ?? '—', icon: 'checkmark-circle-outline' as any,
      color: Colors.green,  bg: Colors.greenLight,
    },
    {
      testID: 'metric-failed', label: 'Failed / Returned',
      value: returnedCount, icon: 'close-circle-outline' as any,
      color: Colors.error, bg: Colors.errorLight,
    },
    {
      testID: 'metric-lockers', label: 'Active Lockers',
      value: stats ? `${stats.active_lockers ?? 0}/${stats.total_lockers ?? 0}` : '—',
      icon: 'cube-outline' as any, color: '#7C3AED', bg: '#EDE9FE',
    },
    {
      testID: 'metric-ready', label: 'Ready Pickup',
      value: stats?.ready_for_pickup ?? '—', icon: 'bag-check-outline' as any,
      color: Colors.primaryDark, bg: Colors.primaryLight,
    },
  ];

  // ── Filtered + sorted parcel list ─────────────────────────────────────────
  const displayParcels = useMemo(() => {
    let list = [...allParcels];
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.tracking_code?.toLowerCase().includes(q) ||
        p.sender_name?.toLowerCase().includes(q) ||
        p.recipient_name?.toLowerCase().includes(q) ||
        p.origin_locker_name?.toLowerCase().includes(q) ||
        p.destination_locker_name?.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === 'status') return (a.status || '').localeCompare(b.status || '');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list.slice(0, 20);
  }, [allParcels, statusFilter, search, sortKey]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateParcel = () => router.push('/admin/parcels' as any);
  const handleAssignLocker = () => router.push('/admin/lockers' as any);
  const handleGenerateReport = () =>
    Alert.alert('Generate Report', 'Export functionality coming soon. This will generate a CSV/PDF of all parcel activity.');

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
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadgeWrap}>
              <View style={styles.heroBadge}>
                <Ionicons name="shield-checkmark" size={10} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroBadgeText}>ADMIN PANEL</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout} testID="logout-btn">
              <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>Parcela Network</Text>
          <Text style={styles.heroSub}>
            {`Welcome back, ${user?.name?.split(' ')[0] || 'Admin'}  •  `}
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>

          {/* Total parcels highlight */}
          {stats && (
            <View style={styles.heroHighlight}>
              <View>
                <Text style={styles.heroHighlightLabel}>Total Parcels</Text>
                <Text testID="total-parcels" style={styles.heroHighlightValue}>
                  {stats.total_parcels ?? '—'}
                </Text>
                <Text style={styles.heroHighlightSub}>
                  {stats.total_users ?? 0} users  ·  {stats.total_couriers ?? 0} couriers
                </Text>
              </View>
              <View style={styles.heroHighlightIcon}>
                <Ionicons name="analytics" size={40} color="rgba(255,255,255,0.35)" />
              </View>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 64 }} />
        ) : (
          <>
            {/* ═══════════════════════════════════════════
                GLOBAL ACTIONS
            ═══════════════════════════════════════════ */}
            <View style={styles.actionsSection}>
              <TouchableOpacity style={styles.actionPrimary} onPress={handleCreateParcel} testID="create-parcel-btn">
                <Ionicons name="add-circle" size={16} color={Colors.white} />
                <Text style={styles.actionPrimaryText}>Create Parcel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSecondary} onPress={handleAssignLocker} testID="assign-locker-btn">
                <Ionicons name="cube-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionSecondaryText}>Assign Locker</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSecondary} onPress={handleGenerateReport} testID="generate-report-btn">
                <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionSecondaryText}>Report</Text>
              </TouchableOpacity>
            </View>

            {/* ═══════════════════════════════════════════
                METRICS GRID
            ═══════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.liveDot}>
                <View style={styles.livePulse} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>

            <View style={[styles.metricsGrid, isTablet && styles.metricsGridTablet]}>
              {METRIC_CARDS.map(card => (
                <View
                  key={card.testID}
                  testID={card.testID}
                  style={[
                    styles.metricCard,
                    isTablet && styles.metricCardTablet,
                    { backgroundColor: card.bg },
                  ]}
                >
                  <View style={[styles.metricIconWrap, { backgroundColor: card.color }]}>
                    <Ionicons name={card.icon} size={17} color={Colors.white} />
                  </View>
                  <Text style={[styles.metricValue, { color: card.color }]}>{card.value}</Text>
                  <Text style={styles.metricLabel}>{card.label}</Text>
                </View>
              ))}
            </View>

            {/* ═══════════════════════════════════════════
                RECENT PARCELS — header + controls
            ═══════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Parcels</Text>
              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => setShowSort(v => !v)}
                testID="sort-btn"
              >
                <Ionicons name="swap-vertical-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.sortBtnText}>
                  {SORT_OPTIONS.find(s => s.key === sortKey)?.label}
                </Text>
                <Ionicons
                  name={showSort ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            {/* Sort dropdown */}
            {showSort && (
              <View style={styles.sortDropdown}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortOption, sortKey === opt.key && styles.sortOptionActive]}
                    onPress={() => { setSortKey(opt.key); setShowSort(false); }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={sortKey === opt.key ? Colors.primary : Colors.textSecondary}
                    />
                    <Text style={[
                      styles.sortOptionText,
                      sortKey === opt.key && styles.sortOptionTextActive,
                    ]}>
                      {opt.label}
                    </Text>
                    {sortKey === opt.key && (
                      <Ionicons name="checkmark" size={13} color={Colors.primary} style={styles.sortCheck} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Search bar */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search tracking code, name, locker…"
                placeholderTextColor={Colors.textTertiary}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                testID="parcel-search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollContent}
            >
              {FILTER_OPTIONS.map(f => {
                const sc   = f.key !== 'all' ? STATUS_COLORS[f.key] : null;
                const isActive = statusFilter === f.key;
                const count = f.key === 'all'
                  ? allParcels.length
                  : allParcels.filter(p => p.status === f.key).length;

                return (
                  <TouchableOpacity
                    key={f.key}
                    testID={`filter-${f.key}`}
                    style={[
                      styles.filterChip,
                      isActive && (sc
                        ? { backgroundColor: sc.bg, borderColor: sc.dot }
                        : styles.filterChipAll),
                    ]}
                    onPress={() => setStatusFilter(f.key)}
                  >
                    {sc && isActive && (
                      <View style={[styles.filterDot, { backgroundColor: sc.dot }]} />
                    )}
                    <Text style={[
                      styles.filterChipText,
                      isActive && (sc
                        ? { color: sc.text, fontWeight: '700' }
                        : styles.filterChipTextAll),
                    ]}>
                      {f.label}
                    </Text>
                    <View style={[
                      styles.filterBadge,
                      { backgroundColor: isActive ? (sc?.dot || Colors.primary) : Colors.border },
                    ]}>
                      <Text style={[
                        styles.filterBadgeText,
                        { color: isActive ? Colors.white : Colors.textTertiary },
                      ]}>
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Results summary */}
            <Text style={styles.resultsCount}>
              Showing {displayParcels.length}{' '}
              {displayParcels.length !== allParcels.length
                ? `of ${allParcels.length} parcels`
                : 'parcels'}
              {search ? `  ·  "${search}"` : ''}
            </Text>

            {/* ═══════════════════════════════════════════
                PARCEL CARDS
            ═══════════════════════════════════════════ */}
            {displayParcels.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="cube-outline" size={40} color={Colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No parcels found</Text>
                <Text style={styles.emptyDesc}>
                  {search
                    ? `No results for "${search}". Try a different query.`
                    : 'No parcels match the selected filter.'}
                </Text>
              </View>
            ) : (
              displayParcels.map(p => {
                const sc      = STATUS_COLORS[p.status] || { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
                const iconName= STATUS_ICON_MAP[p.status] || 'cube-outline';
                const eta     = getETA(p);
                const dateStr = formatDate(p.created_at);
                const timeStr = formatTime(p.created_at);

                return (
                  <View
                    key={p.parcel_id}
                    testID={`admin-parcel-${p.parcel_id}`}
                    style={styles.parcelCard}
                  >
                    {/* ── Top: tracking + status badge ── */}
                    <View style={styles.parcelCardTop}>
                      <View style={styles.parcelTrackRow}>
                        <Text style={styles.parcelTracking}>{p.tracking_code}</Text>
                        {p.size ? (
                          <View style={styles.sizePill}>
                            <Text style={styles.sizePillText}>{p.size.toUpperCase()}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.dot }]}>
                        <Ionicons name={iconName} size={11} color={sc.text} />
                        <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Text>
                      </View>
                    </View>

                    {/* ── Sender → Receiver ── */}
                    <View style={styles.peopleRow}>
                      <View style={styles.personBlock}>
                        <View style={styles.personIconUp}>
                          <Ionicons name="arrow-up-outline" size={10} color={Colors.white} />
                        </View>
                        <Text style={styles.personName} numberOfLines={1}>
                          {p.sender_name || 'Unknown Sender'}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={13} color={Colors.textTertiary} style={styles.arrowIcon} />
                      <View style={styles.personBlock}>
                        <View style={styles.personIconDown}>
                          <Ionicons name="arrow-down-outline" size={10} color={Colors.white} />
                        </View>
                        <Text style={styles.personName} numberOfLines={1}>
                          {p.recipient_name || 'Unknown Recipient'}
                        </Text>
                      </View>
                    </View>

                    {/* ── Route ── */}
                    <View style={styles.routeRow}>
                      <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {p.origin_locker_name || '—'}  →  {p.destination_locker_name || '—'}
                      </Text>
                    </View>

                    {/* ── Meta: date · ETA · price ── */}
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={11} color={Colors.textTertiary} />
                      <Text style={styles.metaText}>{dateStr} {timeStr}</Text>
                      <View style={styles.metaDot} />
                      <Ionicons name="flag-outline" size={11} color={Colors.textTertiary} />
                      <Text style={styles.metaText}>ETA {eta}</Text>
                      {p.price != null && (
                        <>
                          <View style={styles.metaDot} />
                          <Text style={styles.metaPrice}>
                            {p.price.toLocaleString()} RWF
                          </Text>
                        </>
                      )}
                    </View>

                    {/* ── Action buttons ── */}
                    <View style={styles.parcelActions}>
                      <TouchableOpacity
                        style={styles.actionOutline}
                        onPress={() => router.push('/admin/parcels' as any)}
                        testID={`view-${p.parcel_id}`}
                      >
                        <Ionicons name="eye-outline" size={13} color={Colors.primary} />
                        <Text style={[styles.actionOutlineText, { color: Colors.primary }]}>View</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionOutline}
                        onPress={() => router.push('/admin/parcels' as any)}
                        testID={`edit-${p.parcel_id}`}
                      >
                        <Ionicons name="swap-horizontal-outline" size={13} color={Colors.warning} />
                        <Text style={[styles.actionOutlineText, { color: Colors.warning }]}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionOutline}
                        onPress={() => router.push('/(user)/track' as any)}
                        testID={`track-${p.parcel_id}`}
                      >
                        <Ionicons name="location-outline" size={13} color={Colors.green} />
                        <Text style={[styles.actionOutlineText, { color: Colors.green }]}>Track</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionFilled}
                        onPress={() => router.push('/admin/parcels' as any)}
                        testID={`assign-${p.parcel_id}`}
                      >
                        <Ionicons name="person-add-outline" size={13} color={Colors.white} />
                        <Text style={styles.actionFilledText}>Assign</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        <View style={{ height: 56 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroBadgeWrap: { flexDirection: 'row' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2,
  },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 26, fontWeight: '900', color: Colors.white,
    letterSpacing: -0.5, marginBottom: 2,
  },
  heroSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '500', marginBottom: 16,
  },
  heroHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroHighlightLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.68)', marginBottom: 4,
  },
  heroHighlightValue: {
    fontSize: 48, fontWeight: '900', color: Colors.white, lineHeight: 52,
  },
  heroHighlightSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2,
  },
  heroHighlightIcon: { opacity: 0.6 },

  // ── Global Actions ─────────────────────────────────────────────────────────
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionPrimary: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    ...Shadows.primary,
  },
  actionPrimaryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  actionSecondaryText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },

  // ── Section headers ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  livePulse: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: Colors.green,
  },
  liveText: { fontSize: 11, fontWeight: '700', color: Colors.green },

  // ── Metrics grid ───────────────────────────────────────────────────────────
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 4,
  },
  metricsGridTablet: { gap: 12 },
  metricCard: {
    width: '47%',
    borderRadius: 18,
    padding: 14,
    gap: 6,
    ...Shadows.card,
  },
  metricCardTablet: { width: '31%' },
  metricIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  metricValue: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  metricLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  // ── Sort controls ─────────────────────────────────────────────────────────
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  sortDropdown: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sortOptionActive: { backgroundColor: Colors.primaryLight },
  sortOptionText: { flex: 1, fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  sortOptionTextActive: { color: Colors.primary, fontWeight: '700' },
  sortCheck: { marginLeft: 'auto' },

  // ── Search ────────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginBottom: 10,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterScroll: { marginBottom: 6 },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 7,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterChipAll: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextAll: { color: Colors.white, fontWeight: '700' },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '800' },

  // ── Results count ─────────────────────────────────────────────────────────
  resultsCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 52,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // ── Parcel cards ──────────────────────────────────────────────────────────
  parcelCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  // Tracking + status
  parcelCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  parcelTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  parcelTracking: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  sizePill: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6,
  },
  sizePillText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  // People
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  personBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  personIconUp: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  personIconDown: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
  personName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  arrowIcon: { marginHorizontal: 4 },

  // Route
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  routeText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  metaText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  metaDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: 2,
  },
  metaPrice: { fontSize: 11, fontWeight: '700', color: Colors.primary },

  // Action buttons
  parcelActions: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  actionOutlineText: { fontSize: 11, fontWeight: '700' },
  actionFilled: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    ...Shadows.primary,
  },
  actionFilledText: { fontSize: 11, fontWeight: '700', color: Colors.white },
});
