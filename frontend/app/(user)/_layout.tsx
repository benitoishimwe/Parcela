import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../contexts/LanguageContext';

export default function UserLayout() {
  const { t } = useLanguage();
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
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('map'),
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          title: t('send'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name="send" size={24} color={focused ? Colors.white : Colors.white} />
          ),
          tabBarIconStyle: { marginTop: -6 },
          tabBarItemStyle: {
            backgroundColor: Colors.primary,
            borderRadius: 16,
            marginHorizontal: 6,
            marginTop: -8,
            height: 52,
          },
          tabBarLabelStyle: { color: Colors.white, fontSize: 11, fontWeight: '700' },
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: t('track'),
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('me'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="qrcode" options={{ href: null }} />
    </Tabs>
  );
}
