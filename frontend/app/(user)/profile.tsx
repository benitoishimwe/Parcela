import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Modal, TextInput, ActivityIndicator, Pressable, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, Shadows } from '../../constants/Colors';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';

// ─── Config ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  admin:   { label: 'Admin',   icon: 'shield-checkmark', color: Colors.primaryDark,    bg: Colors.primaryLight },
  courier: { label: 'Courier', icon: 'bicycle',          color: Colors.green,           bg: Colors.greenLight },
  user:    { label: 'User',    icon: 'person',            color: Colors.textSecondary,   bg: Colors.surfaceElevated },
};

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('good_morning');
  if (h < 18) return t('good_afternoon');
  return t('good_evening');
}

function computeCompletion(user: any): { pct: number; hint: string | null } {
  let filled = 0;
  if (user?.name)  filled++;
  if (user?.phone) filled++;
  if (user?.email) filled++;
  const pct = Math.round((filled / 3) * 100);
  const hint = pct < 100 ? 'Add your email address to complete your profile' : null;
  return { pct, hint };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, logout, token, updateUser } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  // Preferences
  const [darkMode, setDarkMode] = useState(false);

  // Edit Profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName]   = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState('');

  // Change Password modal
  const [showChangePw, setShowChangePw]         = useState(false);
  const [currentPw, setCurrentPw]               = useState('');
  const [newPw, setNewPw]                       = useState('');
  const [confirmPw, setConfirmPw]               = useState('');
  const [showCurrentPw, setShowCurrentPw]       = useState(false);
  const [showNewPw, setShowNewPw]               = useState(false);
  const [pwLoading, setPwLoading]               = useState(false);
  const [pwError, setPwError]                   = useState('');
  const [pwSuccess, setPwSuccess]               = useState(false);

  // Feedback modal
  const [showFeedback, setShowFeedback]         = useState(false);
  const [rating, setRating]                     = useState(0);
  const [feedbackText, setFeedbackText]         = useState('');
  const [feedbackLoading, setFeedbackLoading]   = useState(false);
  const [feedbackError, setFeedbackError]       = useState('');
  const [feedbackSent, setFeedbackSent]         = useState(false);

  // ── Boot ──
  useEffect(() => {
    if (!user) { router.replace('/(auth)/login'); return; }
    AsyncStorage.getItem('parcela_dark_mode').then(v => { if (v === 'true') setDarkMode(true); });
  }, [user]);

  const toggleDarkMode = async (val: boolean) => {
    setDarkMode(val);
    await AsyncStorage.setItem('parcela_dark_mode', val ? 'true' : 'false');
  };

  // ── Edit Profile ──
  const openEditProfile = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setEditError('');
    setShowEditProfile(true);
  };

  const handleEditProfile = async () => {
    if (!editName.trim()) { setEditError('Name is required'); return; }
    setEditLoading(true); setEditError('');
    try {
      const updated = await api.put(
        '/api/auth/profile',
        { name: editName.trim(), email: editEmail.trim() || undefined },
        token || undefined,
      );
      updateUser({ ...user!, name: updated?.name ?? editName.trim(), email: updated?.email ?? (editEmail.trim() || undefined) });
      setShowEditProfile(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Change Password ──
  const openChangePw = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setPwError(''); setPwSuccess(false);
    setShowChangePw(true);
  };

  const handleChangePw = async () => {
    if (!currentPw || !newPw) { setPwError('All fields are required'); return; }
    if (newPw !== confirmPw)  { setPwError('Passwords do not match'); return; }
    if (newPw.length < 6)     { setPwError('Password must be at least 6 characters'); return; }
    setPwLoading(true); setPwError('');
    try {
      await api.post('/api/auth/change-password', { current_password: currentPw, new_password: newPw }, token || undefined);
      setPwSuccess(true);
      setTimeout(() => setShowChangePw(false), 1500);
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  // ── Feedback ──
  const openFeedback = () => {
    setRating(0); setFeedbackText(''); setFeedbackSent(false); setFeedbackError('');
    setShowFeedback(true);
  };

  const handleFeedback = async () => {
    if (rating === 0) { setFeedbackError('Please select a rating'); return; }
    setFeedbackLoading(true); setFeedbackError('');
    try {
      await api.post('/api/feedback', { rating, message: feedbackText.trim() || undefined }, token || undefined);
      setFeedbackSent(true);
      setTimeout(() => setShowFeedback(false), 1500);
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to send feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  // ── Derived ──
  const initials   = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const role       = user?.role || 'user';
  const rc         = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const firstName  = user?.name?.split(' ')[0] || '';
  const greeting   = getGreeting(t);
  const { pct: completionPct, hint: completionHint } = computeCompletion(user);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ══════════════════════ HERO HEADER ══════════════════════ */}
        <View style={styles.hero}>

          {/* Top bar */}
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>{t('profile')}</Text>
            {user?.role === 'admin' && (
              <Pressable
                testID="admin-panel-btn"
                style={({ pressed }) => [styles.adminBtn, pressed && { opacity: 0.78 }]}
                onPress={() => router.push('/admin' as any)}
              >
                <Ionicons name="settings" size={14} color={Colors.white} />
                <Text style={styles.adminBtnText}>{t('admin_panel')}</Text>
              </Pressable>
            )}
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.avatarEditBtn, pressed && { opacity: 0.75 }]}
                onPress={openEditProfile}
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="camera" size={13} color={Colors.white} />
              </Pressable>
            </View>

            <Text style={styles.greetingText}>{greeting}, {firstName}!</Text>
            <Text style={styles.userName}>{user?.name}</Text>

            <View style={[styles.rolePill, { backgroundColor: rc.bg }]}>
              <Ionicons name={rc.icon as any} size={12} color={rc.color} />
              <Text style={[styles.roleLabel, { color: rc.color }]}>{rc.label}</Text>
            </View>
          </View>

          {/* Profile completion */}
          <View style={styles.completionCard}>
            <View style={styles.completionRow}>
              <View style={styles.completionLeft}>
                <Ionicons name="person-circle-outline" size={15} color="rgba(255,255,255,0.9)" />
                <Text style={styles.completionLabel}>Profile completion</Text>
              </View>
              <Text style={styles.completionPct}>{completionPct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completionPct}%` as any }]} />
            </View>
            {completionHint && (
              <Text style={styles.completionHint}>{completionHint}</Text>
            )}
          </View>

          {/* Edit Profile button */}
          <Pressable
            style={({ pressed }) => [styles.editProfileBtn, pressed && { opacity: 0.86 }]}
            onPress={openEditProfile}
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.editProfileText}>{t('edit_profile')}</Text>
          </Pressable>
        </View>

        {/* ══════════════════════ ACCOUNT INFO ══════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          <View style={styles.card}>

            {/* Phone */}
            <View style={styles.infoRow}>
              <View style={[styles.iconWrap, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="call-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('phone')}</Text>
                <Text style={styles.infoValue}>{user?.phone || '—'}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.green} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Email */}
            <Pressable
              style={({ pressed }) => [styles.infoRow, pressed && styles.rowPressed]}
              onPress={openEditProfile}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="mail-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email (optional)</Text>
                {user?.email ? (
                  <Text style={styles.infoValue}>{user.email}</Text>
                ) : (
                  <View style={styles.emptyEmailRow}>
                    <Ionicons name="add-circle-outline" size={14} color={Colors.primary} />
                    <Text style={styles.emptyEmailText}>Tap to add email</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Role */}
            <View style={styles.infoRow}>
              <View style={[styles.iconWrap, { backgroundColor: rc.bg }]}>
                <Ionicons name={rc.icon as any} size={18} color={rc.color} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('role')}</Text>
                <Text style={styles.infoValue}>{rc.label}</Text>
              </View>
              <View style={[styles.chipBadge, { backgroundColor: rc.bg }]}>
                <Text style={[styles.chipBadgeText, { color: rc.color }]}>{rc.label}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Change Password */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={openChangePw}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.greenLight }]}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.green} />
              </View>
              <Text style={styles.settingLabel}>Change Password</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* 2FA */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => Alert.alert('Two-Factor Authentication', 'This feature is coming soon. Stay tuned!')}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="finger-print-outline" size={18} color="#9333EA" />
              </View>
              <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
              <View style={styles.soonBadge}>
                <Text style={styles.soonText}>Soon</Text>
              </View>
            </Pressable>

          </View>
        </View>

        {/* ══════════════════════ SETTINGS ══════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings')}</Text>
          <View style={styles.card}>

            {/* Language */}
            <View style={styles.settingRow}>
              <View style={[styles.iconWrap, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="language-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>{t('language')}</Text>
              <View style={styles.langToggle}>
                <Pressable
                  testID="lang-en"
                  style={({ pressed }) => [styles.langBtn, language === 'en' && styles.langBtnActive, pressed && { opacity: 0.8 }]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
                </Pressable>
                <Pressable
                  testID="lang-rw"
                  style={({ pressed }) => [styles.langBtn, language === 'rw' && styles.langBtnActive, pressed && { opacity: 0.8 }]}
                  onPress={() => setLanguage('rw')}
                >
                  <Text style={[styles.langBtnText, language === 'rw' && styles.langBtnTextActive]}>RW</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Dark Mode */}
            <View style={styles.settingRow}>
              <View style={[styles.iconWrap, { backgroundColor: '#1E293B' }]}>
                <Ionicons name="moon-outline" size={18} color="#94A3B8" />
              </View>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Switch
                value={darkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: Colors.border, true: Colors.primaryMid }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.border}
              />
            </View>

            <View style={styles.divider} />

            {/* History */}
            <Pressable
              testID="view-history"
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => router.push('/(user)/history')}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="list-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>{t('history')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Find Lockers */}
            <Pressable
              testID="find-lockers"
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => router.push('/(user)/map')}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.yellowLight }]}>
                <Ionicons name="map-outline" size={18} color={Colors.yellowDark} />
              </View>
              <Text style={styles.settingLabel}>{t('find_lockers')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Notifications */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => router.push('/(user)/notifications')}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.warningLight }]}>
                <Ionicons name="notifications-outline" size={18} color={Colors.warning} />
              </View>
              <Text style={styles.settingLabel}>{t('notifications')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Privacy */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => Alert.alert('Privacy Settings', 'Control how your data is used.\n\nThis feature is coming soon.')}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="eye-off-outline" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.settingLabel}>Privacy</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

          </View>
        </View>

        {/* ══════════════════════ SUPPORT ══════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>

            {/* Rate service */}
            <Pressable
              testID="rate-service-btn"
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={openFeedback}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="star-outline" size={18} color={Colors.yellowDark} />
              </View>
              <Text style={styles.settingLabel}>Rate our service</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Help & Support */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => Alert.alert('Help & Support', 'Contact us at support@parcela.rw\n\nWe respond within 24 hours.')}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.infoLight }]}>
                <Ionicons name="help-circle-outline" size={18} color={Colors.info} />
              </View>
              <Text style={styles.settingLabel}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Terms of Service */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => Alert.alert('Terms of Service', 'Full terms are available at parcela.rw/terms')}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.surfaceElevated }]}>
                <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.settingLabel}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Privacy Policy */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
              onPress={() => Alert.alert('Privacy Policy', 'Full policy is available at parcela.rw/privacy')}
            >
              <View style={[styles.iconWrap, { backgroundColor: Colors.surfaceElevated }]}>
                <Ionicons name="shield-outline" size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </Pressable>

          </View>
        </View>

        {/* ══════════════════════ COURIER PANEL ══════════════════════ */}
        {user?.role === 'courier' && (
          <View style={styles.section}>
            <Pressable
              testID="courier-panel-btn"
              style={({ pressed }) => [styles.courierBtn, pressed && { opacity: 0.88 }]}
              onPress={() => router.push('/(courier)/dashboard')}
            >
              <View style={styles.courierIconWrap}>
                <Ionicons name="bicycle" size={22} color={Colors.white} />
              </View>
              <View style={styles.courierContent}>
                <Text style={styles.courierBtnTitle}>{t('courier_dash')}</Text>
                <Text style={styles.courierBtnSub}>View your delivery tasks</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        )}

        {/* ══════════════════════ LOGOUT ══════════════════════ */}
        <View style={styles.section}>
          <Pressable
            testID="logout-btn"
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.84 }]}
            onPress={logout}
          >
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            </View>
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>Parcela v1.0 · Rwanda's Parcel Network</Text>
      </ScrollView>

      {/* ══════════════════════ EDIT PROFILE MODAL ══════════════════════ */}
      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('edit_profile')}</Text>
              <Pressable
                onPress={() => setShowEditProfile(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Avatar preview */}
            <View style={styles.sheetAvatarRow}>
              <View style={styles.sheetAvatar}>
                <Text style={styles.sheetAvatarText}>{initials}</Text>
              </View>
              <Text style={styles.sheetAvatarHint}>Profile photo coming soon</Text>
            </View>

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="your@email.com (optional)"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {editError ? <ErrorBanner message={editError} /> : null}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.86 }, editLoading && styles.btnDisabled]}
              onPress={handleEditProfile}
              disabled={editLoading}
            >
              {editLoading
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.primaryBtnText}>{t('save')}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════ CHANGE PASSWORD MODAL ══════════════════════ */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={() => setShowChangePw(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change Password</Text>
              <Pressable
                onPress={() => setShowChangePw(false)}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {pwSuccess ? (
              <SuccessState title="Password Changed!" subtitle="Your password has been updated securely." />
            ) : (
              <>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.pwRow}>
                  <TextInput
                    style={[styles.textInput, styles.pwInput]}
                    value={currentPw}
                    onChangeText={setCurrentPw}
                    placeholder="Enter current password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showCurrentPw}
                  />
                  <Pressable onPress={() => setShowCurrentPw(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>New Password</Text>
                <View style={styles.pwRow}>
                  <TextInput
                    style={[styles.textInput, styles.pwInput]}
                    value={newPw}
                    onChangeText={setNewPw}
                    placeholder="Enter new password"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry={!showNewPw}
                  />
                  <Pressable onPress={() => setShowNewPw(v => !v)} style={styles.eyeBtn}>
                    <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textTertiary} />
                  </Pressable>
                </View>

                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  placeholder="Confirm new password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                />

                {pwError ? <ErrorBanner message={pwError} /> : null}

                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.86 }, pwLoading && styles.btnDisabled]}
                  onPress={handleChangePw}
                  disabled={pwLoading}
                >
                  {pwLoading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.primaryBtnText}>Update Password</Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════ FEEDBACK MODAL ══════════════════════ */}
      <Modal visible={showFeedback} transparent animationType="fade" onRequestClose={() => setShowFeedback(false)}>
        <View style={styles.centeredOverlay}>
          <View style={styles.feedbackCard}>
            {feedbackSent ? (
              <SuccessState title="Thank you!" subtitle="Your feedback helps us improve Parcela." />
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Rate our service</Text>
                  <Pressable onPress={() => setShowFeedback(false)}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </Pressable>
                </View>

                <Text style={styles.feedbackSub}>How was your experience with Parcela?</Text>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Pressable
                      key={star}
                      testID={`star-${star}`}
                      onPress={() => setRating(star)}
                      style={({ pressed }) => [styles.starBtn, pressed && { transform: [{ scale: 1.2 }] }]}
                    >
                      <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={36}
                        color={star <= rating ? Colors.yellow : Colors.border}
                      />
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  testID="feedback-text"
                  style={styles.feedbackInput}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Tell us more… (optional)"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />

                {feedbackError ? <ErrorBanner message={feedbackError} /> : null}

                <Pressable
                  testID="feedback-submit"
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.86 }, feedbackLoading && styles.btnDisabled]}
                  onPress={handleFeedback}
                  disabled={feedbackLoading}
                >
                  {feedbackLoading
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={styles.primaryBtnText}>Send Feedback</Text>}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function SuccessState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.successState}>
      <View style={styles.successIconWrap}>
        <Ionicons name="checkmark-circle" size={44} color={Colors.green} />
      </View>
      <Text style={styles.successTitle}>{title}</Text>
      <Text style={styles.successSub}>{subtitle}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // ── Hero ──
  hero: {
    backgroundColor: Colors.primary,
    paddingBottom: 20,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: Colors.white },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  adminBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },

  avatarSection: { alignItems: 'center', paddingTop: 16 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 92, height: 92, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { fontSize: 34, fontWeight: '900', color: Colors.white },
  avatarEditBtn: {
    position: 'absolute', bottom: -4, right: -4,
    width: 28, height: 28, borderRadius: 10,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: Colors.white,
  },

  greetingText: { fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: '500', marginBottom: 4 },
  userName:     { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    marginBottom: 16,
  },
  roleLabel: { fontSize: 13, fontWeight: '700' },

  // Completion
  completionCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  completionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  completionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  completionPct:   { fontSize: 13, color: Colors.white, fontWeight: '900' },
  progressTrack:   { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: 6, backgroundColor: Colors.white, borderRadius: 3 },
  completionHint:  { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 7 },

  // Edit Profile button
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginHorizontal: 16,
    backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 12,
    ...Shadows.sm,
  },
  editProfileText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // ── Sections ──
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.9,
  },

  card: {
    backgroundColor: Colors.white, borderRadius: 18, overflow: 'hidden',
    ...Shadows.card,
  },
  divider:    { height: 1, backgroundColor: Colors.borderLight, marginLeft: 62 },
  rowPressed: { backgroundColor: 'rgba(0,0,0,0.04)' },

  // Info rows
  infoRow:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap:    { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 10, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue:   { fontSize: 15, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },

  emptyEmailRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  emptyEmailText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.greenLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  verifiedText: { fontSize: 11, color: Colors.green, fontWeight: '700' },

  chipBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipBadgeText: { fontSize: 11, fontWeight: '700' },

  soonBadge:  { backgroundColor: Colors.warningLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  soonText:   { fontSize: 11, color: Colors.warning, fontWeight: '700' },

  // Setting rows
  settingRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settingLabel: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },

  langToggle: { flexDirection: 'row', gap: 4 },
  langBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
  },
  langBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langBtnText:       { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  langBtnTextActive: { color: Colors.white },

  // Courier
  courierBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.green, borderRadius: 18, padding: 16,
    ...Shadows.green,
  },
  courierIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  courierContent:  { flex: 1 },
  courierBtnTitle: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  courierBtnSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: Colors.errorLight,
    ...Shadows.sm,
  },
  logoutIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center',
  },
  logoutText:  { color: Colors.error, fontSize: 15, fontWeight: '700' },
  versionText: { textAlign: 'center', fontSize: 12, color: Colors.textTertiary, marginTop: 24 },

  // ── Bottom-sheet modals ──
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 16,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },

  sheetAvatarRow:  { alignItems: 'center', marginBottom: 20 },
  sheetAvatar:     { width: 68, height: 68, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  sheetAvatarText: { fontSize: 24, fontWeight: '900', color: Colors.primary },
  sheetAvatarHint: { fontSize: 12, color: Colors.textTertiary },

  inputLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary, marginBottom: 12,
  },

  pwRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 0 },
  pwInput: { flex: 1, marginBottom: 0 },
  eyeBtn:  { padding: 10 },

  primaryBtn: {
    backgroundColor: Colors.primary, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    ...Shadows.primary,
  },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  btnDisabled:    { opacity: 0.58 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.errorLight, borderRadius: 10, padding: 10, marginBottom: 12,
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 12, fontWeight: '500' },

  successState:   { alignItems: 'center', paddingVertical: 28, gap: 10 },
  successIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: Colors.greenLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  successSub:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // ── Centered modal (feedback) ──
  centeredOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  feedbackCard: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 24, width: '100%',
    ...Shadows.large,
  },
  feedbackSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  starsRow:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  starBtn:     { padding: 4 },
  feedbackInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: 14, color: Colors.textPrimary,
    textAlignVertical: 'top', minHeight: 80, marginBottom: 12,
  },
});
