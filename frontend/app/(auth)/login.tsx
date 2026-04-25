import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, ActivityIndicator, Platform,
  Image, Animated, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, Shadows } from '../../constants/Colors';

// Safe clipboard: web uses navigator.clipboard, native degrades gracefully
const copyToClipboard = (text: string) => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
};

// ─── Fluent Ripple Pressable ──────────────────────────────────────────────────
function RipplePress({
  children, onPress, style, disabled, testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.timing(opacity, { toValue: 0.85, duration: 80, useNativeDriver: true }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Fluent Text Field ────────────────────────────────────────────────────────
function FluentField({
  label, icon, rightSlot, value, onChangeText, placeholder, secureTextEntry,
  keyboardType, autoCapitalize, testID, onFocus, onBlur, focused, hasError, success,
}: {
  label: string; icon: string; rightSlot?: React.ReactNode;
  value: string; onChangeText: (v: string) => void; placeholder?: string;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any;
  testID?: string; onFocus?: () => void; onBlur?: () => void;
  focused: boolean; hasError?: boolean; success?: boolean;
}) {
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = hasError
    ? Colors.error
    : success
    ? Colors.green
    : borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [Colors.border, Colors.primary],
      });

  const bgColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.background, '#F0F9FF'],
  });

  const iconColor = hasError ? Colors.error : focused ? Colors.primary : Colors.textSecondary;

  return (
    <View style={fStyles.wrap}>
      <Text style={[fStyles.label, focused && fStyles.labelFocused, hasError && fStyles.labelError]}>
        {label}
      </Text>
      <Animated.View
        style={[
          fStyles.field,
          { borderColor, backgroundColor: bgColor },
          hasError && fStyles.fieldError,
          success && fStyles.fieldSuccess,
        ]}
      >
        <Ionicons name={icon as any} size={20} color={iconColor} style={fStyles.icon} />
        <TextInput
          testID={testID}
          style={fStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {rightSlot}
      </Animated.View>
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, letterSpacing: 0.3 },
  labelFocused: { color: Colors.primary },
  labelError: { color: Colors.error },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5,
    height: 54, paddingHorizontal: 14,
  },
  fieldError: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  fieldSuccess: { borderColor: Colors.green, backgroundColor: '#F0FDF4' },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary, height: '100%' },
});

