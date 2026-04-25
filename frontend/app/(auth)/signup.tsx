import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';

export default function Signup() {
  const { signup } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSignup = async () => {
    setError('');
    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError('Name, phone and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), phone.trim(), email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => [
    styles.inputWrap,
    focusedField === field && styles.inputFocused,
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Back */}
          <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Image source={require('../../assets/images/icon.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.logoText}>Parcela</Text>
            <Text style={styles.logoSub}>Rwanda's Parcel Network</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('create_account')}</Text>
            <Text style={styles.formSub}>Join thousands of users across Rwanda</Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Name */}
            <View style={inputStyle('name')}>
              <Ionicons name="person-outline" size={20} color={focusedField === 'name' ? Colors.primary : Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-name"
                style={styles.input}
                placeholder={t('full_name')}
                value={name}
                onChangeText={t => { setName(t); setError(''); }}
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Phone */}
            <View style={inputStyle('phone')}>
              <Ionicons name="call-outline" size={20} color={focusedField === 'phone' ? Colors.primary : Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-phone"
                style={styles.input}
                placeholder="+250 7XX XXX XXX"
                value={phone}
                onChangeText={t => { setPhone(t); setError(''); }}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Email (optional) */}
            <View style={inputStyle('email')}>
              <Ionicons name="mail-outline" size={20} color={focusedField === 'email' ? Colors.primary : Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-email"
                style={styles.input}
                placeholder={`${t('email')} (optional)`}
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password */}
            <View style={inputStyle('password')}>
              <Ionicons name="lock-closed-outline" size={20} color={focusedField === 'password' ? Colors.primary : Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-password"
                style={styles.inputFlex}
                placeholder={t('password')}
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
                secureTextEntry={!showPwd}
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          password.length >= i * 3
                            ? (password.length >= 10 ? Colors.green : Colors.warning)
                            : Colors.border,
                      },
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {password.length < 6 ? 'Too short' : password.length < 10 ? 'Fair' : 'Strong'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              testID="signup-submit"
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Text style={styles.btnText}>{t('signup')}</Text>
                  <Ionicons name="arrow-forward" size={18} color={Colors.white} />
                </>
              )}
            </TouchableOpacity>

            {/* Terms note */}
            <Text style={styles.terms}>
              By signing up you agree to our Terms of Service and Privacy Policy
            </Text>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>{t('have_account')} </Text>
              <TouchableOpacity testID="login-link" onPress={() => router.back()}>
                <Text style={styles.link}>{t('sign_in')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    marginBottom: 16,
  },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  logoIcon: {
    width: 86, height: 86, backgroundColor: Colors.white,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
    borderWidth: 1.5, borderColor: Colors.primaryLight,
  },
  logoImage: { width: 62, height: 62 },
  logoText: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },
  form: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  formSub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    marginBottom: 14, paddingHorizontal: 14, height: 56,
  },
  inputFocused: {
    borderColor: Colors.primary, backgroundColor: '#F0F9FF',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  inputFlex: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  eyeBtn: { padding: 4 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14, marginTop: -6 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, marginLeft: 4 },
  btn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  btnText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  terms: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textTertiary, paddingHorizontal: 12, fontSize: 13 },
  linkRow: { flexDirection: 'row', justifyContent: 'center' },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
