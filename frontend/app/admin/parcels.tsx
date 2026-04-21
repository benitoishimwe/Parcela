import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  ScrollView, KeyboardAvoidingView, Platform, TextInput,
  Animated, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows, STATUS_COLORS, STATUS_LABELS } from '../../constants/Colors';
import { api } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = [
  'awaiting_payment', 'awaiting_dropoff', 'dropped_off',
  'in_transit', 'ready_for_pickup', 'delivered', 'returned',
];

const STATUS_ICON_MAP: Record<string, any> = {
  awaiting_payment:  'card-outline',
  awaiting_dropoff:  'clipboard-outline',
  dropped_off:       'download-outline',
  in_transit:        'car-outline',
  ready_for_pickup:  'mail-outline',
  delivered:         'checkmark-circle-outline',
  returned:          'return-down-back-outline',
};

const SIZE_COLORS: Record<string, { bg: string; text: string }> = {
  small:  { bg: '#EDE9FE', text: '#5B21B6' },
  medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  large:  { bg: '#FEF3C7', text: '#92400E' },
  xl:     { bg: '#FEE2E2', text: '#991B1B' },
};

const TASK_TYPES = [
  { key: 'collect', label: 'Collect', icon: 'arrow-up-circle-outline',   desc: 'Pick up from origin locker' },
  { key: 'deliver', label: 'Deliver', icon: 'arrow-down-circle-outline', desc: 'Deliver to destination locker' },
] as const;

const STATUS_FILTERS = [
  { key: 'all',              label: 'All' },
  { key: 'in_transit',       label: 'In Transit' },
  { key: 'ready_for_pickup', label: 'Ready' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'awaiting_dropoff', label: 'Awaiting' },
  { key: 'awaiting_payment', label: 'Payment' },
  { key: 'returned',         label: 'Returned' },
];

const SORT_OPTIONS = [
  { key: 'newest',   label: 'Newest First',     icon: 'arrow-down-outline' as const },
  { key: 'oldest',   label: 'Oldest First',     icon: 'arrow-up-outline' as const },
  { key: 'status',   label: 'By Status',         icon: 'funnel-outline' as const },
  { key: 'price_hi', label: 'Price: High → Low', icon: 'trending-down-outline' as const },
  { key: 'price_lo', label: 'Price: Low → High', icon: 'trending-up-outline' as const },
];

const PAGE_SIZE = 12;

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function isOverdue(parcel: any): boolean {
  if (['delivered', 'returned', 'awaiting_payment'].includes(parcel.status)) return false;
  if (!parcel.created_at) return false;
  const eta = new Date(parcel.created_at);
  eta.setDate(eta.getDate() + 2);
  return new Date() > eta;
}

// ── Animated Parcel Card ───────────────────────────────────────────────────────

interface ParcelCardProps {
  item: any;
  couriers: any[];
  onAssign: (item: any) => void;
  onStatusUpdate: (id: string, status: string) => void;
  onPrintLabel: (item: any) => void;
}

