import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image,
  useColorScheme, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');

// ── Fluent 2 ProgressRing geometry ──────────────────────────────────────────
const RING_SIZE   = 48;
const RING_STROKE = 2.5;
const RING_R      = (RING_SIZE - RING_STROKE) / 2;
const RING_C      = 2 * Math.PI * RING_R;
const ARC_LEN     = RING_C * 0.26;           // ~26% arc, typical Fluent arc

// Progress bar width
const BAR_W = Math.min(SW * 0.55, 260);

const STATUS_MESSAGES = [
  'Connecting to network…',
  'Loading your profile…',
  'Preparing your dashboard…',
  'Almost there…',
];

export default function Index() {
  const { user, loading } = useAuth();
  const router           = useRouter();
  const isDark           = useColorScheme() === 'dark';

  const [msgIdx,   setMsgIdx]   = useState(0);
  const [slowConn, setSlowConn] = useState(false);

  // ── Shared animation values ────────────────────────────────────────────────
  const screenFade   = useSharedValue(0);
  const logoScale    = useSharedValue(0.68);
  const logoY        = useSharedValue(28);
  const logoOpacity  = useSharedValue(0);
  const orbProgress  = useSharedValue(0);
  const glowPulse    = useSharedValue(1);
  const spinRot      = useSharedValue(0);
  const spinOpacity  = useSharedValue(0);
  const textSlideY   = useSharedValue(18);
  const textOpacity  = useSharedValue(0);
  const pillOpacity  = useSharedValue(0);
  const msgOpacity   = useSharedValue(0);
  const barX         = useSharedValue(-BAR_W);
  const barOpacity   = useSharedValue(0);

  // ── Entrance sequence ──────────────────────────────────────────────────────
  useEffect(() => {
    // Screen fade-in
    screenFade.value = withTiming(1, { duration: 280 });

    // Background orbs bloom
    orbProgress.value = withTiming(1, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });

    // Logo spring pop — Fluent spring: damping 14, stiffness 120
    logoScale.value   = withDelay(180, withSpring(1,   { damping: 14, stiffness: 120, mass: 0.8 }));
    logoY.value       = withDelay(180, withSpring(0,   { damping: 14, stiffness: 120, mass: 0.8 }));
    logoOpacity.value = withDelay(180, withTiming(1,   { duration: 420 }));

    // Glow halo pulse
    glowPulse.value = withDelay(400, withRepeat(
      withSequence(
        withTiming(1.22, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    ));

    // Brand text slides up
    textOpacity.value = withDelay(440, withTiming(1, { duration: 480 }));
    textSlideY.value  = withDelay(440, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));
    pillOpacity.value = withDelay(680, withTiming(1, { duration: 400 }));

    // Fluent ProgressRing appears and rotates
    spinOpacity.value = withDelay(720, withTiming(1, { duration: 440 }));
    spinRot.value     = withDelay(720, withRepeat(
      withTiming(360, { duration: 1050, easing: Easing.linear }),
      -1,
    ));

    // Indeterminate progress bar sweeps
    barOpacity.value  = withDelay(820, withTiming(1, { duration: 400 }));
    barX.value        = withDelay(820, withRepeat(
      withTiming(BAR_W * 1.5, { duration: 1550, easing: Easing.inOut(Easing.cubic) }),
      -1,
    ));

    // Status message fades in
    msgOpacity.value = withDelay(900, withTiming(1, { duration: 380 }));

    // Message rotation (crossfade handled in separate effect)
    const msgTimer = setInterval(() => {
      setMsgIdx(i => (i + 1) % STATUS_MESSAGES.length);
    }, 2300);

    // Slow-connection fallback after 9 s
    const slowTimer = setTimeout(() => setSlowConn(true), 9000);

    return () => { clearInterval(msgTimer); clearTimeout(slowTimer); };
  }, []);

  // Message crossfade on change
  useEffect(() => {
    if (msgIdx === 0) return;
    msgOpacity.value = withSequence(
      withTiming(0,   { duration: 180 }),
      withTiming(1,   { duration: 320 }),
    );
  }, [msgIdx]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user)                    router.replace('/(auth)/login');
    else if (user.role === 'admin')   router.replace('/admin' as any);
    else if (user.role === 'courier') router.replace('/(courier)/dashboard');
    else                          router.replace('/(user)/home');
  }, [loading, user]);

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const bg        = isDark ? '#011827' : '#0082B8';
  const orb1Clr   = isDark ? '#0D3D60' : '#38C4F5';
  const orb2Clr   = isDark ? '#004466' : '#0097CC';
  const cardBg    = isDark ? '#0F2940' : '#FFFFFF';
  const cardBdr   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
  const glowClr   = isDark ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.18)';
  const iconTint  = isDark ? Colors.primaryMid : undefined;

  // ── Animated styles ────────────────────────────────────────────────────────
  const masterStyle = useAnimatedStyle(() => ({ opacity: screenFade.value }));

  const orb1Style = useAnimatedStyle(() => ({
    opacity:   interpolate(orbProgress.value, [0, 1], [0, isDark ? 0.45 : 0.32]),
    transform: [{ scale: orbProgress.value }],
  }));
  const orb2Style = useAnimatedStyle(() => ({
    opacity:   interpolate(orbProgress.value, [0, 1], [0, isDark ? 0.30 : 0.22]),
    transform: [{ scale: orbProgress.value }],
  }));

  const logoWrapStyle = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }, { translateY: logoY.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowPulse.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity:   textOpacity.value,
    transform: [{ translateY: textSlideY.value }],
  }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value }));

  const spinStyle = useAnimatedStyle(() => ({
    opacity:   spinOpacity.value,
    transform: [{ rotate: `${spinRot.value}deg` }],
  }));

  const barWrapStyle = useAnimatedStyle(() => ({ opacity: barOpacity.value }));
  const barFillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: barX.value }],
  }));

  const msgStyle = useAnimatedStyle(() => ({
    opacity:   msgOpacity.value,
    transform: [{ translateY: interpolate(msgOpacity.value, [0, 1], [6, 0]) }],
  }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: bg }, masterStyle]}>

      {/* ── Background depth orbs (Fluent layered surface depth) ── */}
      <Animated.View style={[styles.orb1, { backgroundColor: orb1Clr }, orb1Style]} />
      <Animated.View style={[styles.orb2, { backgroundColor: orb2Clr }, orb2Style]} />

      {/* ── Center: logo + brand text ──────────────────────────── */}
      <View style={styles.centerArea}>

        {/* Logo container with glow halo */}
        <Animated.View style={[styles.logoWrap, logoWrapStyle]}>
          {/* Outer glow halo — pulses */}
          <Animated.View style={[styles.glowHalo, { backgroundColor: glowClr }, glowStyle]} />

          {/* Elevated logo card (Fluent surface elevation 4) */}
          <View style={[
            styles.logoCard,
            { backgroundColor: cardBg, borderColor: cardBdr },
            isDark && styles.logoCardDark,
          ]}>
            <Image
              source={require('../assets/images/icon.png')}
              style={[styles.logoIcon, iconTint ? { tintColor: iconTint } : {}]}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Brand name + tagline */}
        <Animated.View style={[styles.brandBlock, textStyle]}>
          <Text style={styles.brandName}>Parcela</Text>
          <Text style={styles.tagline}>Rwanda's Parcel Network</Text>
        </Animated.View>

        {/* Micro brand pill */}
        <Animated.View style={[styles.pillWrap, pillStyle]}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>FAST · SECURE · DELIVERED</Text>
          </View>
        </Animated.View>

      </View>

      {/* ── Bottom: progress ring + bar + status ───────────────── */}
      <View style={styles.bottomArea}>

        {/* Fluent ProgressRing */}
        <Animated.View style={spinStyle}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          >
            {/* Track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Active arc */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke="rgba(255,255,255,0.94)"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${ARC_LEN} ${RING_C - ARC_LEN}`}
              strokeLinecap="round"
              transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
            />
          </Svg>
        </Animated.View>

        {/* Fluent indeterminate progress bar */}
        <Animated.View style={[styles.barTrack, barWrapStyle]}>
          <Animated.View style={[styles.barFill, barFillStyle]} />
        </Animated.View>

        {/* Rotating status message */}
        <Animated.Text style={[styles.statusText, msgStyle]}>
          {STATUS_MESSAGES[msgIdx]}
        </Animated.Text>

        {/* Slow-connection fallback */}
        {slowConn && (
          <Text style={styles.slowText}>
            This is taking longer than usual.{'\n'}Please check your connection.
          </Text>
        )}

      </View>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 96,
    paddingBottom: 64,
    overflow: 'hidden',
  },

  // Background depth orbs
  orb1: {
    position: 'absolute',
    width: SW * 1.5,
    height: SW * 1.5,
    borderRadius: SW * 0.75,
    top: -SW * 0.72,
    right: -SW * 0.52,
  },
  orb2: {
    position: 'absolute',
    width: SW * 1.3,
    height: SW * 1.3,
    borderRadius: SW * 0.65,
    bottom: -SW * 0.7,
    left: -SW * 0.45,
  },

  // Center area
  centerArea: {
    alignItems: 'center',
    gap: 28,
  },

  // Logo
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
  },
  logoCard: {
    width: 128,
    height: 128,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // Fluent elevation 4 — layered shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.30,
    shadowRadius: 32,
    elevation: 20,
  },
  logoCardDark: {
    shadowColor: Colors.primaryMid,
    shadowOpacity: 0.20,
    shadowRadius: 28,
    elevation: 12,
  },
  logoIcon: { width: 90, height: 90 },

  // Brand text
  brandBlock: { alignItems: 'center', gap: 6 },
  brandName: {
    fontSize: 50,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // Brand pill
  pillWrap: { alignItems: 'center' },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 2.0,
  },

  // Bottom
  bottomArea: {
    alignItems: 'center',
    gap: 14,
  },

  // Indeterminate progress bar
  barTrack: {
    width: BAR_W,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    left: -BAR_W * 0.55,
    top: 0,
    width: BAR_W * 0.55,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
    // Subtle glow on the bar
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },

  // Status text
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.15,
    textAlign: 'center',
  },

  // Slow connection
  slowText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
