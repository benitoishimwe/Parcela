import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Modal, TextInput, ScrollView, KeyboardAvoidingView,
  Platform, LayoutAnimation, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_OPTS = ['active', 'maintenance', 'offline'];

const STATUS_META: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  active:      { color: Colors.green,   bg: Colors.greenLight,   icon: 'checkmark-circle', label: 'Active' },
  maintenance: { color: Colors.warning, bg: Colors.warningLight, icon: 'construct',         label: 'Maintenance' },
  offline:     { color: Colors.error,   bg: Colors.errorLight,   icon: 'close-circle',      label: 'Offline' },
};

const SORT_OPTIONS = [
  { key: 'name',      label: 'Name A–Z',       icon: 'text-outline' },
  { key: 'status',    label: 'Status',          icon: 'funnel-outline' },
  { key: 'available', label: 'Most Available',  icon: 'layers-outline' },
  { key: 'district',  label: 'District',        icon: 'map-outline' },
] as const;
type SortKey = typeof SORT_OPTIONS[number]['key'];

const INITIAL_FORM = {
  name: '', address: '', district: '',
  lat: '', lng: '',
  total_small: '10', total_medium: '8', total_large: '4',
};

const KIGALI_DISTRICTS = ['Nyarugenge', 'Gasabo', 'Kicukiro'];
const PAGE_SIZE = 8;

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso: string | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getAvailability(locker: any) {
  const avail = (locker.available_small ?? 0) + (locker.available_medium ?? 0) + (locker.available_large ?? 0);
  const total = (locker.total_small ?? 0) + (locker.total_medium ?? 0) + (locker.total_large ?? 0);
  return { avail, total, ratio: total > 0 ? avail / total : 0 };
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminLockers() {
  const { token, loading: authLoading } = useAuth();

  const [lockers,    setLockers]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [showModal,   setShowModal]   = useState(false);
  const [editLocker,  setEditLocker]  = useState<any>(null);
  const [form,        setForm]        = useState({ ...INITIAL_FORM });
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');

  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [availFilter,    setAvailFilter]    = useState('all');
  const [sortKey,        setSortKey]        = useState<SortKey>('name');
  const [showSort,       setShowSort]       = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [page,           setPage]           = useState(1);

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchLockers = async () => {
    try {
      const data = await api.get('/api/lockers');
      const seen = new Set<string>();
      const unique = (Array.isArray(data) ? data : []).filter((l: any) => {
        if (seen.has(l.locker_id)) return false;
        seen.add(l.locker_id);
        return true;
      });
      setLockers(unique);
      setFetchError('');
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load lockers');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { if (!authLoading) fetchLockers(); }, [authLoading]);
  const onRefresh = () => { setRefreshing(true); fetchLockers(); };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    total:       lockers.length,
    active:      lockers.filter(l => l.status === 'active').length,
    maintenance: lockers.filter(l => l.status === 'maintenance').length,
    offline:     lockers.filter(l => l.status === 'offline').length,
  }), [lockers]);

  const allDistricts = useMemo(() =>
    Array.from(new Set(lockers.map(l => l.district).filter(Boolean))).sort() as string[],
    [lockers],
  );

  // ── Filtered / sorted / paginated ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...lockers];
    if (statusFilter !== 'all')   list = list.filter(l => l.status === statusFilter);
    if (districtFilter !== 'all') list = list.filter(l => l.district === districtFilter);
    if (availFilter === 'available') list = list.filter(l => getAvailability(l).avail > 0);
    if (availFilter === 'full')      list = list.filter(l => getAvailability(l).avail === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q) ||
        l.district?.toLowerCase().includes(q) ||
        l.locker_id?.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'name')      return (a.name || '').localeCompare(b.name || '');
      if (sortKey === 'status')    return (a.status || '').localeCompare(b.status || '');
      if (sortKey === 'available') return getAvailability(b).avail - getAvailability(a).avail;
      if (sortKey === 'district')  return (a.district || '').localeCompare(b.district || '');
      return 0;
    });
    return list;
  }, [lockers, statusFilter, districtFilter, availFilter, search, sortKey]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore   = paginated.length < filtered.length;
  const hasActiveFilters = !!(search || statusFilter !== 'all' || districtFilter !== 'all' || availFilter !== 'all');

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => { setEditLocker(null); setForm({ ...INITIAL_FORM }); setShowModal(true); };

  const openEdit = (locker: any) => {
    setEditLocker(locker);
    setForm({
      name: locker.name || '', address: locker.address || '', district: locker.district || '',
      lat: String(locker.lat || ''), lng: String(locker.lng || ''),
      total_small: String(locker.total_small || 10),
      total_medium: String(locker.total_medium || 8),
      total_large: String(locker.total_large || 4),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!form.name.trim() || !form.address.trim() || !form.district.trim()) {
      setSaveError('Name, address, and district are required'); return;
    }
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng);
    if (!editLocker && (isNaN(lat) || isNaN(lng))) {
      setSaveError('Please enter valid coordinates'); return;
    }
    setSaving(true);
    try {
      if (editLocker) {
        await api.put(`/api/lockers/${editLocker.locker_id}`, {
          name: form.name.trim(), address: form.address.trim(), district: form.district.trim(),
        }, token || undefined);
      } else {
        await api.post('/api/lockers', {
          name: form.name.trim(), address: form.address.trim(), district: form.district.trim(),
          lat, lng,
          total_small: parseInt(form.total_small) || 10,
          total_medium: parseInt(form.total_medium) || 8,
          total_large: parseInt(form.total_large) || 4,
        }, token || undefined);
      }
      setShowModal(false); setSaveError(''); fetchLockers();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save locker');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (locker: any, newStatus: string) => {
    try {
      await api.put(`/api/lockers/${locker.locker_id}`, { status: newStatus }, token || undefined);
      fetchLockers();
    } catch (err: any) { setFetchError(err.message || 'Failed to update status'); }
  };

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const resetFilters = () => {
    setSearch(''); setStatusFilter('all'); setDistrictFilter('all');
    setAvailFilter('all'); setSortKey('name'); setPage(1);
  };

  // ── List Header ───────────────────────────────────────────────────────────
  const ListHeader = (
    <View>
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{fetchError}</Text>
        </View>
      ) : null}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
        <TextInput
          testID="locker-search"
          style={styles.searchInput}
          placeholder="Search by name, address, district, ID…"
          placeholderTextColor={Colors.textTertiary}
          value={search}
          onChangeText={v => { setSearch(v); setPage(1); }}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Status filter chips + Sort button */}
      <View style={styles.filterSortRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterChipsContent}
        >
          {[
            { key: 'all',         label: 'All',         count: lockers.length },
            { key: 'active',      label: 'Active',      count: kpi.active },
            { key: 'maintenance', label: 'Maintenance', count: kpi.maintenance },
            { key: 'offline',     label: 'Offline',     count: kpi.offline },
          ].map(f => {
            const meta     = f.key !== 'all' ? STATUS_META[f.key] : null;
            const isActive = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={({ pressed }) => [
                  styles.filterChip,
                  isActive && (meta
                    ? { backgroundColor: meta.bg, borderColor: meta.color }
                    : styles.filterChipAll),
                  pressed && styles.pressed,
                ]}
                onPress={() => { setStatusFilter(f.key); setPage(1); }}
              >
                {meta && isActive && <View style={[styles.filterDot, { backgroundColor: meta.color }]} />}
                <Text style={[
                  styles.filterChipText,
                  isActive && (meta ? { color: meta.color, fontWeight: '700' } : styles.filterChipTextAll),
                ]}>
                  {f.label}
                </Text>
                <View style={[
                  styles.filterBadge,
                  { backgroundColor: isActive ? (meta?.color ?? Colors.textPrimary) : Colors.border },
                ]}>
                  <Text style={[styles.filterBadgeText, { color: isActive ? Colors.white : Colors.textTertiary }]}>
                    {f.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          testID="sort-btn"
          style={({ pressed }) => [styles.sortBtn, pressed && styles.pressed]}
          onPress={() => setShowSort(v => !v)}
        >
          <Ionicons name="swap-vertical-outline" size={14} color={Colors.textSecondary} />
          <Ionicons name={showSort ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textTertiary} />
        </Pressable>
      </View>

      {/* Sort dropdown */}
      {showSort && (
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map(opt => (
            <Pressable
              key={opt.key}
              style={({ pressed }) => [
                styles.sortOption,
                sortKey === opt.key && styles.sortOptionActive,
                pressed && styles.pressed,
              ]}
              onPress={() => { setSortKey(opt.key); setShowSort(false); }}
            >
              <Ionicons name={opt.icon as any} size={14} color={sortKey === opt.key ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.sortOptionText, sortKey === opt.key && styles.sortOptionTextActive]}>
                {opt.label}
              </Text>
              {sortKey === opt.key && <Ionicons name="checkmark" size={13} color={Colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* District + Availability secondary filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipsContent}
        style={{ marginBottom: 8 }}
      >
        <Pressable
          style={({ pressed }) => [styles.chipSm, districtFilter === 'all' && styles.chipSmActive, pressed && styles.pressed]}
          onPress={() => { setDistrictFilter('all'); setPage(1); }}
        >
          <Ionicons name="map-outline" size={11} color={districtFilter === 'all' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.chipSmText, districtFilter === 'all' && { color: Colors.white }]}>All Districts</Text>
        </Pressable>
        {allDistricts.map(d => (
          <Pressable
            key={d}
            style={({ pressed }) => [styles.chipSm, districtFilter === d && styles.chipSmActive, pressed && styles.pressed]}
            onPress={() => { setDistrictFilter(d); setPage(1); }}
          >
            <Text style={[styles.chipSmText, districtFilter === d && { color: Colors.white }]}>{d}</Text>
          </Pressable>
        ))}
        <View style={styles.chipDivider} />
        {[
          { key: 'all',       label: 'Any Space',  icon: 'layers-outline' },
          { key: 'available', label: 'Has Space',   icon: 'checkmark-outline' },
          { key: 'full',      label: 'Full',        icon: 'close-outline' },
        ].map(f => (
          <Pressable
            key={f.key}
            style={({ pressed }) => [styles.chipSm, availFilter === f.key && styles.chipSmActive, pressed && styles.pressed]}
            onPress={() => { setAvailFilter(f.key); setPage(1); }}
          >
            <Ionicons name={f.icon as any} size={11} color={availFilter === f.key ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.chipSmText, availFilter === f.key && { color: Colors.white }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Results summary */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {filtered.length} locker{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== lockers.length ? ` of ${lockers.length}` : ''}
        </Text>
        {hasActiveFilters && (
          <Pressable style={styles.clearBtn} onPress={resetFilters}>
            <Ionicons name="close-circle" size={12} color={Colors.primary} />
            <Text style={styles.clearBtnText}>Clear filters</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Sticky KPI Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>ADMIN · LOCKERS</Text>
            <Text style={styles.heroTitle}>Lockers</Text>
          </View>
          <Pressable
            testID="add-locker-btn"
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            onPress={openCreate}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.addBtnText}>Add New</Text>
          </Pressable>
        </View>

        {/* KPI bar */}
        <View style={styles.kpiBar}>
          {[
            { label: 'Total',       value: kpi.total,       valueColor: Colors.white },
            { label: 'Active',      value: kpi.active,      valueColor: '#86EFAC' },
            { label: 'Maintenance', value: kpi.maintenance, valueColor: '#FDE68A' },
            { label: 'Offline',     value: kpi.offline,     valueColor: '#FCA5A5' },
          ].map((k, i) => (
            <View key={k.label} style={[styles.kpiItem, i > 0 && styles.kpiItemBorder]}>
              <Text style={[styles.kpiValue, { color: k.valueColor }]}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={paginated}
          keyExtractor={item => item.locker_id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={40} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No lockers found</Text>
              <Text style={styles.emptyDesc}>
                {hasActiveFilters
                  ? 'Try adjusting your filters or search query.'
                  : 'Add your first locker using the + Add New button.'}
              </Text>
              {hasActiveFilters && (
                <Pressable style={styles.emptyResetBtn} onPress={resetFilters}>
                  <Text style={styles.emptyResetText}>Clear filters</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <LockerCard
              item={item}
              expanded={expandedId === item.locker_id}
              onToggleExpand={() => toggleExpand(item.locker_id)}
              onEdit={() => openEdit(item)}
              onStatusChange={s => handleStatusChange(item, s)}
            />
          )}
          ListFooterComponent={
            hasMore ? (
              <Pressable
                style={({ pressed }) => [styles.loadMoreBtn, pressed && styles.pressed]}
                onPress={() => setPage(p => p + 1)}
              >
                <Text style={styles.loadMoreText}>
                  Load More ({filtered.length - paginated.length} remaining)
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.primary} />
              </Pressable>
            ) : null
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{editLocker ? 'Edit Locker' : 'New Locker'}</Text>
              <Pressable testID="save-locker-btn" onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.primary} size="small" />
                  : <Text style={styles.modalSave}>Save</Text>}
              </Pressable>
            </View>

            {saveError ? (
              <View style={styles.saveErrorBanner}>
                <Text style={styles.saveErrorText}>{saveError}</Text>
              </View>
            ) : null}

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <FormField label="Locker Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Kigali City Tower" testID="form-name" />
              <FormField label="Address *" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="e.g. KN 3 Ave, City Tower" testID="form-address" />

              <Text style={styles.fieldLabel}>District *</Text>
              <View style={styles.districtRow}>
                {KIGALI_DISTRICTS.map(d => (
                  <Pressable
                    key={d}
                    testID={`district-${d}`}
                    style={({ pressed }) => [
                      styles.districtChip,
                      form.district === d && styles.districtChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setForm(f => ({ ...f, district: d }))}
                  >
                    <Text style={[styles.districtChipText, form.district === d && { color: Colors.white }]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.textInput}
                value={form.district}
                onChangeText={v => setForm(f => ({ ...f, district: v }))}
                placeholder="Or type district name"
                placeholderTextColor={Colors.textTertiary}
              />

              {!editLocker && (
                <>
                  <View style={styles.coordRow}>
                    <View style={{ flex: 1 }}>
                      <FormField label="Latitude" value={form.lat} onChange={v => setForm(f => ({ ...f, lat: v }))} placeholder="-1.9442" keyboardType="decimal-pad" testID="form-lat" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormField label="Longitude" value={form.lng} onChange={v => setForm(f => ({ ...f, lng: v }))} placeholder="30.0619" keyboardType="decimal-pad" testID="form-lng" />
                    </View>
                  </View>
                  <Text style={styles.sectionLabel}>Compartments</Text>
                  <View style={styles.compartmentRow}>
                    <CompField label="Small"  value={form.total_small}  onChange={v => setForm(f => ({ ...f, total_small: v }))} />
                    <CompField label="Medium" value={form.total_medium} onChange={v => setForm(f => ({ ...f, total_medium: v }))} />
                    <CompField label="Large"  value={form.total_large}  onChange={v => setForm(f => ({ ...f, total_large: v }))} />
                  </View>
                </>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoText}>
                  {editLocker
                    ? 'You can update name and address. Use the status button on the card to change locker status.'
                    : 'New locker will be set to Active with full compartment availability.'}
                </Text>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── LockerCard ─────────────────────────────────────────────────────────────────
function LockerCard({ item, expanded, onToggleExpand, onEdit, onStatusChange }: {
  item: any;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onStatusChange: (s: string) => void;
}) {
  const meta       = STATUS_META[item.status] ?? STATUS_META.offline;
  const nextStatus = STATUS_OPTS[(STATUS_OPTS.indexOf(item.status) + 1) % STATUS_OPTS.length];
  const isMaint    = item.status === 'maintenance';

  const { avail, total, ratio } = getAvailability(item);

  const compartments = [
    { size: 'S', avail: item.available_small  ?? 0, total: item.total_small  ?? 0, color: Colors.primary },
    { size: 'M', avail: item.available_medium ?? 0, total: item.total_medium ?? 0, color: Colors.green },
    { size: 'L', avail: item.available_large  ?? 0, total: item.total_large  ?? 0, color: Colors.warning },
  ];

  const availColor = ratio > 0.5 ? Colors.green : ratio > 0 ? Colors.warning : Colors.error;
  const availBg    = ratio > 0.5 ? Colors.greenLight : ratio > 0 ? Colors.warningLight : Colors.errorLight;

  // Operational health derived from locker status
  const online = item.status !== 'offline';

  return (
    <View
      testID={`admin-locker-${item.locker_id}`}
      style={styles.card}
    >
      {/* Left status accent strip */}
      <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />

      <View style={styles.cardBody}>
        {/* ── Header ── */}
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name="cube-outline" size={22} color={meta.color} />
          </View>

          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardId}>ID: {item.locker_id}</Text>
          </View>

          <View style={styles.cardHeaderRight}>
            <Pressable
              testID={`locker-status-${item.locker_id}`}
              style={({ pressed }) => [
                styles.statusBadge,
                { backgroundColor: meta.bg, borderColor: meta.color },
                pressed && styles.pressed,
              ]}
              onPress={() => onStatusChange(nextStatus)}
            >
              <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </Pressable>

            <Pressable
              testID={`edit-locker-${item.locker_id}`}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              onPress={onEdit}
            >
              <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* ── Address + meta ── */}
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="map-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.metaText}>{item.district}</Text>
          {item.lat != null && (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</Text>
            </>
          )}
          <View style={styles.metaDot} />
          <Ionicons name="time-outline" size={11} color={Colors.textTertiary} />
          <Text style={styles.metaText}>{timeAgo(item.updated_at ?? item.created_at)}</Text>
        </View>

        {/* ── Compartments ── */}
        <View style={styles.compartmentsWrap}>
          {compartments.map(c => {
            const cRatio = c.total > 0 ? c.avail / c.total : 0;
            return (
              <View key={c.size} style={styles.compCol}>
                <View style={styles.compHeaderRow}>
                  <Text style={[styles.compSizeLabel, { color: c.color }]}>{c.size}</Text>
                  <Text style={styles.compCountText}>
                    <Text style={{ fontWeight: '800', color: c.color }}>{c.avail}</Text>
                    <Text style={{ color: Colors.textTertiary, fontSize: 10 }}>/{c.total}</Text>
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.round(cRatio * 100)}%` as any, backgroundColor: c.color }]} />
                </View>
                <Text style={styles.compAvailLabel}>avail</Text>
              </View>
            );
          })}

          {/* Overall badge */}
          <View style={[styles.availBadge, { backgroundColor: availBg }]}>
            <Text style={[styles.availBadgeNum, { color: availColor }]}>{avail}</Text>
            <Text style={[styles.availBadgeLabel, { color: availColor }]}>/ {total}</Text>
            <Text style={[styles.availBadgeSub, { color: availColor }]}>free</Text>
          </View>
        </View>

        {/* ── Operational health panel (expandable) ── */}
        {expanded && (
          <View style={styles.healthPanel}>
            <Text style={styles.healthPanelTitle}>Operational Health</Text>
            <View style={styles.healthGrid}>
              <HealthIndicator icon="wifi-outline"        label="Connectivity" ok={online}  value={online ? 'Online' : 'Offline'} />
              <HealthIndicator icon="flash-outline"       label="Power"        ok={online}  value={online ? 'Normal' : 'No Power'} />
              <HealthIndicator icon="thermometer-outline" label="Temperature"  ok={true}    value="22°C" />
              <View style={styles.healthItem}>
                <View style={[styles.healthIconWrap, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="construct-outline" size={14} color={Colors.primary} />
                </View>
                <Text style={styles.healthLabel}>Last Maint.</Text>
                <Text style={[styles.healthValue, { color: Colors.primary }]}>
                  {timeAgo(item.updated_at ?? item.created_at)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Action buttons ── */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionOutline, pressed && styles.pressed]}
            onPress={onToggleExpand}
          >
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'eye-outline'}
              size={13}
              color={Colors.primary}
            />
            <Text style={[styles.actionOutlineText, { color: Colors.primary }]}>
              {expanded ? 'Collapse' : 'Details'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionOutline, pressed && styles.pressed]}
            onPress={onEdit}
          >
            <Ionicons name="pencil-outline" size={13} color={Colors.textSecondary} />
            <Text style={[styles.actionOutlineText, { color: Colors.textSecondary }]}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionFilled,
              { backgroundColor: isMaint ? Colors.green : Colors.warning },
              pressed && styles.pressed,
            ]}
            onPress={() => onStatusChange(nextStatus)}
          >
            <Ionicons
              name={isMaint ? 'checkmark-circle-outline' : 'construct-outline'}
              size={13}
              color={Colors.white}
            />
            <Text style={styles.actionFilledText}>
              {isMaint ? 'Set Active' : 'Maintenance'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── HealthIndicator ────────────────────────────────────────────────────────────
function HealthIndicator({ icon, label, ok, value }: {
  icon: any; label: string; ok: boolean; value: string;
}) {
  const color = ok ? Colors.green : Colors.error;
  const bg    = ok ? Colors.greenLight : Colors.errorLight;
  return (
    <View style={styles.healthItem}>
      <View style={[styles.healthIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={[styles.healthValue, { color }]}>{value}</Text>
    </View>
  );
}

// ── Form helpers ───────────────────────────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, keyboardType, testID }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; testID?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType ?? 'default'}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

function CompField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={styles.compFieldWrap}>
      <Text style={styles.compFieldLabel}>{label}</Text>
      <TextInput
        style={styles.compFieldInput}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  pressed: { opacity: 0.68 },

  // ── Hero / KPI ─────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: Colors.white, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  addBtnPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  addBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  kpiBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16, overflow: 'hidden',
  },
  kpiItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  kpiItemBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: '700',
    marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorLight, borderRadius: 12, margin: 16, padding: 12,
  },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: '500', flex: 1 },

  // ── Search ────────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 11,
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },

  // ── Filters ───────────────────────────────────────────────────────────────
  filterSortRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  filterScroll: { flex: 1 },
  filterChipsContent: { paddingHorizontal: 16, paddingBottom: 4, gap: 7, flexDirection: 'row' },

  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  filterChipAll: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextAll: { color: Colors.white, fontWeight: '700' },
  filterBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '800' },

  chipSm: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  chipSmActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipSmText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  chipDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4, alignSelf: 'center', height: 20 },

  // ── Sort ──────────────────────────────────────────────────────────────────
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.white, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    marginRight: 16, borderWidth: 1.5, borderColor: Colors.border,
    ...Shadows.sm,
  },
  sortDropdown: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden',
    ...Shadows.card,
  },
  sortOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sortOptionActive: { backgroundColor: Colors.primaryLight },
  sortOptionText: { flex: 1, fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  sortOptionTextActive: { color: Colors.primary, fontWeight: '700' },

  // ── Results ───────────────────────────────────────────────────────────────
  resultsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  resultsCount: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  // ── List ──────────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // ── Locker Card ───────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    ...Shadows.card,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitleBlock: { flex: 1, justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardId: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500', marginTop: 2 },

  cardHeaderRight: { alignItems: 'flex-end', gap: 6 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  iconBtn: {
    width: 30, height: 30, backgroundColor: Colors.primaryLight,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },

  // Address + meta
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  addressText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 12 },
  metaText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border },

  // Compartments
  compartmentsWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: 12,
    padding: 10, marginBottom: 10,
  },
  compCol: { flex: 1 },
  compHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  compSizeLabel: { fontSize: 11, fontWeight: '800' },
  compCountText: { fontSize: 12 },
  progressBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: 3 },
  progressFill: { height: 4, borderRadius: 2 },
  compAvailLabel: { fontSize: 9, color: Colors.textTertiary, fontWeight: '600' },

  availBadge: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 6, marginLeft: 4,
  },
  availBadgeNum: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  availBadgeLabel: { fontSize: 10, fontWeight: '600' },
  availBadgeSub: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Health panel
  healthPanel: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  healthPanelTitle: {
    fontSize: 10, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  healthGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  healthItem: { alignItems: 'center', flex: 1 },
  healthIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
  healthLabel: { fontSize: 9, color: Colors.textTertiary, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  healthValue: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  // Action row
  actionRow: {
    flexDirection: 'row', gap: 6,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  actionOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  actionOutlineText: { fontSize: 11, fontWeight: '700' },
  actionFilled: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 10,
  },
  actionFilledText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  // Load more
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, marginTop: 4,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 16,
  },
  loadMoreText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyResetBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primaryLight, borderRadius: 12 },
  emptyResetText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  modalCancel: { fontSize: 16, color: Colors.textSecondary },
  modalSave: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  modalContent: { padding: 20 },
  saveErrorBanner: {
    marginHorizontal: 20, marginTop: 10,
    backgroundColor: Colors.errorLight, borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: Colors.error + '40',
  },
  saveErrorText: { color: Colors.error, fontSize: 13 },

  // Form
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  textInput: {
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, height: 52, fontSize: 15, color: Colors.textPrimary,
  },
  districtRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  districtChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
  },
  districtChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  districtChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  coordRow: { flexDirection: 'row', gap: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12, marginTop: 8 },
  compartmentRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  compFieldWrap: { flex: 1, alignItems: 'center' },
  compFieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  compFieldInput: {
    backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    height: 52, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.textPrimary, width: '100%',
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14, marginTop: 4,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.primaryDark, fontWeight: '500', lineHeight: 20 },
});
