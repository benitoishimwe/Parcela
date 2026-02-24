import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

const STATUS_OPTS = ['active', 'maintenance', 'offline'];
const STATUS_COLORS_MAP: Record<string, string> = {
  active: Colors.green,
  maintenance: Colors.warning,
  offline: Colors.error,
};
const STATUS_ICONS: Record<string, string> = {
  active: 'checkmark-circle',
  maintenance: 'construct',
  offline: 'close-circle',
};

const INITIAL_FORM = {
  name: '', address: '', district: '',
  lat: '', lng: '',
  total_small: '10', total_medium: '8', total_large: '4',
};

const KIGALI_DISTRICTS = ['Nyarugenge', 'Gasabo', 'Kicukiro'];

export default function AdminLockers() {
  const { token } = useAuth();
  const [lockers, setLockers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editLocker, setEditLocker] = useState<any>(null);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);

  const fetchLockers = async () => {
    try {
      const data = await api.get('/api/admin/lockers', token || undefined);
      setLockers(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchLockers(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchLockers(); };

  const openCreate = () => {
    setEditLocker(null);
    setForm({ ...INITIAL_FORM });
    setShowModal(true);
  };

  const openEdit = (locker: any) => {
    setEditLocker(locker);
    setForm({
      name: locker.name || '',
      address: locker.address || '',
      district: locker.district || '',
      lat: String(locker.lat || ''),
      lng: String(locker.lng || ''),
      total_small: String(locker.total_small || 10),
      total_medium: String(locker.total_medium || 8),
      total_large: String(locker.total_large || 4),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.district.trim()) {
      Alert.alert('Error', 'Name, address, and district are required');
      return;
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Please enter valid coordinates');
      return;
    }

    setSaving(true);
    try {
      if (editLocker) {
        // Update existing
        await api.put(`/api/admin/lockers/${editLocker.locker_id}`, {
          name: form.name.trim(),
          address: form.address.trim(),
          ...(editLocker.status ? {} : {}),
        }, token || undefined);
      } else {
        // Create new
        await api.post('/api/lockers', {
          name: form.name.trim(),
          address: form.address.trim(),
          district: form.district.trim(),
          lat, lng,
          total_small: parseInt(form.total_small) || 10,
          total_medium: parseInt(form.total_medium) || 8,
          total_large: parseInt(form.total_large) || 4,
        }, token || undefined);
      }
      setShowModal(false);
      fetchLockers();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save locker');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (locker: any) => {
    const opts = STATUS_OPTS.filter(s => s !== locker.status);
    Alert.alert(
      `${locker.name}`,
      `Status: ${locker.status}`,
      [
        ...opts.map(status => ({
          text: `Set ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          style: status === 'offline' ? 'destructive' : 'default' as any,
          onPress: async () => {
            try {
              await api.put(`/api/admin/lockers/${locker.locker_id}`, { status }, token || undefined);
              fetchLockers();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const totalActive = lockers.filter(l => l.status === 'active').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Lockers</Text>
          <Text style={styles.subtitle}>{totalActive} active · {lockers.length} total</Text>
        </View>
        <TouchableOpacity testID="add-locker-btn" style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color={Colors.white} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {['active', 'maintenance', 'offline'].map(s => (
          <View key={s} style={[styles.statChip, { backgroundColor: STATUS_COLORS_MAP[s] + '15' }]}>
            <Ionicons name={STATUS_ICONS[s] as any} size={14} color={STATUS_COLORS_MAP[s]} />
            <Text style={[styles.statChipText, { color: STATUS_COLORS_MAP[s] }]}>
              {lockers.filter(l => l.status === s).length} {s}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={lockers}
          keyExtractor={item => item.locker_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <View testID={`admin-locker-${item.locker_id}`} style={styles.lockerCard}>
              <View style={styles.lockerTop}>
                <View style={[styles.lockerIconWrap, { backgroundColor: STATUS_COLORS_MAP[item.status] + '15' }]}>
                  <Text style={{ fontSize: 22 }}>📦</Text>
                </View>
                <View style={styles.lockerInfo}>
                  <Text style={styles.lockerName}>{item.name}</Text>
                  <Text style={styles.lockerAddr}>{item.address}</Text>
                  <Text style={styles.lockerDistrict}>{item.district} · {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</Text>
                </View>
                <View style={styles.lockerActions}>
                  <TouchableOpacity
                    testID={`locker-status-${item.locker_id}`}
                    style={[styles.statusChip, { backgroundColor: STATUS_COLORS_MAP[item.status] + '20' }]}
                    onPress={() => handleStatusChange(item)}
                  >
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS_MAP[item.status] }]} />
                    <Text style={[styles.statusChipText, { color: STATUS_COLORS_MAP[item.status] }]}>
                      {item.status}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`edit-locker-${item.locker_id}`}
                    style={styles.editBtn}
                    onPress={() => openEdit(item)}
                  >
                    <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {item.status === 'active' && (
                <View style={styles.compartments}>
                  {[
                    { size: 'Small', avail: item.available_small, total: item.total_small, color: Colors.primary },
                    { size: 'Medium', avail: item.available_medium, total: item.total_medium, color: Colors.green },
                    { size: 'Large', avail: item.available_large, total: item.total_large, color: Colors.warning },
                  ].map(c => (
                    <View key={c.size} style={[styles.compItem, { borderTopColor: c.color }]}>
                      <Text style={[styles.compCount, { color: c.color }]}>{c.avail}</Text>
                      <Text style={styles.compTotal}>/{c.total}</Text>
                      <Text style={styles.compSize}>{c.size}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editLocker ? 'Edit Locker' : 'New Locker'}</Text>
              <TouchableOpacity
                testID="save-locker-btn"
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={Colors.primary} size="small" /> : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <FormField label="Locker Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Kigali City Tower" testID="form-name" />
              <FormField label="Address *" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="e.g. KN 3 Ave, City Tower" testID="form-address" />

              <Text style={styles.fieldLabel}>District *</Text>
              <View style={styles.districtRow}>
                {KIGALI_DISTRICTS.map(d => (
                  <TouchableOpacity
                    key={d}
                    testID={`district-${d}`}
                    style={[styles.districtChip, form.district === d && styles.districtChipActive]}
                    onPress={() => setForm(f => ({ ...f, district: d }))}
                  >
                    <Text style={[styles.districtChipText, form.district === d && { color: Colors.white }]}>{d}</Text>
                  </TouchableOpacity>
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
                    <CompField label="Small" value={form.total_small} onChange={v => setForm(f => ({ ...f, total_small: v }))} />
                    <CompField label="Medium" value={form.total_medium} onChange={v => setForm(f => ({ ...f, total_medium: v }))} />
                    <CompField label="Large" value={form.total_large} onChange={v => setForm(f => ({ ...f, total_large: v }))} />
                  </View>
                </>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoText}>
                  {editLocker
                    ? 'You can update name and address. Use status button on the list to change locker status.'
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

function FormField({ label, value, onChange, placeholder, keyboardType, testID }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType || 'default'}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

function CompField({ label, value, onChange }: any) {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, gap: 6,
  },
  addBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statChipText: { fontSize: 12, fontWeight: '700' },
  lockerCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  lockerTop: { flexDirection: 'row', alignItems: 'flex-start' },
  lockerIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  lockerInfo: { flex: 1 },
  lockerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  lockerAddr: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  lockerDistrict: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  lockerActions: { alignItems: 'flex-end', gap: 6 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 20, gap: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  editBtn: {
    width: 32, height: 32, backgroundColor: Colors.primaryLight,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  compartments: {
    flexDirection: 'row', gap: 10, marginTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12,
  },
  compItem: {
    flex: 1, alignItems: 'center', backgroundColor: Colors.background,
    borderRadius: 10, padding: 10, borderTopWidth: 3,
  },
  compCount: { fontSize: 20, fontWeight: '900' },
  compTotal: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
  compSize: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  modalCancel: { fontSize: 16, color: Colors.textSecondary },
  modalSave: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  modalContent: { padding: 20 },

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