// ─── Demo Account Row ─────────────────────────────────────────────────────────
function DemoRow({ role, credential, icon, color }: {
  role: string; credential: string; icon: string; color: string;
}) {
  const [copied, setCopied] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleCopy = () => {
    copyToClipboard(credential);
    setCopied(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={dStyles.row}>
      <View style={[dStyles.badge, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <View style={dStyles.info}>
        <Text style={[dStyles.role, { color }]}>{role}</Text>
        <Text style={dStyles.cred}>{credential}</Text>
      </View>
      <TouchableOpacity onPress={handleCopy} style={dStyles.copyBtn} activeOpacity={0.7}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={16}
            color={copied ? Colors.green : Colors.textTertiary}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const dStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  role: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  cred: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  copyBtn: { padding: 6 },
});

// ─── Format phone helper ──────────────────────────────────────────────────────
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

function isLikelyPhone(v: string) {
  return /^[\d\s]+$/.test(v.trim());
}

// ─── Main Login Screen ────────────────────────────────────────────────────────
export default function Login() {
  const { login, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const demoHeight = useRef(new Animated.Value(0)).current;
  const demoOpacity = useRef(new Animated.Value(0)).current;
  const demoRotate = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') router.replace('/admin' as any);
      else if (user.role === 'courier') router.replace('/(courier)/dashboard');
      else router.replace('/(user)/home');
    }
  }, [user]);

  const toggleDemo = () => {
    const expanding = !demoExpanded;
    setDemoExpanded(expanding);
    Animated.parallel([
      Animated.spring(demoHeight, {
        toValue: expanding ? 1 : 0,
        useNativeDriver: false,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(demoOpacity, {
        toValue: expanding ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(demoRotate, {
        toValue: expanding ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleIdentifierChange = (v: string) => {
    const formatted = isLikelyPhone(v) ? formatPhone(v) : v;
    setIdentifier(formatted);
    setError('');
    setIdentifierError('');
  };

  const handleLogin = async () => {
    setError('');
    setIdentifierError('');
    setPasswordError('');

    let valid = true;
    if (!identifier.trim()) {
      setIdentifierError('Phone number or email is required');
      valid = false;
    }
    if (!password.trim()) {
      setPasswordError('Password is required');
      valid = false;
    }
    if (!valid) { shakeError(); return; }

    setLoading(true);
    try {
      await login(identifier.replace(/\s/g, ''), password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const redirectUrl = window.location.origin;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  };

  const chevronRotation = demoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const demoMaxHeight = demoHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Background decoration ── */}
          <View style={styles.bgCircle1} pointerEvents="none" />
          <View style={styles.bgCircle2} pointerEvents="none" />

          {/* ── Language Toggle ── */}
          <RipplePress
            testID="lang-toggle"
            style={styles.langBtn}
            onPress={() => setLanguage(language === 'en' ? 'rw' : 'en')}
          >
            <Ionicons name="language-outline" size={14} color={Colors.primaryDark} />
            <Text style={styles.langText}>{language === 'en' ? '🇷🇼 Kinyarwanda' : '🇬🇧 English'}</Text>
          </RipplePress>

          {/* ── Logo & Branding ── */}
          <Animated.View style={[styles.logoWrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <View style={styles.logoShell}>
              <View style={styles.logoGlow} />
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.logoText}>Parcela</Text>
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </Animated.View>

          {/* ── Card ── */}
          <Animated.View style={[styles.card, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

            {/* Card header */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{t('login')}</Text>
                <Text style={styles.cardSub}>Welcome back to Rwanda's smartest parcel network</Text>
              </View>
              <View style={styles.securityBadge}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.green} />
              </View>
            </View>

            {/* Security note */}
            <View style={styles.securityNote}>
              <Ionicons name="lock-closed" size={12} color={Colors.textTertiary} />
              <Text style={styles.securityText}>Secured with end-to-end encryption</Text>
            </View>

            <View style={styles.dividerThin} />

            {/* Error banner */}
            {error ? (
              <Animated.View style={[styles.errorBanner, { transform: [{ translateX: errorShake }] }]}>
                <View style={styles.errorIconWrap}>
                  <Ionicons name="alert-circle" size={18} color={Colors.error} />
                </View>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {/* Identifier field */}
            <FluentField
              label={`${t('phone_number')} / ${t('email')}`}
              icon="call-outline"
              value={identifier}
              onChangeText={handleIdentifierChange}
              placeholder="07XX XXX XXX or email"
              keyboardType="default"
              testID="login-identifier"
              focused={focusedField === 'identifier'}
              hasError={!!identifierError}
              onFocus={() => setFocusedField('identifier')}
              onBlur={() => setFocusedField(null)}
            />
            {identifierError ? (
              <View style={styles.fieldError}>
                <Ionicons name="alert-circle-outline" size={13} color={Colors.error} />
                <Text style={styles.fieldErrorText}>{identifierError}</Text>
              </View>
            ) : null}

            {/* Password field */}
            <FluentField
              label={t('password')}
              icon="lock-closed-outline"
              value={password}
              onChangeText={v => { setPassword(v); setError(''); setPasswordError(''); }}
              placeholder="••••••••"
              secureTextEntry={!showPwd}
              testID="login-password"
              focused={focusedField === 'password'}
              hasError={!!passwordError}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              rightSlot={
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn} activeOpacity={0.7}>
                  <Ionicons
                    name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={focusedField === 'password' ? Colors.primary : Colors.textTertiary}
                  />
                </TouchableOpacity>
              }
            />
            {passwordError ? (
              <View style={styles.fieldError}>
                <Ionicons name="alert-circle-outline" size={13} color={Colors.error} />
                <Text style={styles.fieldErrorText}>{passwordError}</Text>
              </View>
            ) : null}

            {/* Forgot password */}
            <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login button */}
            <RipplePress
              testID="login-submit"
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.white} size="small" />
                  <Text style={styles.loginBtnText}>Signing in…</Text>
                </View>
              ) : (
                <View style={styles.loginBtnInner}>
                  <Text style={styles.loginBtnText}>{t('login')}</Text>
                  <View style={styles.loginBtnArrow}>
                    <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
                  </View>
                </View>
              )}
            </RipplePress>

            {/* Divider */}
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>{t('or')}</Text>
              <View style={styles.orLine} />
            </View>

            {/* Google Sign-in */}
            <RipplePress testID="google-login-btn" style={styles.googleBtn} onPress={handleGoogleLogin}>
              <View style={styles.googleIconWrap}>
                {/* Official Google G */}
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={styles.googleText}>{t('google_signin')}</Text>
            </RipplePress>

            {/* Signup link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>{t('no_account')} </Text>
              <TouchableOpacity testID="signup-link" onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
                <Text style={styles.signupLink}>{t('create_account')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerThin} />

            {/* Demo Accounts – collapsible */}
            <View style={styles.demoCard}>
              <TouchableOpacity style={styles.demoCardHeader} onPress={toggleDemo} activeOpacity={0.8}>
                <View style={styles.demoHeaderLeft}>
                  <View style={styles.demoBadgeIcon}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.yellowDark} />
                  </View>
                  <Text style={styles.demoCardTitle}>Demo Accounts</Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                  <Ionicons name="chevron-down" size={18} color={Colors.yellowDark} />
                </Animated.View>
              </TouchableOpacity>

              <Animated.View style={{ maxHeight: demoMaxHeight, overflow: 'hidden', opacity: demoOpacity }}>
                <View style={styles.demoSeparator} />
                <DemoRow
                  role="User"
                  credential="0789999999 / User@1234"
                  icon="person-outline"
                  color={Colors.primary}
                />
                <View style={styles.demoRowSep} />
                <DemoRow
                  role="Courier"
                  credential="courier@parcela.rw / Courier@1234"
                  icon="bicycle-outline"
                  color={Colors.green}
                />
                <View style={styles.demoRowSep} />
                <DemoRow
                  role="Admin"
                  credential="benishimwe31@gmail.com / Admin@1234"
                  icon="shield-outline"
                  color={Colors.yellowDark}
                />
              </Animated.View>
            </View>

          </Animated.View>

          {/* bottom padding */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF6FD' },
  flex: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  // Background decoration
  bgCircle1: {
    position: 'absolute', top: -80, right: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: Colors.primaryLight, opacity: 0.6,
  },
  bgCircle2: {
    position: 'absolute', top: 60, left: -100,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#E0F2FE', opacity: 0.4,
  },

  // Language toggle
  langBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end',
    backgroundColor: Colors.white,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, zIndex: 10,
    ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  langText: { color: Colors.primaryDark, fontWeight: '600', fontSize: 12 },

  // Logo
  logoWrap: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  logoShell: {
    width: 96, height: 96,
    backgroundColor: Colors.white,
    borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    ...Shadows.large,
    borderWidth: 1.5, borderColor: Colors.primaryLight,
    overflow: 'hidden',
  },
  logoGlow: {
    position: 'absolute', top: -20, left: -20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.primaryLight, opacity: 0.5,
  },
  logoImage: { width: 68, height: 68, zIndex: 1 },
  logoText: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24, padding: 24,
    ...Shadows.large,
    borderWidth: 1, borderColor: 'rgba(226,232,240,0.6)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, maxWidth: 240 },
  securityBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.greenLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.green + '30',
  },

  // Security note
  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 16, marginTop: 2,
  },
  securityText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '500' },

  dividerThin: { height: 1, backgroundColor: Colors.borderLight, marginBottom: 20 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.errorLight, borderRadius: 12, padding: 12,
    marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.error,
  },
  errorIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.error + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, fontWeight: '600' },

  // Field-level error
  fieldError: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: -10, marginBottom: 10, paddingLeft: 4,
  },
  fieldErrorText: { fontSize: 12, color: Colors.error, fontWeight: '500' },

  // Eye toggle
  eyeBtn: { padding: 4 },

  // Forgot
  forgotRow: { alignSelf: 'flex-end', marginBottom: 18, marginTop: -4 },
  forgotText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // Login button
  loginBtn: {
    backgroundColor: Colors.primary,
    height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.primary,
  },
  loginBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  loginBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loginBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  loginBtnArrow: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Or divider
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { color: Colors.textTertiary, paddingHorizontal: 14, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  // Google button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, gap: 12,
    ...Shadows.sm,
  },
  googleIconWrap: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  googleG: { fontSize: 18, fontWeight: '900', color: '#4285F4', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  googleText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  // Signup
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18, marginBottom: 20 },
  signupText: { color: Colors.textSecondary, fontSize: 14 },
  signupLink: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Demo card
  demoCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  demoCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  demoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoBadgeIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#FDE68A50',
    alignItems: 'center', justifyContent: 'center',
  },
  demoCardTitle: { fontWeight: '800', fontSize: 13, color: Colors.yellowDark },
  demoSeparator: { height: 1, backgroundColor: '#FDE68A', marginHorizontal: 14 },
  demoRowSep: { height: 1, backgroundColor: '#FEF9C3', marginHorizontal: 14 },
});
