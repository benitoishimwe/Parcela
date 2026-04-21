import { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect when auth is fully settled and the user is definitely not admin.
    if (!loading && (!user || user.role !== 'admin')) {
      router.replace('/(auth)/login');
    }
  }, [loading, user]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 64,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 1,
        },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="lockers"
        options={{
          title: 'Lockers',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'cube' : 'cube-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="parcels"
        options={{
          title: 'Parcels',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'bag' : 'bag-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
