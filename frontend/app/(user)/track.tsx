import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  Animated, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, STATUS_COLORS, STATUS_LABELS, STATUS_ICONS, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const RECENT_KEY = '@akabati_recent_tracks';
const MAX_RECENT = 5;

type ErrorType = 'not_found' | 'network' | 'generic';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SkeletonPulse({ style }: { style: any }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return <Animated.View style={[{ opacity: anim, backgroundColor: Colors.border, borderRadius: 8 }, style]} />;
}

function TrackingSkeleton() {
  return (
    <View style={skStyles.wrap}>
      <View style={skStyles.hero}>
        <SkeletonPulse style={{ width: 56, height: 56, borderRadius: 16 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonPulse style={{ height: 18, width: '60%' }} />
          <SkeletonPulse style={{ height: 13, width: '40%' }} />
        </View>
      </View>
      <View style={skStyles.route}>
        <SkeletonPulse style={{ height: 56, flex: 1, borderRadius: 14 }} />
      </View>
      <View style={skStyles.chips}>
        {[1, 2, 3].map(i => (
          <SkeletonPulse key={i} style={{ flex: 1, height: 72, borderRadius: 14 }} />
        ))}
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 12, marginTop: 4 },
  hero: { backgroundColor: Colors.white, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', ...Shadows.card },
  route: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, ...Shadows.card },
  chips: { flexDirection: 'row', gap: 8 },
});

function ErrorCard({
  type, message, onRetry,
}: {
  type: ErrorType; message: string; onRetry: () => void;
}) {
  const configs: Record<ErrorType, {
    icon: any; color: string; bg: string; border: string; title: string; body: string;
  }> = {
    not_found: {
      icon: 'search-outline',
      color: Colors.warning,
      bg: Colors.warningLight,
      border: Colors.warning,
      title: 'Parcel Not Found',
      body: 'Double-check your tracking code. It should look like AKB-XXXXXX.',
    },
    network: {
      icon: 'cloud-offline-outline',
      color: Colors.textSecondary,
      bg: Colors.surfaceElevated,
      border: Colors.border,
      title: "You're Offline",
      body: 'Check your internet connection and try again.',
    },
    generic: {
      icon: 'alert-circle-outline',
      color: Colors.error,
      bg: Colors.errorLight,
      border: Colors.error,
      title: 'Something Went Wrong',
      body: message || 'An unexpected error occurred. Please try again.',
    },
  };

  const cfg = configs[type];

  return (
    <View style={[errStyles.card, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}>
      <View style={[errStyles.iconWrap, { backgroundColor: cfg.color + '20' }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      </View>
      <View style={errStyles.body}>
        <Text style={[errStyles.title, { color: cfg.color === Colors.warning ? '#92400E' : cfg.color }]}>
          {cfg.title}
        </Text>
        <Text style={errStyles.text}>{cfg.body}</Text>
        {type !== 'not_found' && (
          <TouchableOpacity onPress={onRetry} style={errStyles.retryBtn} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={14} color={cfg.color} />
            <Text style={[errStyles.retryText, { color: cfg.color }]}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const errStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, borderRadius: 16, padding: 14,
    borderLeftWidth: 3, marginBottom: 4,
    ...Shadows.sm,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  text: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  retryText: { fontSize: 12, fontWeight: '700' },
});

function InfoChip({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={chipStyles.chip}>
      <View style={chipStyles.iconWrap}>
        <Ionicons name={icon} size={15} color={Colors.primary} />
      </View>
      <Text style={chipStyles.label}>{label}</Text>
      <Text style={chipStyles.value} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 5, ...Shadows.sm,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 10, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function Track() {
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code || '');
  const [loading, setLoading] = useState(false);
  const [parcel, setParcel] = useState<any>(null);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<ErrorType>('generic');
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // ── Animations
  const resultAnim = useRef(new Animated.Value(0)).current;
  const errorAnim  = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;
  const cardEntry  = useRef(new Animated.ValueXY({ x: 0, y: 24 })).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const focusAnim  = useRef(new Animated.Value(0)).current;

  // ── Mount animations
  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardEntry, { toValue: { x: 0, y: 0 }, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Load recent searches
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then(raw => { if (raw) setRecentSearches(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const saveRecent = useCallback(async (trackCode: string) => {
    const updated = [trackCode, ...recentSearches.filter(r => r !== trackCode)].slice(0, MAX_RECENT);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
  }, [recentSearches]);

  const springIn = (anim: Animated.Value) =>
    Animated.spring(anim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
  const fadeOut = (anim: Animated.Value) =>
    Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }).start();

  const handleTrack = async (trackCode?: string) => {
    const searchCode = (trackCode || code).trim();
    if (!searchCode) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Button press bounce
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 75, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, tension: 200, friction: 7, useNativeDriver: true }),
    ]).start();

    fadeOut(resultAnim);
    fadeOut(errorAnim);
    setLoading(true);
    setError('');
    setParcel(null);

    try {
      const data = await api.get(`/api/parcels/track/${searchCode.toUpperCase()}`);
      setParcel(data);
      await saveRecent(searchCode.toUpperCase());
      setTimeout(() => springIn(resultAnim), 80);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const status = (err as any).status;
      setErrorType(status === 404 ? 'not_found' : 'generic');
      setError(err.message || 'Parcel not found');
      setTimeout(() => springIn(errorAnim), 80);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (v: string) => {
    setCode(formatCode(v));
    setError('');
    setParcel(null);
    if (error) fadeOut(errorAnim);
  };

  const handleClear = () => {
    setCode('');
    setParcel(null);
    setError('');
    fadeOut(resultAnim);
    fadeOut(errorAnim);
  };

  useEffect(() => {
    if (params.code) {
      setCode(params.code);
      handleTrack(params.code);
    }
  }, [params.code]);

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [Colors.border, Colors.primary] });
  const inputBg     = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [Colors.background, '#F0F9FF'] });

  const removeRecent = async (item: string) => {
    const updated = recentSearches.filter(r => r !== item);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const sc = parcel ? (STATUS_COLORS[parcel.status] || { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' }) : null;
  const statusIcon = parcel ? (STATUS_ICONS[parcel.status] || '📦') : null;

  const showRecent    = recentSearches.length > 0 && !parcel && !error && !loading;
  const showEmpty     = !parcel && !loading && !error && recentSearches.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >

          {/* ── Page Header ──────────────────────────────────────────────── */}
          <View style={styles.pageHeader}>
            <View style={styles.pageHeaderLeft}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="search" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.pageTitle}>{t('track_parcel')}</Text>
                <Text style={styles.pageSubtitle}>Enter a tracking code for real-time status</Text>
              </View>
            </View>
          </View>

          {/* ── Search Card ──────────────────────────────────────────────── */}
          <Animated.View style={[
            styles.searchCard,
            { opacity: cardOpacity, transform: [{ translateY: cardEntry.y }] },
          ]}>
            <Text style={styles.inputLabel}>Tracking Code</Text>

            {/* Input row */}
            <Animated.View style={[styles.inputRow, { borderColor, backgroundColor: inputBg }]}>
              {/* QR / Barcode scan icon */}
              <TouchableOpacity style={styles.scanIconBtn} activeOpacity={0.65}>
                <Ionicons
                  name="qr-code-outline"
                  size={20}
                  color={focused ? Colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>
              <View style={styles.inputDivider} />

              <TextInput
                testID="tracking-input"
                style={styles.textInput}
                value={code}
                onChangeText={handleCodeChange}
                placeholder="e.g. AKB-XXXXXX"
                autoCapitalize="characters"
                placeholderTextColor={Colors.textTertiary}
                onSubmitEditing={() => handleTrack()}
                onFocus={handleFocus}
                onBlur={handleBlur}
                returnKeyType="search"
                maxLength={20}
              />

              {code.length > 0 && !loading && (
                <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Inline format hint */}
            {code.length > 0 && code.length < 5 && (
              <View style={styles.hintRow}>
                <Ionicons name="information-circle-outline" size={13} color={Colors.primary} />
                <Text style={styles.hintText}>Format: AKB-XXXXXX — from your confirmation SMS</Text>
              </View>
            )}

            {/* Track button */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                testID="track-submit"
                style={[styles.trackBtn, (!code.trim() || loading) && styles.trackBtnDisabled]}
                onPress={() => handleTrack()}
                disabled={!code.trim() || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <Text style={styles.trackBtnText}>Searching…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={18} color={Colors.white} />
                    <Text style={styles.trackBtnText}>{t('track_parcel')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* ── Error State ──────────────────────────────────────────────── */}
          {error !== '' && (
            <Animated.View style={[
              styles.animatedBlock,
              {
                opacity: errorAnim,
                transform: [{ translateY: errorAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}>
              <ErrorCard type={errorType} message={error} onRetry={() => handleTrack()} />
            </Animated.View>
          )}

          {/* ── Loading Skeleton ─────────────────────────────────────────── */}
          {loading && <TrackingSkeleton />}

          {/* ── Parcel Result ────────────────────────────────────────────── */}
          {parcel && sc && (
            <Animated.View style={[
              styles.resultWrap,
              {
                opacity: resultAnim,
                transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}>

              {/* Status Hero */}
              <View style={[styles.statusHero, { backgroundColor: sc.bg }]}>
                <View style={styles.statusEmojiWrap}>
                  <Text style={styles.statusEmoji}>{statusIcon}</Text>
                </View>
                <View style={styles.statusHeroBody}>
                  <View style={styles.statusBadgeRow}>
                    <View style={[styles.statusPulse, { backgroundColor: sc.dot }]} />
                    <Text style={[styles.statusLabel, { color: sc.text }]}>{STATUS_LABELS[parcel.status]}</Text>
                  </View>
                  <Text style={styles.trackingCodeText}>{parcel.tracking_code}</Text>
                  {parcel.updated_at && (
                    <Text style={styles.lastUpdated}>
                      Updated{' '}
                      {new Date(parcel.updated_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                      {', '}
                      {new Date(parcel.updated_at).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Route card */}
              <View style={styles.routeCard}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeCircle, { backgroundColor: Colors.primaryLight, borderColor: Colors.primary }]}>
                    <Ionicons name="location" size={14} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.routeRole}>Origin</Text>
                    <Text style={styles.routeName} numberOfLines={1}>{parcel.origin_locker_name}</Text>
                  </View>
                </View>
                <View style={styles.routeConnector}>
                  <View style={styles.routeLine} />
                  <Ionicons name="arrow-forward" size={13} color={Colors.textTertiary} />
                  <View style={styles.routeLine} />
                </View>
                <View style={styles.routePoint}>
                  <View style={[styles.routeCircle, { backgroundColor: Colors.greenLight, borderColor: Colors.green }]}>
                    <Ionicons name="flag" size={14} color={Colors.green} />
                  </View>
                  <View>
                    <Text style={styles.routeRole}>Destination</Text>
                    <Text style={styles.routeName} numberOfLines={1}>{parcel.destination_locker_name}</Text>
                  </View>
                </View>
              </View>

              {/* Info chips */}
              <View style={styles.chipsRow}>
                <InfoChip icon="person-outline" label="Recipient" value={parcel.recipient_name} />
                <InfoChip icon="cube-outline" label="Size" value={parcel.size ? parcel.size.charAt(0).toUpperCase() + parcel.size.slice(1) : '—'} />
                <InfoChip icon="cash-outline" label="Payment" value={parcel.payment_status || '—'} />
              </View>

              {/* Timeline */}
              {parcel.status_history?.length > 0 && (
                <View style={styles.timelineCard}>
                  <View style={styles.timelineTitleRow}>
                    <Ionicons name="time-outline" size={15} color={Colors.textSecondary} />
                    <Text style={styles.timelineTitle}>Status History</Text>
                  </View>
                  {parcel.status_history.slice().reverse().map((h: any, i: number, arr: any[]) => (
                    <View key={i} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <View style={[
                          styles.timelineDot,
                          i === 0 ? { backgroundColor: sc.dot, borderColor: sc.bg } : {},
                          i === 0 && styles.timelineDotActive,
                        ]} />
                        {i < arr.length - 1 && <View style={styles.timelineConnector} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={[
                          styles.timelineStatus,
                          i === 0 && { color: sc.text, fontWeight: '800' },
                        ]}>
                          {STATUS_ICONS[h.status] || '📦'} {STATUS_LABELS[h.status] || h.status}
                        </Text>
                        {h.note ? <Text style={styles.timelineNote}>{h.note}</Text> : null}
                        <Text style={styles.timelineDate}>
                          {new Date(h.timestamp).toLocaleString('en-RW', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          {/* ── Recent Searches ──────────────────────────────────────────── */}
          {showRecent && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>Recent Searches</Text>
              </View>
              <View style={styles.recentList}>
                {recentSearches.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.recentRow}
                    onPress={() => { setCode(item); handleTrack(item); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentIcon}>
                      <Ionicons name="barcode-outline" size={17} color={Colors.primary} />
                    </View>
                    <Text style={styles.recentCode}>{item}</Text>
                    <TouchableOpacity
                      onPress={() => removeRecent(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={14} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Empty State ──────────────────────────────────────────────── */}
          {showEmpty && (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIllustration}>
                <View style={styles.emptyOuterRing}>
                  <View style={styles.emptyInnerRing}>
                    <Ionicons name="search" size={36} color={Colors.primary} />
                  </View>
                </View>
              </View>
              <Text style={styles.emptyTitle}>Track your parcel</Text>
              <Text style={styles.emptyText}>
                Enter the tracking code from your confirmation SMS or email
              </Text>

              {/* Where to find tips */}
              <View style={styles.tipsCard}>
                <Text style={styles.tipsTitle}>Where to find your code</Text>
                {[
                  { icon: 'mail-outline',       text: 'In your confirmation email' },
                  { icon: 'chatbubble-outline',  text: 'In your SMS notification' },
                  { icon: 'receipt-outline',     text: 'On your drop-off receipt' },
                ].map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <View style={styles.tipIconWrap}>
                      <Ionicons name={tip.icon as any} size={14} color={Colors.primary} />
                    </View>
                    <Text style={styles.tipText}>{tip.text}</Text>
                  </View>
                ))}
              </View>

              {/* Example code */}
              <View style={styles.exampleBox}>
                <Text style={styles.exampleLabel}>Example tracking code</Text>
                <Text style={styles.exampleCode}>AKB-XXXXXXXX</Text>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  animatedBlock: { marginBottom: 4 },

  // Page header
  pageHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  // Search card
  searchCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 12,
    backgroundColor: Colors.white, borderRadius: 20, padding: 16,
    ...Shadows.medium,
  },
  inputLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    height: 54, marginBottom: 12, overflow: 'hidden',
  },
  scanIconBtn: {
    width: 50, height: '100%', alignItems: 'center', justifyContent: 'center',
  },
  inputDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  textInput: {
    flex: 1, paddingHorizontal: 14,
    fontSize: 16, color: Colors.textPrimary,
    fontWeight: '700', letterSpacing: 1.2,
  },
  clearBtn: { paddingHorizontal: 14 },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: -6, marginBottom: 10,
  },
  hintText: { fontSize: 11, color: Colors.primary },
  trackBtn: {
    backgroundColor: Colors.primary, height: 52, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Shadows.primary,
  },
  trackBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  trackBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  // Result
  resultWrap: { paddingHorizontal: 16, gap: 12 },

  statusHero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 16,
  },
  statusEmojiWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusEmoji: { fontSize: 30 },
  statusHeroBody: { flex: 1 },
  statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusPulse: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 15, fontWeight: '800' },
  trackingCodeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  lastUpdated: { fontSize: 11, color: Colors.textTertiary, marginTop: 3 },

  routeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 18, padding: 16,
    ...Shadows.card,
  },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeCircle: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  routeRole: { fontSize: 10, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  routeName: { fontSize: 12, color: Colors.textPrimary, fontWeight: '700', maxWidth: 90, marginTop: 1 },
  routeConnector: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  routeLine: { width: 14, height: 1.5, backgroundColor: Colors.border },

  chipsRow: { flexDirection: 'row', gap: 8 },

  timelineCard: {
    backgroundColor: Colors.white, borderRadius: 18, padding: 16, ...Shadows.card,
  },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.border, borderWidth: 2, borderColor: Colors.white,
  },
  timelineDotActive: {
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 5, elevation: 3,
  },
  timelineConnector: { width: 2, flex: 1, backgroundColor: Colors.border, minHeight: 18 },
  timelineContent: { flex: 1, paddingBottom: 2 },
  timelineStatus: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  timelineNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },

  // Recent searches
  section: { marginHorizontal: 16, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  recentList: { backgroundColor: Colors.white, borderRadius: 18, overflow: 'hidden', ...Shadows.card },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  recentIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  recentCode: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.8 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 28, gap: 12 },
  emptyIllustration: { marginBottom: 4 },
  emptyOuterRing: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: Colors.primaryLight + '60',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyInnerRing: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  tipsCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    width: '100%', gap: 10, ...Shadows.sm,
  },
  tipsTitle: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  tipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  exampleBox: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 4, width: '100%',
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  exampleLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  exampleCode: { fontSize: 20, fontWeight: '900', color: Colors.primary, letterSpacing: 2.5 },
});
