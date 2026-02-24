import { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

const CACHE_KEY = 'akabati_lockers_cache';

export default function MapScreen() {
  const { t } = useLanguage();
  const [lockers, setLockers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    loadLockers();
  }, []);

  const loadLockers = async () => {
    try {
      const data = await api.get('/api/lockers');
      setLockers(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setLockers(JSON.parse(cached));
        setOffline(true);
      }
    }
    setLoading(false);
  };

  const mapHtml = `
<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
#map{height:100vh;width:100%;}
.leaflet-popup-content-wrapper{border-radius:14px;padding:0;}
.leaflet-popup-content{margin:0;width:220px!important;}
.popup{padding:14px;}
.pop-title{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:4px;}
.pop-addr{font-size:12px;color:#64748B;margin-bottom:8px;}
.pop-avail{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;}
.chip{background:#DCFCE7;color:#14532D;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;}
.chip-na{background:#F1F5F9;color:#94A3B8;}
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;}
</style>
</head><body><div id="map"></div>
<script>
const map=L.map('map').setView([-1.9441,30.0619],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
const lockers=${JSON.stringify(lockers)};
lockers.forEach(l=>{
  const isActive=l.status==='active';
  const icon=L.divIcon({
    html:'<div style="background:'+(isActive?'#00A1DE':'#94A3B8')+';color:white;border-radius:12px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 3px 10px rgba(0,0,0,0.25);border:2.5px solid white;">📦</div>',
    className:'',iconSize:[42,42],iconAnchor:[21,21],popupAnchor:[0,-22]
  });
  L.marker([l.lat,l.lng],{icon}).addTo(map).bindPopup(
    '<div class="popup">'+
    '<div class="pop-title">'+l.name+'</div>'+
    '<div class="pop-addr">📍 '+l.address+'</div>'+
    '<div class="pop-avail">'+
    '<span class="chip">S: '+l.available_small+'</span>'+
    '<span class="chip">M: '+l.available_medium+'</span>'+
    '<span class="chip">L: '+l.available_large+'</span>'+
    '</div>'+
    '<div style="font-size:12px;color:'+(isActive?'#20603D':'#94A3B8')+';font-weight:600;">'+
    '<span class="status-dot" style="background:'+(isActive?'#20603D':'#94A3B8')+'"></span>'+
    (isActive?'Active':'Out of Service')+
    '</div></div>'
  );
});
</script></body></html>`;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('find_lockers')}</Text>
        <View style={styles.toggleRow}>
          {(['map', 'list'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              testID={`view-mode-${mode}`}
              style={[styles.toggleBtn, viewMode === mode && styles.toggleActive]}
              onPress={() => setViewMode(mode)}
            >
              <Ionicons
                name={mode === 'map' ? 'map-outline' : 'list-outline'}
                size={16}
                color={viewMode === mode ? Colors.white : Colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {offline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={Colors.white} />
          <Text style={styles.offlineText}>{t('offline_mode')} – {t('save_for_offline')}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      ) : viewMode === 'map' ? (
        <WebView
          testID="lockers-map"
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={lockers}
          keyExtractor={item => item.locker_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => <LockerCard locker={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function LockerCard({ locker }: { locker: any }) {
  const isActive = locker.status === 'active';
  return (
    <View testID={`locker-${locker.locker_id}`} style={styles.lockerCard}>
      <View style={styles.lockerRow}>
        <View style={[styles.lockerIconWrap, { backgroundColor: isActive ? Colors.primaryLight : '#F1F5F9' }]}>
          <Text style={{ fontSize: 22 }}>📦</Text>
        </View>
        <View style={styles.lockerInfo}>
          <Text style={styles.lockerName}>{locker.name}</Text>
          <Text style={styles.lockerAddr}>{locker.address}</Text>
          <Text style={styles.lockerDistrict}>{locker.district}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.green : Colors.textTertiary }]} />
      </View>
      {isActive && (
        <View style={styles.compartmentsRow}>
          {[
            { label: 'S', available: locker.available_small, total: locker.total_small },
            { label: 'M', available: locker.available_medium, total: locker.total_medium },
            { label: 'L', available: locker.available_large, total: locker.total_large },
          ].map(c => (
            <View key={c.label} style={[styles.compChip, { backgroundColor: c.available > 0 ? Colors.greenLight : '#FEE2E2' }]}>
              <Text style={[styles.compText, { color: c.available > 0 ? Colors.green : Colors.error }]}>
                {c.label}: {c.available}/{c.total}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  toggleRow: { flexDirection: 'row', gap: 6 },
  toggleBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  offlineBanner: {
    backgroundColor: Colors.warning, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  offlineText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  map: { flex: 1 },
  lockerCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  lockerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  lockerIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  lockerInfo: { flex: 1 },
  lockerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  lockerAddr: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  lockerDistrict: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  compartmentsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  compChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  compText: { fontSize: 12, fontWeight: '700' },
});
