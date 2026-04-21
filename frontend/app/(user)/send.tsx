import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, Shadows } from '../../constants/Colors';
import { api } from '../../utils/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIZES = [
  { key: 'small',  icon: '📮', label: 'Small',  labelRw: 'Gito',   dims: '< 20cm',   price: 1000 },
  { key: 'medium', icon: '📦', label: 'Medium', labelRw: 'Hagati', dims: '20–40cm',  price: 2000 },
  { key: 'large',  icon: '🗃️', label: 'Large',  labelRw: 'Kinini', dims: '40–60cm',  price: 3500 },
];

const PAYMENT_METHODS = [
  { key: 'mtn_momo',     label: 'MTN MoMo',     icon: '💛', color: '#FFCC00' },
  { key: 'airtel_money', label: 'Airtel Money',  icon: '❤️', color: '#FF0000' },
];

type DeliveryModeKey = 'basic' | 'fast' | 'express';
const DELIVERY_MODES: { key: DeliveryModeKey; icon: string; name: string; desc: string; surcharge: number }[] = [
  { key: 'basic',   icon: '📦', name: 'Basic',   desc: '2–3 business days', surcharge: 0    },
  { key: 'fast',    icon: '⚡', name: 'Fast',    desc: '',                  surcharge: 1500 },
  { key: 'express', icon: '🚀', name: 'Express', desc: '30 min – 1 hour',   surcharge: 4500 },
];

const STEP_LABELS = ['Sender', 'Recipient', 'Size', 'Lockers', 'Speed', 'Payment'];
const TOTAL_STEPS = 6;

function getFastDesc() {
  return new Date().getHours() < 14 ? 'Today by 6pm' : 'Tomorrow morning';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatRwandanPhone(raw: string) {
  // Strip non-digits, limit to 9 digits for local number
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

// ─── Fluent Input ─────────────────────────────────────────────────────────────

interface FluentInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: any;
  testID?: string;
  helpText?: string;
  errorText?: string;
  showCountryCode?: boolean;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: any;
  validated?: boolean; // show green check when valid
}

function FluentInput({
  label, value, onChangeText, onBlur: onBlurProp, placeholder, keyboardType, testID,
  helpText, errorText, showCountryCode, multiline, maxLength,
  autoCapitalize, autoComplete, validated,
}: FluentInputProps) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    onBlurProp?.();
  };

  const animatedBorder = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.primary],
  });

  const hasError = !!errorText;
  const isValid = validated && value.length > 0 && !hasError;
  const borderColor = hasError ? Colors.error : isValid ? Colors.green : animatedBorder;

  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <Animated.View style={[fi.container, { borderColor }, focused && fi.containerFocused]}>
        {showCountryCode && (
          <View style={fi.countryBadge}>
            <Text style={fi.countryFlag}>🇷🇼</Text>
            <Text style={fi.countryCode}>+250</Text>
            <View style={fi.countryDivider} />
          </View>
        )}
        <TextInput
          testID={testID}
          style={[fi.input, multiline && fi.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          keyboardType={keyboardType || 'default'}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoComplete={autoComplete}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {isValid && (
          <Animated.View style={{ opacity: focusAnim.interpolate({ inputRange: [0,1], outputRange: [1,1] }) }}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.green} style={fi.trailingIcon} />
          </Animated.View>
        )}
        {hasError && <Ionicons name="close-circle" size={18} color={Colors.error} style={fi.trailingIcon} />}
      </Animated.View>
      {hasError ? (
        <View style={fi.messageRow}>
          <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
          <Text style={fi.errorText}>{errorText}</Text>
        </View>
      ) : helpText ? (
        <View style={fi.messageRow}>
          <Ionicons name="information-circle-outline" size={12} color={Colors.textTertiary} />
          <Text style={fi.helpText}>{helpText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary,
    marginBottom: 8, letterSpacing: 0.2,
  },
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    minHeight: 52, overflow: 'hidden',
  },
  containerFocused: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  countryBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 6, height: '100%',
  },
  countryFlag: { fontSize: 16 },
  countryCode: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  countryDivider: { width: 1, height: 24, backgroundColor: Colors.border, marginLeft: 4 },
  input: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.textPrimary, fontWeight: '400',
  },
  inputMultiline: {
    paddingTop: 14, minHeight: 88,
  },
  trailingIcon: { marginRight: 14 },
  messageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
  },
  helpText: { fontSize: 12, color: Colors.textTertiary, flex: 1, lineHeight: 16 },
  errorText: { fontSize: 12, color: Colors.error, flex: 1, lineHeight: 16, fontWeight: '500' },
});

