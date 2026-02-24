import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
    } else if (user.role === 'admin') {
      router.replace('/admin/');
    } else if (user.role === 'courier') {
      router.replace('/(courier)/dashboard');
    } else {
      router.replace('/(user)/home');
    }
  }, [loading, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Text style={styles.logoIcon}>📦</Text>
        <Text style={styles.logoText}>Akabati</Text>
        <Text style={styles.tagline}>Rwanda's Parcel Network</Text>
      </View>
      <ActivityIndicator size="large" color={Colors.white} style={{ marginTop: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: { alignItems: 'center' },
  logoIcon: { fontSize: 64, marginBottom: 12 },
  logoText: { fontSize: 42, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 8, fontWeight: '500' },
});
