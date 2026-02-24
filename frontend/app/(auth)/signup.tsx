import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
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

  const handleSignup = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      Alert.alert(t('error'), 'Name, phone and password are required');
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('error'), 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), phone.trim(), email.trim(), password);
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>📦</Text>
            </View>
            <Text style={styles.logoText}>Akabati</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>{t('create_account')}</Text>
            <Text style={styles.formSub}>Join Rwanda's parcel network</Text>

            {/* Name */}
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-name"
                style={styles.input}
                placeholder={t('full_name')}
                value={name}
                onChangeText={setName}
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-phone"
                style={styles.input}
                placeholder="+250 7XX XXX XXX"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            {/* Email */}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-email"
                style={styles.input}
                placeholder={t('email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="signup-password"
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
              testID="signup-submit"
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.btnText}>{t('signup')}</Text>
              )}
            </TouchableOpacity>

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
  container: { padding: 24, paddingBottom: 40 },
  backBtn: { marginBottom: 8 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  logoIcon: {
    width: 72, height: 72, backgroundColor: Colors.primary,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoEmoji: { fontSize: 32 },
  logoText: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  form: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  formSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
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
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