// ─── Step Progress ─────────────────────────────────────────────────────────────

function StepProgress({ step, total }: { step: number; total: number }) {
  const fillAnim = useRef(new Animated.Value((step - 1) / total)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: step / total,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={sp.container}>
      {/* Bar */}
      <View style={sp.track}>
        <Animated.View style={[sp.fill, { width: fillWidth }]} />
      </View>
      {/* Dots + labels */}
      <View style={sp.labels}>
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1;
          const done = idx < step;
          const current = idx === step;
          const future = idx > step;
          return (
            <View key={label} style={sp.labelItem}>
              <View style={[sp.dot, done && sp.dotDone, current && sp.dotCurrent, future && sp.dotFuture]}>
                {done
                  ? <Ionicons name="checkmark" size={8} color={Colors.white} />
                  : <Text style={[sp.dotText, current && sp.dotTextCurrent]}>{idx}</Text>
                }
              </View>
              <Text
                numberOfLines={1}
                style={[sp.labelText, done && sp.labelDone, current && sp.labelCurrent, future && sp.labelFuture]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 4 },
  track: { height: 3, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 10 },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  labelItem: { alignItems: 'center', flex: 1 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.border, marginBottom: 4,
  },
  dotDone: { backgroundColor: Colors.primary },
  dotCurrent: { backgroundColor: Colors.primary, ...Shadows.sm },
  dotFuture: { backgroundColor: Colors.border },
  dotText: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary },
  dotTextCurrent: { color: Colors.white },
  labelText: { fontSize: 9, fontWeight: '500', color: Colors.textTertiary, textAlign: 'center' },
  labelDone: { color: Colors.primary },
  labelCurrent: { color: Colors.primary, fontWeight: '700' },
  labelFuture: { color: Colors.textTertiary },
});

// ─── Locker Item ──────────────────────────────────────────────────────────────

