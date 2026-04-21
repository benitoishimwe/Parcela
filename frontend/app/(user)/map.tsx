import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  FlatList, Platform, ScrollView, TextInput, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

const CACHE_KEY = 'parcela_lockers_cache';
const SHEET_HEIGHT = 380;

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'map' | 'list';
type AvailFilter = 'all' | 'available' | 'limited' | 'full';
type SizeFilter  = 'all' | 'small' | 'medium' | 'large';

interface FilterState {
  avail:    AvailFilter;
  size:     SizeFilter;
  access24h: boolean;
}
const DEFAULT_FILTERS: FilterState = { avail: 'all', size: 'all', access24h: false };

// ── Locker helpers ────────────────────────────────────────────────────────────
function getAvailState(l: any): 'available' | 'limited' | 'full' | 'inactive' {
  if (l.status !== 'active') return 'inactive';
  const avail = (l.available_small || 0) + (l.available_medium || 0) + (l.available_large || 0);
  const total = (l.total_small  || 0) + (l.total_medium  || 0) + (l.total_large  || 0);
  if (avail === 0)                      return 'full';
  if (total > 0 && avail / total < 0.3) return 'limited';
  return 'available';
}

const AVAIL = {
  available: { label: 'Available', color: Colors.green,        bg: Colors.greenLight,      hex: '#16A34A' },
  limited:   { label: 'Limited',   color: '#D97706',           bg: '#FEF3C7',              hex: '#F59E0B' },
  full:      { label: 'Full',      color: Colors.error,        bg: Colors.errorLight,      hex: '#EF4444' },
  inactive:  { label: 'Inactive',  color: Colors.textTertiary, bg: Colors.surfaceElevated, hex: '#94A3B8' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function openNav(lat: number, lng: number, name: string) {
  const enc = encodeURIComponent(name);
  const url =
    Platform.OS === 'ios'     ? `maps:?daddr=${lat},${lng}&q=${enc}` :
    Platform.OS === 'android' ? `geo:${lat},${lng}?q=${lat},${lng}(${enc})` :
                                `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Bone({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1,   duration: 850, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 850, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View
      style={{ width: w as any, height: h, borderRadius: r, backgroundColor: Colors.border, opacity: anim }}
    />
  );
}

function MapSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Ionicons name="map-outline" size={48} color={Colors.border} />
      <Bone w={140} h={16} />
      <Bone w={90} h={12} r={6} />
    </View>
  );
}

function ListSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[styles.lockerCard, { marginBottom: 12 }]}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Bone w={48} h={48} r={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone w="65%" h={15} />
              <Bone w="85%" h={12} r={6} />
              <Bone w="45%" h={12} r={6} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Bone w={64} h={24} r={20} />
            <Bone w={64} h={24} r={20} />
            <Bone w={64} h={24} r={20} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Map HTML ──────────────────────────────────────────────────────────────────
function buildMapHtml(lockers: any[]): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
#map{width:100%;height:100vh;background:#EEF2F7;}

/* Leaflet zoom control */
.leaflet-control-zoom{border:none!important;box-shadow:none!important;display:flex;flex-direction:column;gap:6px;}
.leaflet-control-zoom a{
  width:42px!important;height:42px!important;line-height:42px!important;font-size:18px!important;
  border-radius:13px!important;background:white!important;color:#0F172A!important;
  border:none!important;box-shadow:0 4px 14px rgba(0,0,0,0.16)!important;
  transition:transform 0.1s,box-shadow 0.1s!important;
}
.leaflet-control-zoom a:hover{background:#F8FAFC!important;transform:scale(1.06)!important;}
.leaflet-control-zoom a:active{transform:scale(0.93)!important;}
.leaflet-control-zoom-in{border-bottom:none!important;margin-bottom:0!important;}
.leaflet-control-attribution{font-size:9px!important;opacity:0.6!important;}
.leaflet-popup-content-wrapper,.leaflet-popup-tip{display:none!important;}

/* Custom control panel */
.ctrl-panel{position:absolute;right:12px;bottom:80px;z-index:1000;display:flex;flex-direction:column;gap:8px;}
.ctrl-btn{
  width:42px;height:42px;background:white;border:none;border-radius:13px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 14px rgba(0,0,0,0.18);cursor:pointer;
  transition:transform 0.12s,box-shadow 0.12s,background 0.18s;
  -webkit-tap-highlight-color:transparent;
}
.ctrl-btn:active{transform:scale(0.91);box-shadow:0 2px 6px rgba(0,0,0,0.12);}
.ctrl-btn.sat-active{background:#0F172A;}
.ctrl-btn.locating{opacity:0.65;}

/* Locker markers */
.lm{
  width:42px;height:42px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  border:2.5px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.3);
  position:relative;font-size:19px;cursor:pointer;
  transition:transform 0.15s;
}
.lm:active{transform:scale(0.88);}
.lm-avail{background:#16A34A;}
.lm-lim  {background:#F59E0B;}
.lm-full {background:#EF4444;}
.lm-off  {background:#94A3B8;opacity:0.65;}
.lm.pulse::after{
  content:'';position:absolute;width:100%;height:100%;
  border-radius:50%;animation:ripple 2.6s infinite;pointer-events:none;
}
.lm-avail.pulse::after{background:rgba(22,163,74,0.42);}
.lm-lim.pulse::after  {background:rgba(245,158,11,0.42);}
@keyframes ripple{0%{transform:scale(1);opacity:0.8;}100%{transform:scale(3);opacity:0;}}
@keyframes markerIn{
  0%  {transform:scale(0) translateY(-16px);opacity:0;}
  65% {transform:scale(1.18) translateY(0);opacity:1;}
  100%{transform:scale(1);opacity:1;}
}
.lm-enter{animation:markerIn 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards;}

/* Clusters */
.marker-cluster{border-radius:50%;}
.marker-cluster div{
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:13px;color:white;
  border:2.5px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.25);
}
.marker-cluster-small  div{background:#16A34A;}
.marker-cluster-medium div{background:#F59E0B;}
.marker-cluster-large  div{background:#EF4444;}

/* User location dot */
.user-dot{
  width:18px;height:18px;border-radius:50%;
  background:#00A1DE;border:3px solid white;
  box-shadow:0 2px 8px rgba(0,161,222,0.55);
}
</style>
</head>
<body>
<div id="map"></div>
<div class="ctrl-panel">
  <button class="ctrl-btn" id="locateBtn" onclick="locateUser()" title="My location">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A1DE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
    </svg>
  </button>
  <button class="ctrl-btn" id="styleBtn" onclick="toggleStyle()" title="Toggle satellite">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon id="styleIcon" points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  </button>
</div>
<script>
const map = L.map('map', { center:[-1.9441,30.0619], zoom:13, zoomControl:true });
map.zoomControl.setPosition('topright');

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19});
const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19});
osmLayer.addTo(map);
let currentStyle = 'osm';

function toggleStyle() {
  const btn = document.getElementById('styleBtn');
  const icon = document.getElementById('styleIcon');
  if (currentStyle === 'osm') {
    map.removeLayer(osmLayer); satLayer.addTo(map); currentStyle = 'sat';
    btn.classList.add('sat-active');
    icon.setAttribute('stroke','#FAD201');
  } else {
    map.removeLayer(satLayer); osmLayer.addTo(map); currentStyle = 'osm';
    btn.classList.remove('sat-active');
    icon.setAttribute('stroke','#64748B');
  }
}

const clusterGroup = L.markerClusterGroup({
  maxClusterRadius:55, spiderfyOnMaxZoom:true, showCoverageOnHover:false,
  iconCreateFunction:function(cluster){
    const n=cluster.getChildCount();
    const sz=n<10?'small':n<25?'medium':'large';
    const sz2=n<10?36:n<25?42:48;
    return L.divIcon({html:'<div><span>'+n+'</span></div>',className:'marker-cluster marker-cluster-'+sz,iconSize:[sz2,sz2]});
  }
});

function postMsg(msg){
  try{
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else window.parent.postMessage(msg,'*');
  }catch(e){}
}

function makeMarker(l){
  const avail=(l.available_small||0)+(l.available_medium||0)+(l.available_large||0);
  const total=(l.total_small||0)+(l.total_medium||0)+(l.total_large||0);
  let cls,pulse=false;
  if(l.status!=='active'){cls='lm-off';}
  else if(avail===0){cls='lm-full';}
  else if(total>0&&avail/total<0.3){cls='lm-lim';pulse=true;}
  else{cls='lm-avail';pulse=true;}
  const icon=L.divIcon({
    html:'<div class="lm '+cls+(pulse?' pulse':'')+' lm-enter">📦</div>',
    className:'',iconSize:[42,42],iconAnchor:[21,21],popupAnchor:[0,-24]
  });
  const m=L.marker([l.lat,l.lng],{icon});
  m.on('click',function(){postMsg(JSON.stringify({type:'marker_tap',locker:l}));});
  return m;
}

function updateMarkers(list){
  clusterGroup.clearLayers();
  (list||[]).forEach(function(l){if(l.lat&&l.lng)clusterGroup.addLayer(makeMarker(l));});
  if(!map.hasLayer(clusterGroup))map.addLayer(clusterGroup);
}
updateMarkers(${JSON.stringify(lockers)});

let userMarker=null;
function locateUser(){
  const btn=document.getElementById('locateBtn');
  btn.classList.add('locating');
  if(!navigator.geolocation){btn.classList.remove('locating');return;}
  navigator.geolocation.getCurrentPosition(
    function(pos){
      const lat=pos.coords.latitude,lng=pos.coords.longitude;
      if(userMarker)map.removeLayer(userMarker);
      userMarker=L.marker([lat,lng],{icon:L.divIcon({html:'<div class="user-dot"></div>',className:'',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map);
      map.flyTo([lat,lng],15,{duration:1.1});
      btn.classList.remove('locating');
      postMsg(JSON.stringify({type:'location',lat:lat,lng:lng}));
    },
    function(){btn.classList.remove('locating');},
    {enableHighAccuracy:true,timeout:9000}
  );
}

window.addEventListener('message',function(e){
  try{
    const d=JSON.parse(e.data);
    if(d.type==='update_markers')updateMarkers(d.lockers);
  }catch(ex){}
});
</script>
</body></html>`;
}

// ── Locker Info Sheet ─────────────────────────────────────────────────────────
function LockerInfoSheet({
  locker, onClose, onSend,
}: {
  locker: any | null;
  onClose: () => void;
  onSend: (locker: any) => void;
}) {
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (locker) {
      Animated.parallel([
        Animated.spring(slideY,     { toValue: 0, tension: 68, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,     { toValue: SHEET_HEIGHT, duration: 230, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [locker]);

  if (!locker) return null;

  const state    = getAvailState(locker);
  const avConfig = AVAIL[state];
  const totalAvail =
    (locker.available_small || 0) +
    (locker.available_medium || 0) +
    (locker.available_large || 0);

  const compartments = [
    { label: 'S', avail: locker.available_small, total: locker.total_small },
    { label: 'M', avail: locker.available_medium, total: locker.total_medium },
    { label: 'L', avail: locker.available_large, total: locker.total_large },
  ];

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={locker ? 'auto' : 'none'}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Header row */}
        <View style={styles.sheetHeader}>
          <View style={[styles.sheetIconWrap, { backgroundColor: avConfig.bg }]}>
            <Text style={{ fontSize: 22 }}>📦</Text>
          </View>
          <View style={styles.sheetTitleGroup}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{locker.name}</Text>
            <Text style={styles.sheetAddr} numberOfLines={1}>
              {locker.address}{locker.district ? ` · ${locker.district}` : ''}
            </Text>
          </View>
          <View style={[styles.availBadge, { backgroundColor: avConfig.bg }]}>
            <View style={[styles.availDot, { backgroundColor: avConfig.hex }]} />
            <Text style={[styles.availText, { color: avConfig.color }]}>{avConfig.label}</Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.sheetMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.metaLabel}>{locker.hours || '24/7'}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.metaLabel}>{totalAvail} slots free</Text>
          </View>
          {locker.distance != null && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Ionicons name="navigate-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.metaLabel}>{locker.distance < 1 ? `${Math.round(locker.distance * 1000)}m` : `${locker.distance.toFixed(1)}km`}</Text>
              </View>
            </>
          )}
        </View>

        {/* Compartments */}
        <View style={styles.compartmentsRow}>
          {compartments.map(c => {
            const hasSpace = (c.avail || 0) > 0;
            return (
              <View
                key={c.label}
                style={[styles.compCard, { backgroundColor: hasSpace ? Colors.greenLight : Colors.errorLight }]}
              >
                <Text style={[styles.compLabel, { color: hasSpace ? Colors.green : Colors.error }]}>{c.label}</Text>
                <Text style={[styles.compCount, { color: hasSpace ? Colors.green : Colors.error }]}>
                  {c.avail || 0}<Text style={styles.compTotal}>/{c.total || 0}</Text>
                </Text>
              </View>
            );
          })}
          <View style={[styles.compCard, { backgroundColor: Colors.primaryLight, flex: 1.4 }]}>
            <Ionicons name={locker.hours === '24/7' || !locker.hours ? 'moon-outline' : 'sunny-outline'} size={14} color={Colors.primary} />
            <Text style={[styles.compLabel, { color: Colors.primary, marginTop: 2 }]}>
              {locker.hours || '24/7'}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={() => openNav(locker.lat, locker.lng, locker.name)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={16} color={Colors.primary} />
            <Text style={styles.navigateBtnText}>Navigate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendBtn,
              state === 'full' || state === 'inactive' ? styles.sendBtnDisabled : null,
            ]}
            onPress={() => { if (state !== 'full' && state !== 'inactive') onSend(locker); }}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={15} color={Colors.white} />
            <Text style={styles.sendBtnText}>Send Parcel Here</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

// ── Locker List Card ──────────────────────────────────────────────────────────
function LockerListCard({
  locker, onSend,
}: {
  locker: any;
  onSend: (locker: any) => void;
}) {
  const state    = getAvailState(locker);
  const avConfig = AVAIL[state];
  const compartments = [
    { label: 'S', avail: locker.available_small, total: locker.total_small },
    { label: 'M', avail: locker.available_medium, total: locker.total_medium },
    { label: 'L', avail: locker.available_large, total: locker.total_large },
  ];
  const canSend = state !== 'full' && state !== 'inactive';

  return (
    <View testID={`locker-${locker.locker_id}`} style={styles.lockerCard}>
      {/* Top row */}
      <View style={styles.lockerCardTop}>
        <View style={[styles.lockerIconWrap, { backgroundColor: avConfig.bg }]}>
          <Text style={{ fontSize: 22 }}>📦</Text>
        </View>
        <View style={styles.lockerInfo}>
          <Text style={styles.lockerName} numberOfLines={1}>{locker.name}</Text>
          <Text style={styles.lockerAddr} numberOfLines={1}>{locker.address}</Text>
          {locker.district ? <Text style={styles.lockerDistrict}>{locker.district}</Text> : null}
        </View>
        <View style={[styles.availBadge, { backgroundColor: avConfig.bg }]}>
          <View style={[styles.availDot, { backgroundColor: avConfig.hex }]} />
          <Text style={[styles.availText, { color: avConfig.color }]}>{avConfig.label}</Text>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.lockerMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.metaLabel}>{locker.hours || '24/7'}</Text>
        </View>
        {locker.distance != null && (
          <>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.metaLabel}>
                {locker.distance < 1 ? `${Math.round(locker.distance * 1000)}m` : `${locker.distance.toFixed(1)}km`}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Compartments */}
      {locker.status === 'active' && (
        <View style={styles.compartmentsRow}>
          {compartments.map(c => {
            const hasSpace = (c.avail || 0) > 0;
            return (
              <View
                key={c.label}
                style={[styles.compCard, { backgroundColor: hasSpace ? Colors.greenLight : Colors.errorLight }]}
              >
                <Text style={[styles.compLabel, { color: hasSpace ? Colors.green : Colors.error }]}>{c.label}</Text>
                <Text style={[styles.compCount, { color: hasSpace ? Colors.green : Colors.error }]}>
                  {c.avail || 0}<Text style={styles.compTotal}>/{c.total || 0}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.navigateBtn}
          onPress={() => openNav(locker.lat, locker.lng, locker.name)}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={14} color={Colors.primary} />
          <Text style={styles.navigateBtnText}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={() => { if (canSend) onSend(locker); }}
          activeOpacity={0.85}
        >
          <Ionicons name="send" size={13} color={Colors.white} />
          <Text style={styles.sendBtnText}>Send Parcel Here</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Filter chips config ───────────────────────────────────────────────────────
const AVAIL_FILTERS: { key: AvailFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'limited',   label: 'Limited' },
  { key: 'full',      label: 'Full' },
];
const SIZE_FILTERS: { key: SizeFilter; label: string }[] = [
  { key: 'all',    label: 'Any Size' },
  { key: 'small',  label: 'Small'    },
  { key: 'medium', label: 'Medium'   },
  { key: 'large',  label: 'Large'    },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();

  const [lockers,   setLockers]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [offline,   setOffline]   = useState(false);
  const [viewMode,  setViewMode]  = useState<ViewMode>('map');
  const [search,    setSearch]    = useState('');
  const [filters,   setFilters]   = useState<FilterState>(DEFAULT_FILTERS);
  const [selected,  setSelected]  = useState<any | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // WebView / iframe refs for injecting JS
  const webViewRef = useRef<any>(null);
  const iframeRef  = useRef<any>(null);

  const firstName = user?.name?.split(' ')[0] || 'Explorer';

  // ── Load lockers ────────────────────────────────────────────────────────────
  const loadLockers = useCallback(async () => {
    try {
      const data = await api.get('/api/lockers');
      setLockers(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setOffline(false);
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) { setLockers(JSON.parse(cached)); setOffline(true); }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadLockers(); }, [loadLockers]);

  // ── Web: listen for postMessage from iframe ─────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: any) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'marker_tap') setSelected(d.locker);
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Filtered lockers ────────────────────────────────────────────────────────
  const filteredLockers = useMemo(() => {
    let list = [...lockers];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q) ||
        l.district?.toLowerCase().includes(q),
      );
    }

    // Availability filter
    if (filters.avail !== 'all') {
      list = list.filter(l => getAvailState(l) === filters.avail);
    }

    // Size filter
    if (filters.size !== 'all') {
      const key = `available_${filters.size}` as any;
      list = list.filter(l => (l[key] || 0) > 0);
    }

    // 24h filter
    if (filters.access24h) {
      list = list.filter(l => !l.hours || l.hours === '24/7');
    }

    return list;
  }, [lockers, search, filters]);

  // ── Push updated markers into map ────────────────────────────────────────────
  const pushMarkers = useCallback((list: any[]) => {
    const msg = JSON.stringify({ type: 'update_markers', lockers: list });
    if (Platform.OS === 'web') {
      try { (iframeRef.current as any)?.contentWindow?.postMessage(msg, '*'); } catch {}
    } else {
      webViewRef.current?.injectJavaScript(`updateMarkers(${JSON.stringify(list)});true;`);
    }
  }, []);

  useEffect(() => {
    if (!loading && viewMode === 'map') pushMarkers(filteredLockers);
  }, [filteredLockers, loading, viewMode, pushMarkers]);

  // ── Handle locker action: send ───────────────────────────────────────────────
  const handleSend = (locker: any) => {
    setSelected(null);
    router.push({ pathname: '/(user)/send', params: { lockerId: locker.locker_id } } as any);
  };

  // ── Map HTML (initial render) ────────────────────────────────────────────────
  const mapHtml = useMemo(() => buildMapHtml(lockers), [lockers]);

  const activeFilterCount =
    (filters.avail !== 'all' ? 1 : 0) +
    (filters.size  !== 'all' ? 1 : 0) +
    (filters.access24h       ? 1 : 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.greetText}>{getGreeting()}, {firstName}</Text>
          <Text style={styles.topTitle}>{t('find_lockers')}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            testID="view-mode-map"
            style={[styles.modeBtn, viewMode === 'map' && styles.modeBtnActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map-outline" size={16} color={viewMode === 'map' ? Colors.white : Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="view-mode-list"
            style={[styles.modeBtn, viewMode === 'list' && styles.modeBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list-outline" size={16} color={viewMode === 'list' ? Colors.white : Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search + filter bar ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lockers by name or area…"
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              testID="locker-search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <Ionicons name="options-outline" size={17} color={activeFilterCount > 0 ? Colors.white : Colors.textSecondary} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Filter chips panel */}
        {showFilters && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterGroupLabel}>Availability</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {AVAIL_FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, filters.avail === f.key && styles.chipActive]}
                  onPress={() => setFilters(p => ({ ...p, avail: f.key }))}
                >
                  <Text style={[styles.chipText, filters.avail === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.filterGroupLabel, { marginTop: 10 }]}>Size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {SIZE_FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, filters.size === f.key && styles.chipActive]}
                  onPress={() => setFilters(p => ({ ...p, size: f.key }))}
                >
                  <Text style={[styles.chipText, filters.size === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={[styles.chip, filters.access24h && styles.chipActive]}
                onPress={() => setFilters(p => ({ ...p, access24h: !p.access24h }))}
              >
                <Ionicons name="moon-outline" size={13} color={filters.access24h ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.chipText, filters.access24h && styles.chipTextActive]}>24/7 Access</Text>
              </TouchableOpacity>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => setFilters(DEFAULT_FILTERS)}
                >
                  <Text style={styles.clearBtnText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* ── Offline banner ── */}
      {offline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={13} color={Colors.white} />
          <Text style={styles.offlineText}>Offline · Showing cached lockers</Text>
          <TouchableOpacity onPress={loadLockers} style={styles.retrySmall}>
            <Ionicons name="refresh-outline" size={13} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content area ── */}
      {loading ? (
        viewMode === 'map' ? <MapSkeleton /> : <ListSkeleton />
      ) : filteredLockers.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search-outline" size={36} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No lockers found</Text>
          <Text style={styles.emptyBody}>
            {search ? `No results for "${search}"` : 'No lockers match your filters'}
          </Text>
          <TouchableOpacity
            style={styles.clearFiltersBtn}
            onPress={() => { setSearch(''); setFilters(DEFAULT_FILTERS); }}
          >
            <Text style={styles.clearFiltersBtnText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'map' ? (
        <View style={styles.mapWrap}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <iframe
              ref={iframeRef}
              srcDoc={mapHtml}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
            />
          ) : (
            (() => {
              const { WebView } = require('react-native-webview');
              return (
                <WebView
                  ref={webViewRef}
                  testID="lockers-map"
                  source={{ html: mapHtml }}
                  style={{ flex: 1 }}
                  javaScriptEnabled
                  scrollEnabled={false}
                  onMessage={(e: any) => {
                    try {
                      const d = JSON.parse(e.nativeEvent.data);
                      if (d.type === 'marker_tap') setSelected(d.locker);
                    } catch {}
                  }}
                />
              );
            })()
          )}

          {/* Map legend overlay */}
          <View style={styles.mapLegend} pointerEvents="none">
            {(['available', 'limited', 'full'] as const).map(s => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: AVAIL[s].hex }]} />
                <Text style={styles.legendText}>{AVAIL[s].label}</Text>
              </View>
            ))}
          </View>

          {/* Count pill */}
          <View style={styles.countPill} pointerEvents="none">
            <Ionicons name="location" size={12} color={Colors.primary} />
            <Text style={styles.countPillText}>{filteredLockers.length} locker{filteredLockers.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredLockers}
          keyExtractor={item => item.locker_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <LockerListCard locker={item} onSend={handleSend} />
          )}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredLockers.length} locker{filteredLockers.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          }
        />
      )}

      {/* ── Bottom info sheet ── */}
      <LockerInfoSheet
        locker={selected}
        onClose={() => setSelected(null)}
        onSend={handleSend}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  topBarLeft: { flex: 1 },
  greetText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', marginBottom: 1 },
  topTitle:  { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  topBarRight: { flexDirection: 'row', gap: 6 },
  modeBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  modeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  // Search section
  searchSection: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 },
  filterBtn: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadows.sm,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBadge: {
    position: 'absolute', top: -3, right: -3,
    width: 17, height: 17, borderRadius: 9,
    backgroundColor: Colors.error, borderWidth: 1.5, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  // Filter panel
  filterPanel: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.card,
  },
  filterGroupLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', gap: 7, paddingBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  clearBtnText: { color: Colors.error, fontWeight: '700', fontSize: 12 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  offlineText: { flex: 1, color: Colors.white, fontSize: 12, fontWeight: '600' },
  retrySmall: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Map
  mapWrap: { flex: 1, position: 'relative' },
  mapLegend: {
    position: 'absolute', left: 12, bottom: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    gap: 5, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  countPill: {
    position: 'absolute', top: 14, left: '50%', transform: [{ translateX: -50 }],
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  countPillText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },

  // Empty state
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10,
  },
  emptyIconWrap: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  emptyBody:  { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  clearFiltersBtn: {
    marginTop: 6, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, backgroundColor: Colors.primaryLight,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  clearFiltersBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  // List header
  listHeader: { marginBottom: 12 },
  listHeaderText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '600' },

  // Locker card (list view)
  lockerCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  lockerCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  lockerIconWrap: {
    width: 48, height: 48, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  lockerInfo: { flex: 1 },
  lockerName:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  lockerAddr:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  lockerDistrict: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  lockerMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },

  // Availability badge
  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, flexShrink: 0,
  },
  availDot:  { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 11, fontWeight: '700' },

  // Compartments
  compartmentsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  compCard: {
    flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center', minWidth: 48,
  },
  compLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  compCount: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  compTotal: { fontSize: 11, fontWeight: '500' },

  // Card / sheet meta
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaLabel:  { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  metaDivider:{ width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.border, marginHorizontal: 6 },

  // Action buttons (shared)
  cardActions: {
    flexDirection: 'row', gap: 10,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  navigateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight,
  },
  navigateBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  sendBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.primary,
    ...Shadows.primary,
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary, shadowOpacity: 0 },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // ── Bottom sheet ────────────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, zIndex: 20,
    ...Shadows.large,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 18,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sheetIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetTitleGroup: { flex: 1 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: 3 },
  sheetAddr:  { fontSize: 13, color: Colors.textSecondary },
  sheetMeta:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sheetActions: {
    flexDirection: 'row', gap: 10,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingTop: 16, marginTop: 4,
  },
});
