import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';
import { useRouter } from 'expo-router';

export default function Profile() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(t('logout'), 'Are you sure you want to logout?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('profile')}</Text>
          {user?.role === 'admin' && (
            <TouchableOpacity
              testID="admin-panel-btn"
              style={styles.adminBtn}
              onPress={() => router.push('/admin/')}
            >
              <Ionicons name="settings" size={16} color={Colors.white} />
              <Text style={styles.adminBtnText}>{t('admin_panel')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userRole}>
            {user?.role === 'admin' ? '👑 Admin' : user?.role === 'courier' ? '🚚 Courier' : '📦 User'}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <InfoRow icon="call-outline" label={t('phone')} value={user?.phone || '—'} />
          <InfoRow icon="mail-outline" label={t('email')} value={user?.email || '—'} />
          <InfoRow icon="shield-checkmark-outline" label={t('role')} value={user?.role || 'user'} />
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>{t('settings')}</Text>
        <View style={styles.settingsCard}>
          {/* Language Toggle */}
          <View style={styles.settingRow}>
            <Ionicons name="language-outline" size={22} color={Colors.primary} />
            <Text style={styles.settingLabel}>{t('language')}</Text>
            <View style={styles.langToggle}>
              <TouchableOpacity
                testID="lang-en"
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="lang-rw"
                style={[styles.langBtn, language === 'rw' && styles.langBtnActive]}
                onPress={() => setLanguage('rw')}
              >
                <Text style={[styles.langBtnText, language === 'rw' && styles.langBtnTextActive]}>RW</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* History */}
          <TouchableOpacity
            testID="view-history"
            style={styles.settingRow}
            onPress={() => router.push('/(user)/history')}
          >
            <Ionicons name="list-outline" size={22} color={Colors.primary} />
            <Text style={styles.settingLabel}>{t('history')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Map */}
          <TouchableOpacity
            testID="find-lockers"
            style={styles.settingRow}
            onPress={() => router.push('/(user)/map')}
          >
            <Ionicons name="map-outline" size={22} color={Colors.primary} />
            <Text style={styles.settingLabel}>{t('find_lockers')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Courier Panel (if courier) */}
        {user?.role === 'courier' && (
          <TouchableOpacity
            testID="courier-panel-btn"
            style={styles.courierBtn}
            onPress={() => router.push('/(courier)/dashboard')}
          >
            <Ionicons name="bicycle" size={20} color={Colors.white} />
            <Text style={styles.courierBtnText}>{t('courier_dash')}</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Akabati v1.0 · Rwanda's Parcel Network</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 6,
  },
  adminBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: Colors.white },
  userName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 12 },
  userRole: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
  infoCard: {
    backgroundColor: Colors.white, marginHorizontal: 20, borderRadius: 16, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
  infoValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  settingsCard: {
    backgroundColor: Colors.white, marginHorizontal: 20, borderRadius: 16, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  settingLabel: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },
  langToggle: { flexDirection: 'row', gap: 4 },
  langBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  langBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  langBtnTextActive: { color: Colors.white },
  courierBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.green,
    marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16,
    marginTop: 16, gap: 12,
  },
  courierBtnText: { flex: 1, color: Colors.white, fontSize: 15, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 16, backgroundColor: '#FEE2E2',
    borderRadius: 14, paddingVertical: 16, gap: 10,
  },
  logoutText: { color: Colors.error, fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary, marginTop: 20 },
});
