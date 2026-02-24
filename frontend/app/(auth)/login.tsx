import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';

export default function Login() {
  const { login, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert(t('error'), 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      // Navigation will be handled by the login function returning user role
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const redirectUrl = window.location.origin;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      Alert.alert('Google Sign In', 'Please use the web version for Google login');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Language Toggle */}
          <TouchableOpacity
            testID="lang-toggle"
            style={styles.langBtn}
            onPress={() => setLanguage(language === 'en' ? 'rw' : 'en')}
          >
            <Text style={styles.langText}>{language === 'en' ? '🇷🇼 Kinyarwanda' : '🇬🇧 English'}</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>📦</Text>
            </View>
            <Text style={styles.logoText}>Akabati</Text>
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('login')}</Text>

            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="login-identifier"
                style={styles.input}
                placeholder={`${t('phone_number')} / ${t('email')}`}
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="default"
                autoCapitalize="none"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="login-password"
                style={styles.inputFlex}
                placeholder={t('password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                placeholderTextColor={Colors.textTertiary}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="login-submit"
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.btnText}>{t('login')}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity testID="google-login-btn" style={styles.googleBtn} onPress={handleGoogleLogin}>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>{t('google_signin')}</Text>
            </TouchableOpacity>

            {/* Signup link */}
            <View style={styles.linkRow}>
              <Text style={styles.linkText}>{t('no_account')} </Text>
              <TouchableOpacity testID="signup-link" onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.link}>{t('create_account')}</Text>
              </TouchableOpacity>
            </View>

            {/* Demo hint */}
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo Accounts:</Text>
              <Text style={styles.demoText}>User: +250788111222 / test123</Text>
              <Text style={styles.demoText}>Courier: +250788333444 / courier123</Text>
              <Text style={styles.demoText}>Admin: benishimwe31@gmail.com / admin123</Text>
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
  container: { padding: 24, paddingBottom: 40 },
  langBtn: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  langText: { color: Colors.primaryDark, fontWeight: '600', fontSize: 13 },
  logoWrap: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  logoIcon: {
    width: 80, height: 80, backgroundColor: Colors.primary,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  logoEmoji: { fontSize: 36 },
  logoText: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary },
  tagline: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, fontWeight: '500' },
  form: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 24 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, paddingHorizontal: 14, height: 56,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  inputFlex: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  eyeBtn: { padding: 4 },
  btn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textTertiary, paddingHorizontal: 12, fontSize: 13 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  googleIcon: {
    fontSize: 20, fontWeight: '900', color: '#4285F4',
    marginRight: 10, fontFamily: 'serif',
  },
  googleText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  demoBox: {
    backgroundColor: Colors.yellowLight, borderRadius: 10,
    padding: 12, marginTop: 20,
  },
  demoTitle: { fontWeight: '700', fontSize: 13, color: Colors.yellowDark, marginBottom: 4 },
  demoText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
});