function LockerItem({ locker, selected, size, onSelect, disabled, testID }: any) {
  const availKey = `available_${size}`;
  const avail = locker[availKey] || 0;
  const hasSpace = avail > 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled && hasSpace) {
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
    }
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  return (
    <Pressable
      testID={testID}
      onPress={!disabled && hasSpace ? onSelect : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{ color: Colors.primaryLight }}
    >
      <Animated.View style={[
        styles.lockerItem,
        selected && styles.lockerItemSelected,
        (disabled || !hasSpace) && styles.lockerItemDisabled,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        <View style={[styles.lockerIconWrap, selected && styles.lockerIconWrapSelected]}>
          <Ionicons name="lock-closed" size={16} color={selected ? Colors.white : Colors.textSecondary} />
        </View>
        <View style={styles.lockerItemLeft}>
          <Text style={[styles.lockerItemName, selected && { color: Colors.primary }]}>{locker.name}</Text>
          <Text style={styles.lockerItemAddr}>{locker.district}</Text>
        </View>
        <View style={[styles.availBadge, { backgroundColor: hasSpace ? Colors.greenLight : Colors.errorLight }]}>
          <Text style={[styles.availText, { color: hasSpace ? Colors.green : Colors.error }]}>
            {avail} free
          </Text>
        </View>
        {selected && (
          <Ionicons name="checkmark-circle" size={22} color={Colors.primary} style={{ marginLeft: 8 }} />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Selection Card (sizes / delivery modes / payment) ────────────────────────

function SelectionCard({ onPress, selected, children, testID }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      android_ripple={{ color: Colors.primaryLight }}
    >
      <Animated.View style={[
        styles.sizeCard,
        selected && styles.sizeCardSelected,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Summary Row ──────────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontWeight: '800', color: Colors.primary, fontSize: 16 }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Form Card wrapper ────────────────────────────────────────────────────────

function FormCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.formCard}>{children}</View>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Send() {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step transition animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateStep = useCallback((next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: next > step ? -20 : 20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(next > step ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  }, [step]);

  // Step 1: Sender
  const [senderName, setSenderName]   = useState(user?.name  || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');

  // Step 2: Recipient
  const [recipientName,  setRecipientName]  = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [clientNotes,    setClientNotes]    = useState('');
  const [emailTouched,   setEmailTouched]   = useState(false);

  // Step 3: Size
  const [selectedSize, setSelectedSize] = useState('');

  // Step 4: Lockers
  const [lockers,        setLockers]        = useState<any[]>([]);
  const [originLocker,   setOriginLocker]   = useState<any>(null);
  const [destLocker,     setDestLocker]     = useState<any>(null);
  const [lockersLoading, setLockersLoading] = useState(false);

  // Step 5: Delivery Mode
  const [deliveryMode, setDeliveryMode] = useState<DeliveryModeKey>('basic');

  // Step 6: Payment
  const [paymentMethod,     setPaymentMethod]     = useState('mtn_momo');
  const [paymentPhone,      setPaymentPhone]       = useState(user?.phone || '');
  const [submitting,        setSubmitting]         = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentConfirmed,  setPaymentConfirmed]  = useState(false);
  const [paymentStep,       setPaymentStep]        = useState<'initiating' | 'validating' | 'confirmed'>('initiating');
  const [stepError,         setStepError]          = useState('');

  useEffect(() => {
    setStepError('');
    if (step === 4 && lockers.length === 0) fetchLockers();
  }, [step]);

  const fetchLockers = async () => {
    setLockersLoading(true);
    try {
      const data = await api.get('/api/lockers');
      setLockers(data.filter((l: any) => l.status === 'active'));
    } catch {}
    setLockersLoading(false);
  };

  const handleNext = () => {
    setStepError('');
    if (step === 1 && (!senderName.trim() || !senderPhone.trim())) {
      setStepError('Please enter sender name and phone number'); return;
    }
    if (step === 2 && (!recipientName.trim() || !recipientPhone.trim())) {
      setStepError('Please enter recipient name and phone number'); return;
    }
    if (step === 3 && !selectedSize) {
      setStepError('Please select a parcel size'); return;
    }
    if (step === 4) {
      if (!originLocker) { setStepError('Please select an origin (drop-off) locker'); return; }
      if (!destLocker)   { setStepError('Please select a destination locker');         return; }
      if (originLocker.locker_id === destLocker.locker_id) {
        setStepError('Origin and destination lockers must be different'); return;
      }
    }
    animateStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) animateStep(step - 1);
    else router.back();
  };

  const handleSubmit = async () => {
    setStepError('');
    setSubmitting(true);
    try {
      const parcel = await api.post('/api/parcels', {
        sender_name: senderName, sender_phone: senderPhone,
        recipient_name: recipientName, recipient_phone: recipientPhone,
        recipient_email: recipientEmail || undefined,
        origin_locker_id: originLocker.locker_id,
        destination_locker_id: destLocker.locker_id,
        size: selectedSize, payment_method: paymentMethod,
        delivery_mode: deliveryMode,
        client_notes: clientNotes.trim() || undefined,
      }, token || undefined);

      setPaymentStep('initiating');
      setPaymentProcessing(true);

      const payResult = await api.post(`/api/parcels/${parcel.parcel_id}/payment`, {
        payment_method: paymentMethod, phone_number: paymentPhone,
      }, token || undefined);

      setPaymentStep('validating');
      let confirmedParcel = payResult;

      if (payResult.payment_status !== 'paid') {
        let attempts = 0;
        while (attempts < 20) {
          await new Promise<void>(r => setTimeout(r, 3000));
          const status = await api.get(
            `/api/parcels/${parcel.parcel_id}/payment-status`, token || undefined
          );
          if (status.payment_status === 'paid') {
            confirmedParcel = { ...payResult, payment_status: 'paid', status: status.parcel_status };
            break;
          }
          if (status.payment_status === 'failed') {
            throw new Error('Payment was declined. Please check your mobile money balance and try again.');
          }
          attempts++;
        }
        if (confirmedParcel.payment_status !== 'paid') {
          throw new Error('Payment confirmation timed out. Check your transaction history and contact support.');
        }
      }

      setPaymentProcessing(false);
      setPaymentStep('confirmed');
      setPaymentConfirmed(true);
      await new Promise<void>(r => setTimeout(r, 1200));

      router.push({
        pathname: '/(user)/qrcode',
        params: {
          parcelId: confirmedParcel.parcel_id,
          qrData: confirmedParcel.qr_data,
          trackingCode: confirmedParcel.tracking_code,
          recipientName: confirmedParcel.recipient_name,
          destinationLocker: confirmedParcel.destination_locker_name,
          pickupCode: confirmedParcel.qr_code,
        },
      });
    } catch (err: any) {
      setPaymentProcessing(false);
      setPaymentConfirmed(false);
      setStepError(err.message || 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSize      = SIZES.find(s => s.key === selectedSize);
  const deliverySurcharge = DELIVERY_MODES.find(m => m.key === deliveryMode)?.surcharge ?? 0;
  const computedTotal    = (currentSize?.price ?? 0) + deliverySurcharge;

  const emailError = emailTouched && recipientEmail.length > 0 && !isValidEmail(recipientEmail)
    ? 'Enter a valid email address'
    : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            testID={step > 1 ? 'back-step' : 'cancel-send'}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
            onPress={handleBack}
            android_ripple={{ color: Colors.border, radius: 20 }}
          >
            <Ionicons
              name={step > 1 ? 'arrow-back' : 'close'}
              size={22}
              color={Colors.textPrimary}
            />
          </Pressable>

          <Text style={styles.headerTitle}>{t('send_parcel')}</Text>

          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>{step}<Text style={styles.stepPillTotal}>/{TOTAL_STEPS}</Text></Text>
          </View>
        </View>

        {/* ── Progress with step labels ── */}
        <StepProgress step={step} total={TOTAL_STEPS} />

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>

            {/* ── STEP 1: SENDER ── */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepEmoji}>📤</Text>
                  <View>
                    <Text style={styles.stepTitle}>{t('sender_details')}</Text>
                    <Text style={styles.stepSubtitle}>Your contact information</Text>
                  </View>
                </View>
                <FormCard>
                  <FluentInput
                    label={t('name')}
                    value={senderName}
                    onChangeText={setSenderName}
                    placeholder="Your full name"
                    testID="sender-name"
                    autoCapitalize="words"
                    validated
                  />
                  <FluentInput
                    label={t('phone')}
                    value={senderPhone}
                    onChangeText={v => setSenderPhone(formatRwandanPhone(v))}
                    placeholder="7XX XXX XXX"
                    keyboardType="phone-pad"
                    testID="sender-phone"
                    showCountryCode
                    helpText="Enter your MTN or Airtel Rwanda number"
                    autoCapitalize="none"
                    validated
                  />
                </FormCard>
              </View>
            )}

            {/* ── STEP 2: RECIPIENT ── */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepEmoji}>📥</Text>
                  <View>
                    <Text style={styles.stepTitle}>{t('recipient_details')}</Text>
                    <Text style={styles.stepSubtitle}>Who will receive this parcel?</Text>
                  </View>
                </View>
                <FormCard>
                  <FluentInput
                    label={t('name')}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder="Recipient's full name"
                    testID="recipient-name"
                    autoCapitalize="words"
                    validated
                  />
                  <FluentInput
                    label={t('phone')}
                    value={recipientPhone}
                    onChangeText={v => setRecipientPhone(formatRwandanPhone(v))}
                    placeholder="7XX XXX XXX"
                    keyboardType="phone-pad"
                    testID="recipient-phone"
                    showCountryCode
                    helpText="We'll send pickup notifications to this number"
                    autoCapitalize="none"
                    validated
                  />
                  <FluentInput
                    label={`${t('email')} (optional)`}
                    value={recipientEmail}
                    onChangeText={setRecipientEmail}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    testID="recipient-email"
                    helpText="Email confirmation will be sent when parcel is ready"
                    errorText={emailError}
                    autoCapitalize="none"
                    autoComplete="email"
                    validated={isValidEmail(recipientEmail)}
                  />
                  <View style={fi.wrap}>
                    <Text style={fi.label}>Note for courier / recipient (optional)</Text>
                    <Animated.View style={[fi.container, { minHeight: 96 }]}>
                      <TextInput
                        testID="client-notes"
                        style={[fi.input, fi.inputMultiline]}
                        value={clientNotes}
                        onChangeText={v => setClientNotes(v.slice(0, 250))}
                        placeholder="e.g. Fragile, leave at door, call on arrival…"
                        placeholderTextColor={Colors.textTertiary}
                        multiline
                        numberOfLines={3}
                        maxLength={250}
                        textAlignVertical="top"
                      />
                    </Animated.View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <View style={fi.messageRow}>
                        <Ionicons name="information-circle-outline" size={12} color={Colors.textTertiary} />
                        <Text style={fi.helpText}>Visible to your courier</Text>
                      </View>
                      <Text style={[fi.helpText, { textAlign: 'right' }]}>{clientNotes.length}/250</Text>
                    </View>
                  </View>
                </FormCard>
              </View>
            )}

            {/* ── STEP 3: SIZE ── */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepEmoji}>📐</Text>
                  <View>
                    <Text style={styles.stepTitle}>{t('parcel_size')}</Text>
                    <Text style={styles.stepSubtitle}>Choose the size that fits your parcel</Text>
                  </View>
                </View>
                {SIZES.map(size => (
                  <SelectionCard
                    key={size.key}
                    testID={`size-${size.key}`}
                    selected={selectedSize === size.key}
                    onPress={() => setSelectedSize(size.key)}
                  >
                    <Text style={styles.sizeIcon}>{size.icon}</Text>
                    <View style={styles.sizeInfo}>
                      <Text style={[styles.sizeName, selectedSize === size.key && styles.sizeNameSelected]}>
                        {language === 'rw' ? size.labelRw : size.label}
                      </Text>
                      <Text style={styles.sizeDims}>{size.dims}</Text>
                    </View>
                    <View style={[styles.sizePriceBadge, selectedSize === size.key && styles.sizePriceBadgeSelected]}>
                      <Text style={[styles.sizePrice, selectedSize === size.key && styles.sizePriceSelected]}>
                        {size.price.toLocaleString()} RWF
                      </Text>
                    </View>
                    {selectedSize === size.key && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.primary} style={{ marginLeft: 8 }} />
                    )}
                  </SelectionCard>
                ))}
              </View>
            )}

            {/* ── STEP 4: LOCKER SELECTION ── */}
            {step === 4 && (
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepEmoji}>📍</Text>
                  <View>
                    <Text style={styles.stepTitle}>{t('choose_locker')}</Text>
                    <Text style={styles.stepSubtitle}>Select drop-off and delivery lockers</Text>
                  </View>
                </View>
                {lockersLoading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                    <Text style={styles.loadingText}>Finding available lockers…</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.lockerSection}>
                      <View style={styles.lockerSectionHeader}>
                        <View style={[styles.lockerSectionDot, { backgroundColor: Colors.primary }]} />
                        <Text style={styles.lockerSectionLabel}>Origin Locker (Drop-off)</Text>
                      </View>
                      {lockers.map(locker => (
                        <LockerItem
                          key={`origin-${locker.locker_id}`}
                          locker={locker}
                          selected={originLocker?.locker_id === locker.locker_id}
                          size={selectedSize}
                          onSelect={() => setOriginLocker(locker)}
                          testID={`origin-locker-${locker.locker_id}`}
                        />
                      ))}
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.lockerSection}>
                      <View style={styles.lockerSectionHeader}>
                        <View style={[styles.lockerSectionDot, { backgroundColor: Colors.green }]} />
                        <Text style={styles.lockerSectionLabel}>Destination Locker (Delivery)</Text>
                      </View>
                      {lockers.map(locker => (
                        <LockerItem
                          key={`dest-${locker.locker_id}`}
                          locker={locker}
                          selected={destLocker?.locker_id === locker.locker_id}
                          size={selectedSize}
                          onSelect={() => setDestLocker(locker)}
                          disabled={originLocker?.locker_id === locker.locker_id}
                          testID={`dest-locker-${locker.locker_id}`}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ── STEP 5: DELIVERY MODE ── */}
            {step === 5 && (
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepEmoji}>🚚</Text>
                  <View>
                    <Text style={styles.stepTitle}>Delivery Speed</Text>
                    <Text style={styles.stepSubtitle}>How fast do you need it delivered?</Text>
                  </View>
                </View>
                {DELIVERY_MODES.map(mode => {
                  const desc  = mode.key === 'fast' ? getFastDesc() : mode.desc;
                  const total = (currentSize?.price ?? 0) + mode.surcharge;
                  const sel   = deliveryMode === mode.key;
                  return (
                    <SelectionCard
                      key={mode.key}
                      testID={`delivery-mode-${mode.key}`}
                      selected={sel}
                      onPress={() => setDeliveryMode(mode.key)}
                    >
                      <Text style={styles.sizeIcon}>{mode.icon}</Text>
                      <View style={styles.sizeInfo}>
                        <Text style={[styles.sizeName, sel && styles.sizeNameSelected]}>{mode.name}</Text>
                        <Text style={styles.sizeDims}>{desc}</Text>
                      </View>
                      <View style={[styles.sizePriceBadge, sel && styles.sizePriceBadgeSelected]}>
                        <Text style={[styles.sizePrice, sel && styles.sizePriceSelected]}>
                          {total.toLocaleString()} RWF
                        </Text>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} style={{ marginLeft: 8 }} />}
                    </SelectionCard>
                  );
                })}
                <View style={styles.noteBox}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
                  <Text style={styles.noteText}>
                    Fast orders placed after 2pm are delivered the next morning. Express requires a courier nearby.
                  </Text>
                </View>
              </View>
            )}

            {/* ── STEP 6: PAYMENT ── */}
            {step === 6 && (
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepEmoji}>💳</Text>
                  <View>
                    <Text style={styles.stepTitle}>{t('payment')}</Text>
                    <Text style={styles.stepSubtitle}>Review and complete your order</Text>
                  </View>
                </View>

                {/* Summary card */}
                <View style={styles.summaryCard}>
                  <SummaryRow label="From"      value={originLocker?.name} />
                  <SummaryRow label="To"        value={destLocker?.name} />
                  <SummaryRow label="Size"      value={`${currentSize?.label} — ${currentSize?.price?.toLocaleString()} RWF`} />
                  <SummaryRow label="Delivery"  value={`${deliveryMode.charAt(0).toUpperCase() + deliveryMode.slice(1)}${deliverySurcharge > 0 ? ` +${deliverySurcharge.toLocaleString()}` : ''}`} />
                  <SummaryRow label="Recipient" value={`${recipientName} (${recipientPhone})`} />
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="Total"     value={`${computedTotal.toLocaleString()} RWF`} bold />
                </View>

                <Text style={styles.lockerSectionLabel}>{t('payment_method')}</Text>
                {PAYMENT_METHODS.map(pm => (
                  <SelectionCard
                    key={pm.key}
                    testID={`payment-${pm.key}`}
                    selected={paymentMethod === pm.key}
                    onPress={() => setPaymentMethod(pm.key)}
                  >
                    <Text style={styles.paymentIcon}>{pm.icon}</Text>
                    <Text style={styles.paymentLabel}>{pm.label}</Text>
                    {paymentMethod === pm.key && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </SelectionCard>
                ))}

                <FormCard>
                  <FluentInput
                    label={t('payment_phone')}
                    value={paymentPhone}
                    onChangeText={v => setPaymentPhone(formatRwandanPhone(v))}
                    placeholder="7XX XXX XXX"
                    keyboardType="phone-pad"
                    testID="payment-phone"
                    showCountryCode
                    helpText="This number will receive the payment prompt"
                    autoCapitalize="none"
                    validated
                  />
                </FormCard>

                <View style={styles.noteBox}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
                  <Text style={styles.noteText}>{t('payment_note')}</Text>
                </View>
              </View>
            )}

          </Animated.View>
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* ── Bottom Action ── */}
        <View style={styles.bottomAction}>
          {stepError ? (
            <View style={styles.stepErrorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.stepErrorText}>{stepError}</Text>
            </View>
          ) : null}

          {step < TOTAL_STEPS ? (
            <Pressable
              testID="next-step"
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
              onPress={handleNext}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            >
              <Text style={styles.nextBtnText}>{t('continue_btn')}</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </Pressable>
          ) : (
            <Pressable
              testID="pay-submit"
              style={({ pressed }) => [
                styles.nextBtn,
                { backgroundColor: Colors.green },
                pressed && styles.nextBtnPressed,
                submitting && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color={Colors.white} />
                  <Text style={styles.nextBtnText}>{t('pay_now')} · {computedTotal.toLocaleString()} RWF</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* ── Payment Processing Modal ── */}
        <Modal visible={paymentProcessing || paymentConfirmed} transparent animationType="fade">
          <View style={styles.paymentOverlay}>
            <View style={styles.paymentOverlayCard}>
              {paymentProcessing && (
                <>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.paymentOverlayTitle}>
                    {paymentStep === 'initiating' ? 'Initiating payment…' : 'Validating payment…'}
                  </Text>
                  <Text style={styles.paymentOverlaySub}>
                    {paymentStep === 'validating'
                      ? 'Checking with your mobile money provider…'
                      : 'Please wait, do not close this screen'}
                  </Text>
                </>
              )}
              {paymentConfirmed && (
                <>
                  <View style={styles.paymentSuccessIcon}>
                    <Ionicons name="checkmark-circle" size={56} color={Colors.green} />
                  </View>
                  <Text style={styles.paymentOverlayTitle}>Payment Confirmed!</Text>
                  <Text style={styles.paymentOverlaySub}>
                    Your parcel has been registered. Notifying courier & admin…
                  </Text>
                </>
              )}
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  flex:  { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBtnPressed: { backgroundColor: Colors.surfaceElevated },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  stepPill: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    minWidth: 48, alignItems: 'center',
  },
  stepPillText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  stepPillTotal: { fontWeight: '500', color: Colors.primaryDark },

  // Content
  content: { flex: 1 },
  stepContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Step header (emoji + title + subtitle)
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  stepEmoji: { fontSize: 32, marginTop: 2 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5, lineHeight: 28 },
  stepSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },

  // Form card
  formCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 20, paddingBottom: 4,
    ...Shadows.card,
    marginBottom: 4,
  },

  // Selection cards (size / delivery / payment)
  sizeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadows.sm,
  },
  sizeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  sizeIcon:         { fontSize: 32, marginRight: 14 },
  sizeInfo:         { flex: 1 },
  sizeName:         { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sizeNameSelected: { color: Colors.primaryDark },
  sizeDims:         { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sizePriceBadge: {
    backgroundColor: Colors.surfaceElevated, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  sizePriceBadgeSelected: { backgroundColor: Colors.primary },
  sizePrice:         { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  sizePriceSelected: { color: Colors.white },

  // Locker items
  lockerSection:       { marginBottom: 4 },
  lockerSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  lockerSectionDot:    { width: 8, height: 8, borderRadius: 4 },
  lockerSectionLabel:  { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.2 },
  lockerItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadows.sm,
  },
  lockerItemSelected:  { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  lockerItemDisabled:  { opacity: 0.45 },
  lockerIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  lockerIconWrapSelected: { backgroundColor: Colors.primary },
  lockerItemLeft:    { flex: 1 },
  lockerItemName:    { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  lockerItemAddr:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  availBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  availText:         { fontSize: 12, fontWeight: '700' },
  divider:           { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

  // Loading state
  loadingWrap:  { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText:  { fontSize: 14, color: Colors.textSecondary },

  // Summary card (payment)
  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 18, marginBottom: 20,
    ...Shadows.card,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },

  // Payment method cards
  paymentIcon:  { fontSize: 24 },
  paymentLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginLeft: 12 },

  // Info note box
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.warningLight,
    borderRadius: 12, padding: 14, gap: 10, marginTop: 8,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  noteText: { flex: 1, fontSize: 12, color: Colors.yellowDark, fontWeight: '500', lineHeight: 17 },

  // Bottom action bar
  bottomAction: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 4 : 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    ...Shadows.medium,
  },
  stepErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorLight, borderRadius: 10, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  stepErrorText: { flex: 1, color: Colors.error, fontSize: 13, fontWeight: '500' },
  nextBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    ...Shadows.primary,
  },
  nextBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  nextBtnText: { color: Colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.6 },

  // Payment overlay modal
  paymentOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  paymentOverlayCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 32,
    alignItems: 'center', gap: 14, width: '100%', maxWidth: 340,
    ...Shadows.large,
  },
  paymentOverlayTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  paymentOverlaySub: {
    color: Colors.textSecondary, fontSize: 13, fontWeight: '400',
    textAlign: 'center', lineHeight: 19,
  },
  paymentSuccessIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.greenLight,
    alignItems: 'center', justifyContent: 'center',
  },
});