function ParcelCard({ item, couriers, onAssign, onStatusUpdate, onPrintLabel }: ParcelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sc            = STATUS_COLORS[item.status] || { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
  const iconName      = STATUS_ICON_MAP[item.status] || 'cube-outline';
  const sizeKey       = item.size?.toLowerCase() ?? '';
  const sizeColor     = SIZE_COLORS[sizeKey] || { bg: Colors.surfaceElevated, text: Colors.textSecondary };
  const overdue       = isOverdue(item);
  const assignedCourier = couriers.find(c => c.user_id === item.courier_id);

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.984, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 3 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], marginBottom: 10 }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => setExpanded(v => !v)}
        style={styles.parcelCard}
        accessibilityRole="button"
        accessibilityLabel={`Parcel ${item.tracking_code}`}
        testID={`admin-parcel-item-${item.parcel_id}`}
      >
        {/* Fluent 2 left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: overdue ? Colors.error : sc.dot }]} />

        <View style={styles.cardBody}>

          {/* Row 1 — tracking code + size + status badge */}
          <View style={styles.cardTopRow}>
            <View style={styles.trackingGroup}>
              <View style={[styles.statusIconCircle, { backgroundColor: sc.bg }]}>
                <Ionicons name={iconName} size={13} color={sc.dot} />
              </View>
              <Text style={styles.trackingCode} numberOfLines={1}>{item.tracking_code}</Text>
              {overdue && (
                <View style={styles.overdueChip}>
                  <Ionicons name="warning-outline" size={9} color="#DC2626" />
                  <Text style={styles.overdueText}>Overdue</Text>
                </View>
              )}
            </View>
            <View style={styles.badgesGroup}>
              {sizeKey ? (
                <View style={[styles.sizePill, { backgroundColor: sizeColor.bg }]}>
                  <Text style={[styles.sizePillText, { color: sizeColor.text }]}>
                    {sizeKey.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.dot + '55' }]}>
                <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
                <Text style={[styles.statusBadgeText, { color: sc.text }]}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Row 2 — sender → recipient */}
          <View style={styles.peopleRow}>
            <View style={styles.personChip}>
              <View style={[styles.personDot, { backgroundColor: Colors.primary }]}>
                <Ionicons name="arrow-up-outline" size={8} color={Colors.white} />
              </View>
              <Text style={styles.personName} numberOfLines={1}>{item.sender_name || '—'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={11} color={Colors.textTertiary} style={{ marginHorizontal: 2 }} />
            <View style={styles.personChip}>
              <View style={[styles.personDot, { backgroundColor: Colors.green }]}>
                <Ionicons name="arrow-down-outline" size={8} color={Colors.white} />
              </View>
              <Text style={styles.personName} numberOfLines={1}>{item.recipient_name || '—'}</Text>
            </View>
          </View>

          {/* Row 3 — route */}
          <View style={styles.routeRow}>
            <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.origin_locker_name || '—'}  →  {item.destination_locker_name || '—'}
            </Text>
          </View>

          {/* Row 4 — meta: date · price · courier indicator */}
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <Ionicons name="calendar-outline" size={10} color={Colors.textTertiary} />
              <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
              {item.price != null && (
                <>
                  <View style={styles.metaDot} />
                  <Text style={styles.metaPrice}>{item.price.toLocaleString()} RWF</Text>
                </>
              )}
            </View>
            {assignedCourier ? (
              <View style={styles.courierPill}>
                <Ionicons name="bicycle-outline" size={10} color={Colors.primary} />
                <Text style={styles.courierPillText} numberOfLines={1}>
                  {assignedCourier.name?.split(' ')[0]}
                </Text>
              </View>
            ) : (
              <View style={styles.unassignedPill}>
                <Ionicons name="person-outline" size={10} color={Colors.textTertiary} />
                <Text style={styles.unassignedPillText}>Unassigned</Text>
              </View>
            )}
          </View>

          {/* Row 5 — action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID={`assign-courier-${item.parcel_id}`}
              style={styles.btnPrimary}
              onPress={() => onAssign(item)}
            >
              <Ionicons name="person-add-outline" size={12} color={Colors.white} />
              <Text style={styles.btnPrimaryText}>Assign</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`update-status-${item.parcel_id}`}
              style={styles.btnOutline}
              onPress={() => onStatusUpdate(item.parcel_id, item.status)}
            >
              <Ionicons name="swap-horizontal-outline" size={12} color={Colors.primary} />
              <Text style={styles.btnOutlineText}>Status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: Colors.borderLight }]}
              onPress={() => onPrintLabel(item)}
            >
              <Ionicons name="print-outline" size={12} color={Colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: Colors.textSecondary }]}>Label</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnGhost}
              onPress={() => setExpanded(v => !v)}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Expandable — extra details + secondary actions */}
          {expanded && (
            <View style={styles.expandedPanel}>
              <View style={styles.expandDivider} />

              <View style={styles.expandRow}>
                <View style={styles.expandLabel}>
                  <Ionicons name="flag-outline" size={11} color={Colors.textTertiary} />
                  <Text style={styles.expandLabelText}>ETA</Text>
                </View>
                <Text style={[styles.expandValue, overdue && { color: Colors.error, fontWeight: '700' }]}>
                  {getETA(item)}{overdue ? '  ⚠ Delayed' : ''}
                </Text>
              </View>

              <View style={styles.expandRow}>
                <View style={styles.expandLabel}>
                  <Ionicons name="cube-outline" size={11} color={Colors.textTertiary} />
                  <Text style={styles.expandLabelText}>Dest. Locker</Text>
                </View>
                <Text style={styles.expandValue}>{item.destination_locker_name || '—'}</Text>
              </View>

              <View style={styles.expandRow}>
                <View style={styles.expandLabel}>
                  <Ionicons name="barcode-outline" size={11} color={Colors.textTertiary} />
                  <Text style={styles.expandLabelText}>Parcel ID</Text>
                </View>
                <Text style={[styles.expandValue, { fontSize: 11, color: Colors.textSecondary }]}>
                  {item.parcel_id}
                </Text>
              </View>

              <View style={styles.expandActions}>
                <TouchableOpacity style={styles.btnExpand}>
                  <Ionicons name="git-branch-outline" size={13} color={Colors.primary} />
                  <Text style={styles.btnExpandText}>View Timeline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnExpand}>
                  <Ionicons name="eye-outline" size={13} color={Colors.primary} />
                  <Text style={styles.btnExpandText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function AdminParcels() {
  const { token, loading: authLoading } = useAuth();

  const [parcels,    setParcels]    = useState<any[]>([]);
  const [couriers,   setCouriers]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [sizeFilter,    setSizeFilter]    = useState('all');
  const [sortKey,       setSortKey]       = useState('newest');
  const [showSort,      setShowSort]      = useState(false);
  const [showFilters,   setShowFilters]   = useState(false);

  const [page,        setPage]        = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [assignTarget,    setAssignTarget]    = useState<any | null>(null);
  const [taskType,        setTaskType]        = useState<'collect' | 'deliver'>('collect');
  const [selectedCourier, setSelectedCourier] = useState('');
  const [assignLoading,   setAssignLoading]   = useState(false);
  const [assignError,     setAssignError]     = useState('');
  const [assignSuccess,   setAssignSuccess]   = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchParcels = async () => {
    try {
      const data = await api.get('/api/parcels');
      setParcels(Array.isArray(data) ? data : []);
      setFetchError('');
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load parcels');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const fetchCouriers = async () => {
    try {
      const data = await api.get('/api/users');
      setCouriers((data as any[]).filter((u: any) => u.role === 'courier'));
    } catch {}
  };

  useEffect(() => {
    if (!authLoading) { fetchParcels(); fetchCouriers(); }
  }, [authLoading]);

  const onRefresh = () => { setRefreshing(true); setPage(1); fetchParcels(); };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...parcels];
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    if (sizeFilter !== 'all')   list = list.filter(p => p.size?.toLowerCase() === sizeFilter);
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
      if (sortKey === 'oldest')   return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === 'status')   return (a.status || '').localeCompare(b.status || '');
      if (sortKey === 'price_hi') return (b.price || 0) - (a.price || 0);
      if (sortKey === 'price_lo') return (a.price || 0) - (b.price || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [parcels, statusFilter, sizeFilter, search, sortKey]);

  const paged   = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paged.length < filtered.length;

  useEffect(() => { setPage(1); }, [statusFilter, sizeFilter, search, sortKey]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => { setPage(p => p + 1); setLoadingMore(false); }, 250);
  }, [hasMore, loadingMore]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: parcels.length };
    for (const p of parcels) counts[p.status] = (counts[p.status] || 0) + 1;
    return counts;
  }, [parcels]);

  const overdueCount = parcels.filter(isOverdue).length;
  const unassignedCount = parcels.filter(
    p => !p.courier_id && !['delivered', 'returned', 'awaiting_payment'].includes(p.status)
  ).length;

  const activeFilterCount = [
    statusFilter !== 'all',
    sizeFilter !== 'all',
    search.trim().length > 0,
  ].filter(Boolean).length;

  // ── Status update ────────────────────────────────────────────────────────────

  const handleStatusUpdate = (parcelId: string, currentStatus: string) => {
    const next = STATUS_ORDER.filter(s => s !== currentStatus);
    Alert.alert('Update Status', `Current: ${STATUS_LABELS[currentStatus] || currentStatus}`, [
      ...next.slice(0, 5).map(s => ({
        text: STATUS_LABELS[s] || s,
        onPress: async () => {
          try {
            await api.put(`/api/parcels/${parcelId}/status`, { status: s, note: 'Updated by admin' }, token || undefined);
            fetchParcels();
          } catch (err: any) { Alert.alert('Error', err.message); }
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Assign courier ────────────────────────────────────────────────────────────

  const openAssign = (parcel: any) => {
    setAssignTarget(parcel);
    setTaskType('collect');
    setSelectedCourier('');
    setAssignError('');
    setAssignSuccess('');
  };

  const handleAssign = async () => {
    if (!selectedCourier) { setAssignError('Please select a courier'); return; }
    setAssignLoading(true);
    setAssignError('');
    try {
      const result = await api.post(
        `/api/parcels/${assignTarget.parcel_id}/assign`,
        { courier_id: selectedCourier, type: taskType },
      );
      const name = couriers.find(c => c.user_id === selectedCourier)?.name || 'courier';
      setAssignSuccess(`Assigned to ${name}! Task ${result.task_id} created.`);
      setTimeout(() => { setAssignTarget(null); setAssignSuccess(''); fetchParcels(); }, 2000);
    } catch (err: any) {
      setAssignError(err.message || 'Assignment failed');
    } finally {
      setAssignLoading(false);
    }
  };

  const handlePrintLabel = (item: any) => {
    Alert.alert(
      'Print Label',
      `Generating shipping label for ${item.tracking_code}…\n\nThis will produce a PDF label for the parcel.`,
      [{ text: 'OK' }],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Parcels</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Loading…' : `${filtered.length} of ${parcels.length} total`}
          </Text>
        </View>
        <View style={styles.headerIndicators}>
          {overdueCount > 0 && (
            <View style={styles.alertPill}>
              <Ionicons name="warning-outline" size={11} color="#DC2626" />
              <Text style={styles.alertPillText}>{overdueCount} overdue</Text>
            </View>
          )}
          {unassignedCount > 0 && (
            <View style={styles.warningPill}>
              <Ionicons name="person-outline" size={11} color={Colors.warning} />
              <Text style={styles.warningPillText}>{unassignedCount} unassigned</Text>
            </View>
          )}
        </View>
      </View>

      {/* ══ SEARCH + CONTROLS BAR ═══════════════════════════════════════════ */}
      <View style={styles.controlsBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tracking, name, locker…"
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            testID="parcel-search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name="close-circle" size={15} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort button */}
        <TouchableOpacity
          testID="sort-btn"
          style={[styles.iconBtn, showSort && styles.iconBtnActive]}
          onPress={() => { setShowSort(v => !v); setShowFilters(false); }}
        >
          <Ionicons name="swap-vertical-outline" size={17} color={showSort ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>

        {/* Filter button */}
        <TouchableOpacity
          testID="filter-btn"
          style={[styles.iconBtn, (showFilters || activeFilterCount > 0) && styles.iconBtnActive]}
          onPress={() => { setShowFilters(v => !v); setShowSort(false); }}
        >
          <Ionicons
            name="options-outline"
            size={17}
            color={(showFilters || activeFilterCount > 0) ? Colors.primary : Colors.textSecondary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.iconBtnBadge}>
              <Text style={styles.iconBtnBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ══ SORT DROPDOWN ═══════════════════════════════════════════════════ */}
      {showSort && (
        <View style={styles.dropdownCard}>
          <Text style={styles.dropdownHeading}>Sort By</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.dropdownOption, sortKey === opt.key && styles.dropdownOptionActive]}
              onPress={() => { setSortKey(opt.key); setShowSort(false); }}
            >
              <Ionicons name={opt.icon} size={14} color={sortKey === opt.key ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.dropdownOptionText, sortKey === opt.key && styles.dropdownOptionTextActive]}>
                {opt.label}
              </Text>
              {sortKey === opt.key && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ══ FILTERS PANEL ═══════════════════════════════════════════════════ */}
      {showFilters && (
        <View style={styles.dropdownCard}>
          <View style={styles.filtersHeader}>
            <Text style={styles.dropdownHeading}>Filters</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={() => { setStatusFilter('all'); setSizeFilter('all'); setSearch(''); }}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.filterGroupLabel}>SIZE</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {['all', 'small', 'medium', 'large', 'xl'].map(s => {
              const isActive = sizeFilter === s;
              const sc = s !== 'all' ? SIZE_COLORS[s] : null;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, isActive && { backgroundColor: sc?.bg || Colors.textPrimary, borderColor: 'transparent' }]}
                  onPress={() => setSizeFilter(s)}
                >
                  <Text style={[styles.filterChipText, isActive && { color: sc?.text || Colors.white, fontWeight: '700' }]}>
                    {s === 'all' ? 'Any' : s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ══ STATUS CHIPS (always visible) ═══════════════════════════════════ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipStrip}
        contentContainerStyle={styles.chipStripContent}
      >
        {STATUS_FILTERS.map(f => {
          const isActive = statusFilter === f.key;
          const sc       = f.key !== 'all' ? STATUS_COLORS[f.key] : null;
          return (
            <TouchableOpacity
              key={f.key}
              testID={`parcel-filter-${f.key}`}
              style={[
                styles.statusChip,
                isActive && (sc
                  ? { backgroundColor: sc.bg, borderColor: sc.dot }
                  : { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary }
                ),
              ]}
              onPress={() => setStatusFilter(f.key)}
            >
              {sc && isActive && <View style={[styles.chipDot, { backgroundColor: sc.dot }]} />}
              <Text style={[
                styles.statusChipText,
                isActive && (sc
                  ? { color: sc.text,      fontWeight: '700' }
                  : { color: Colors.white, fontWeight: '700' }
                ),
              ]}>
                {f.label}
              </Text>
              <View style={[styles.chipCount, { backgroundColor: isActive ? (sc?.dot || Colors.primary) : Colors.surfaceElevated }]}>
                <Text style={[styles.chipCountText, { color: isActive ? Colors.white : Colors.textTertiary }]}>
                  {statusCounts[f.key] ?? 0}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ══ ERROR BANNER ════════════════════════════════════════════════════ */}
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ══ RESULTS LABEL ═══════════════════════════════════════════════════ */}
      {!loading && (
        <Text style={styles.resultsLabel}>
          Showing {paged.length} of {filtered.length} parcels
          {search ? `  ·  "${search}"` : ''}
        </Text>
      )}

      {/* ══ LIST ════════════════════════════════════════════════════════════ */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading parcels…</Text>
        </View>
      ) : (
        <FlatList
          data={paged}
          keyExtractor={item => item.parcel_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={44} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No parcels found</Text>
              <Text style={styles.emptyDesc}>
                {search
                  ? `No results for "${search}". Try a different query.`
                  : 'No parcels match the selected filters.'}
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => { setStatusFilter('all'); setSizeFilter('all'); setSearch(''); }}
                >
                  <Text style={styles.clearBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                {loadingMore
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : (
                    <>
                      <Ionicons name="chevron-down-outline" size={14} color={Colors.primary} />
                      <Text style={styles.loadMoreText}>
                        Load more  ({filtered.length - paged.length} remaining)
                      </Text>
                    </>
                  )
                }
              </TouchableOpacity>
            ) : paged.length > 0 ? (
              <Text style={styles.endOfList}>All {filtered.length} parcels shown</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <ParcelCard
              item={item}
              couriers={couriers}
              onAssign={openAssign}
              onStatusUpdate={handleStatusUpdate}
              onPrintLabel={handlePrintLabel}
            />
          )}
        />
      )}

      {/* ══ ASSIGN COURIER MODAL ════════════════════════════════════════════ */}
      <Modal
        visible={!!assignTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignTarget(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.dragHandle} />

              {/* Modal header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Assign Courier</Text>
                  <Text style={styles.modalSub}>{assignTarget?.tracking_code}</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={() => setAssignTarget(null)}>
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Route info */}
              <View style={styles.routeInfoBox}>
                <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
                <Text style={styles.routeInfoText} numberOfLines={1}>
                  {assignTarget?.origin_locker_name} → {assignTarget?.destination_locker_name}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Task type */}
                <Text style={styles.modalSectionLabel}>TASK TYPE</Text>
                <View style={styles.typeRow}>
                  {TASK_TYPES.map(tt => (
                    <TouchableOpacity
                      key={tt.key}
                      testID={`task-type-${tt.key}`}
                      style={[styles.typeChip, taskType === tt.key && styles.typeChipActive]}
                      onPress={() => setTaskType(tt.key)}
                    >
                      <Ionicons
                        name={tt.icon as any}
                        size={18}
                        color={taskType === tt.key ? Colors.white : Colors.textSecondary}
                      />
                      <View>
                        <Text style={[styles.typeLabel, taskType === tt.key && { color: Colors.white }]}>
                          {tt.label}
                        </Text>
                        <Text style={[styles.typeDesc, taskType === tt.key && { color: 'rgba(255,255,255,0.7)' }]}>
                          {tt.desc}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Courier list */}
                <Text style={styles.modalSectionLabel}>SELECT COURIER</Text>
                {couriers.length === 0 ? (
                  <View style={styles.noCouriersWrap}>
                    <Ionicons name="people-outline" size={32} color={Colors.textTertiary} />
                    <Text style={styles.noCouriersTitle}>No couriers available</Text>
                    <Text style={styles.noCouriersSub}>Add couriers in the Users tab.</Text>
                  </View>
                ) : (
                  couriers.map(c => {
                    const sel = selectedCourier === c.user_id;
                    return (
                      <TouchableOpacity
                        key={c.user_id}
                        testID={`courier-option-${c.user_id}`}
                        style={[styles.courierRow, sel && styles.courierRowSelected]}
                        onPress={() => setSelectedCourier(c.user_id)}
                      >
                        <View style={[styles.courierAvatar, sel && styles.courierAvatarSelected]}>
                          <Text style={[styles.courierInitial, sel && { color: Colors.white }]}>
                            {c.name?.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.courierName, sel && { color: Colors.primary }]}>{c.name}</Text>
                          <Text style={styles.courierContact}>{c.phone || c.email || ''}</Text>
                        </View>
                        {sel && (
                          <View style={styles.courierCheck}>
                            <Ionicons name="checkmark" size={13} color={Colors.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {assignSuccess ? (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={15} color={Colors.green} />
                  <Text style={styles.successText}>{assignSuccess}</Text>
                </View>
              ) : null}

              {assignError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                  <Text style={styles.errorText}>{assignError}</Text>
                </View>
              ) : null}

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAssignTarget(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="confirm-assign-btn"
                  style={[styles.confirmBtn, (assignLoading || !selectedCourier) && { opacity: 0.5 }]}
                  onPress={handleAssign}
                  disabled={assignLoading || !selectedCourier}
                >
                  {assignLoading
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : (
                      <>
                        <Ionicons name="checkmark" size={16} color={Colors.white} />
                        <Text style={styles.confirmBtnText}>Assign Courier</Text>
                      </>
                    )
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  headerSub:   { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', marginTop: 2 },
  headerIndicators: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end',
  },
  alertPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  alertPillText: { fontSize: 11, color: '#DC2626', fontWeight: '700' },
  warningPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.warningLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  warningPillText: { fontSize: 11, color: Colors.warning, fontWeight: '700' },

  // Controls bar
  controlsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary + '55' },
  iconBtnBadge: {
    position: 'absolute', top: 5, right: 5,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  iconBtnBadgeText: { fontSize: 8, fontWeight: '800', color: Colors.white },

  // Dropdown card (sort + filter)
  dropdownCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 2,
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 14, borderWidth: 1.5, borderColor: Colors.border,
    ...Shadows.card, zIndex: 10,
  },
  dropdownHeading: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.3, marginBottom: 8 },
  dropdownOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 8, borderRadius: 10,
  },
  dropdownOptionActive:     { backgroundColor: Colors.primaryLight },
  dropdownOptionText:       { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  dropdownOptionTextActive: { color: Colors.primary, fontWeight: '700' },

  filtersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clearAllText:   { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  filterGroupLabel: { fontSize: 10, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 0.8, marginBottom: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  // Status chip strip
  chipStrip:        { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  chipStripContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipDot:       { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  chipCountText: { fontSize: 10, fontWeight: '700' },

  // Banners
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorLight, marginHorizontal: 16, marginTop: 8,
    padding: 10, borderRadius: 10,
  },
  errorText:  { flex: 1, fontSize: 12, color: Colors.error },
  retryText:  { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Results label
  resultsLabel: {
    fontSize: 11, color: Colors.textTertiary, fontWeight: '500',
    paddingHorizontal: 20, paddingVertical: 6,
  },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textTertiary, fontWeight: '500' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 52 },

  // Parcel card (Fluent 2 elevation + left accent)
  parcelCard: {
    backgroundColor: Colors.white,
    borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: 13 },

  // Card top row
  cardTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, gap: 8 },
  trackingGroup: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  statusIconCircle: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  trackingCode: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  overdueChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  overdueText:  { fontSize: 9, fontWeight: '800', color: '#DC2626' },
  badgesGroup:  { flexDirection: 'row', gap: 5, alignItems: 'center' },
  sizePill:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sizePillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  statusDot:       { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  // People row
  peopleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7, marginBottom: 7,
  },
  personChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  personDot:  { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, flex: 1 },

  // Route row
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  routeText: { flex: 1, fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  // Meta row
  metaRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  metaDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textTertiary, marginHorizontal: 3 },
  metaPrice: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  courierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  courierPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary, maxWidth: 70 },
  unassignedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.surfaceElevated, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  unassignedPillText: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary },

  // Card action row
  actionsRow: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 9,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    ...Shadows.primary,
  },
  btnPrimaryText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  btnOutlineText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  btnGhost: {
    width: 30, height: 30, borderRadius: 8, marginLeft: 'auto',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
  },

  // Expandable panel
  expandedPanel: { marginTop: 6 },
  expandDivider: { height: 1, backgroundColor: Colors.borderLight, marginBottom: 10 },
  expandRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4,
  },
  expandLabel:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  expandLabelText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  expandValue:     { fontSize: 12, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  expandActions:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnExpand: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.primaryLight, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.primary + '28',
  },
  btnExpandText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyDesc:  { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  clearBtn: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.primary + '30',
  },
  clearBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Load more / end of list
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.white, marginTop: 8, marginHorizontal: 16,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, ...Shadows.sm,
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  endOfList:    { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 16 },

  // Assign modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalSub:   { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginTop: 1 },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  routeInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 10, marginBottom: 16,
  },
  routeInfoText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '600' },
  modalSectionLabel: {
    fontSize: 10, fontWeight: '800', color: Colors.textTertiary,
    marginBottom: 8, letterSpacing: 0.8,
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  typeDesc:  { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  noCouriersWrap:  { alignItems: 'center', paddingVertical: 24, gap: 6 },
  noCouriersTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  noCouriersSub:   { fontSize: 12, color: Colors.textTertiary, textAlign: 'center' },

  courierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceElevated,
  },
  courierRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  courierAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  courierAvatarSelected: { backgroundColor: Colors.primary },
  courierInitial:  { fontSize: 16, fontWeight: '800', color: Colors.textSecondary },
  courierName:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  courierContact:  { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  courierCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.greenLight, padding: 10, borderRadius: 10, marginTop: 12,
  },
  successText: { flex: 1, fontSize: 13, color: Colors.green, fontWeight: '600' },

  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  confirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, ...Shadows.primary,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
