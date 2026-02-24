import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

const SIZES = [
  { key: 'small', icon: '📮', label: 'Small', labelRw: 'Gito', dims: '< 20cm', price: 1000 },
  { key: 'medium', icon: '📦', label: 'Medium', labelRw: 'Hagati', dims: '20-40cm', price: 2000 },
  { key: 'large', icon: '🗃️', label: 'Large', labelRw: 'Kinini', dims: '40-60cm', price: 3500 },
];

const PAYMENT_METHODS = [
  { key: 'mtn_momo', label: 'MTN MoMo', icon: '💛', color: '#FFCC00' },
  { key: 'airtel_money', label: 'Airtel Money', icon: '❤️', color: '#FF0000' },
];

export default function Send() {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  // Step 1: Sender
  const [senderName, setSenderName] = useState(user?.name || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');
  // Step 2: Recipient
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  // Step 3: Size
  const [selectedSize, setSelectedSize] = useState('');
  // Step 4: Lockers
  const [lockers, setLockers] = useState<any[]>([]);
  const [originLocker, setOriginLocker] = useState<any>(null);
  const [destLocker, setDestLocker] = useState<any>(null);
  const [lockersLoading, setLockersLoading] = useState(false);
  // Step 5: Payment
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [paymentPhone, setPaymentPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [createdParcel, setCreatedParcel] = useState<any>(null);

  useEffect(() => {
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
    if (step === 1 && (!senderName.trim() || !senderPhone.trim())) {
      Alert.alert(t('error'), 'Enter sender name and phone'); return;
    }
    if (step === 2 && (!recipientName.trim() || !recipientPhone.trim())) {
      Alert.alert(t('error'), 'Enter recipient name and phone'); return;
    }
    if (step === 3 && !selectedSize) {
      Alert.alert(t('error'), 'Select a parcel size'); return;
    }
    if (step === 4 && (!originLocker || !destLocker)) {
      Alert.alert(t('error'), 'Select both origin and destination lockers'); return;
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const parcel = await api.post('/api/parcels', {
        sender_name: senderName, sender_phone: senderPhone,
        recipient_name: recipientName, recipient_phone: recipientPhone,
        recipient_email: recipientEmail || undefined,
        origin_locker_id: originLocker.locker_id,
        destination_locker_id: destLocker.locker_id,
        size: selectedSize, payment_method: paymentMethod,
      }, token || undefined);

      // Process payment
      const paid = await api.post(`/api/parcels/${parcel.parcel_id}/payment`, {
        payment_method: paymentMethod, phone_number: paymentPhone,
      }, token || undefined);

      setCreatedParcel(paid);
      router.push({
        pathname: '/(user)/qrcode',
        params: {
          parcelId: paid.parcel_id,
          qrData: paid.qr_data,
          trackingCode: paid.tracking_code,
          recipientName: paid.recipient_name,
          destinationLocker: paid.destination_locker_name,
          pickupCode: paid.qr_code,
        },
      });
    } catch (err: any) {
      Alert.alert(t('error'), err.message || 'Failed to send parcel');
    } finally {
      setSubmitting(false);
    }
  };

  const currentSize = SIZES.find(s => s.key === selectedSize);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          {step > 1 ? (
            <TouchableOpacity testID="back-step" onPress={() => setStep(s => s - 1)}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity testID="cancel-send" onPress={() => router.back()}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{t('send_parcel')}</Text>
          <Text style={styles.stepIndicator}>{step}/{TOTAL_STEPS}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* STEP 1: SENDER */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📤 {t('sender_details')}</Text>
              <InputField label={t('name')} value={senderName} onChangeText={setSenderName} placeholder="Your name" testID="sender-name" />
              <InputField label={t('phone')} value={senderPhone} onChangeText={setSenderPhone} placeholder="+250 7XX XXX XXX" keyboardType="phone-pad" testID="sender-phone" />
            </View>
          )}

          {/* STEP 2: RECIPIENT */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📥 {t('recipient_details')}</Text>
              <InputField label={t('name')} value={recipientName} onChangeText={setRecipientName} placeholder="Recipient name" testID="recipient-name" />
              <InputField label={t('phone')} value={recipientPhone} onChangeText={setRecipientPhone} placeholder="+250 7XX XXX XXX" keyboardType="phone-pad" testID="recipient-phone" />
              <InputField label={t('email')} value={recipientEmail} onChangeText={setRecipientEmail} placeholder="email@example.com" keyboardType="email-address" testID="recipient-email" />
            </View>
          )}

          {/* STEP 3: SIZE */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📐 {t('parcel_size')}</Text>
              {SIZES.map(size => (
                <TouchableOpacity
                  key={size.key}
                  testID={`size-${size.key}`}
                  style={[styles.sizeCard, selectedSize === size.key && styles.sizeCardSelected]}
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
                  {selectedSize === size.key && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* STEP 4: LOCKER SELECTION */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>📍 {t('choose_locker')}</Text>
              {lockersLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
              ) : (
                <>
                  <Text style={styles.lockerSectionLabel}>Origin Locker (Drop-off)</Text>
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
                  <View style={styles.divider} />
                  <Text style={styles.lockerSectionLabel}>Destination Locker (Delivery)</Text>
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
                </>
              )}
            </View>
          )}

          {/* STEP 5: PAYMENT */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>💳 {t('payment')}</Text>

              {/* Summary */}
              <View style={styles.summaryCard}>
                <SummaryRow label="From" value={originLocker?.name} />
                <SummaryRow label="To" value={destLocker?.name} />
                <SummaryRow label="Size" value={SIZES.find(s => s.key === selectedSize)?.label} />
                <SummaryRow label="Recipient" value={`${recipientName} (${recipientPhone})`} />
                <View style={styles.summaryDivider} />
                <SummaryRow label="Total" value={`${currentSize?.price?.toLocaleString()} RWF`} bold />
              </View>

              <Text style={styles.lockerSectionLabel}>{t('payment_method')}</Text>
              {PAYMENT_METHODS.map(pm => (
                <TouchableOpacity
                  key={pm.key}
                  testID={`payment-${pm.key}`}
                  style={[styles.paymentCard, paymentMethod === pm.key && styles.paymentCardSelected]}
                  onPress={() => setPaymentMethod(pm.key)}
                >
                  <Text style={styles.paymentIcon}>{pm.icon}</Text>
                  <Text style={styles.paymentLabel}>{pm.label}</Text>
                  {paymentMethod === pm.key && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                </TouchableOpacity>
              ))}

              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>{t('payment_phone')}</Text>
                <TextInput
                  testID="payment-phone"
                  style={styles.input}
                  value={paymentPhone}
                  onChangeText={setPaymentPhone}
                  placeholder="+250 7XX XXX XXX"
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              <View style={styles.noteBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
                <Text style={styles.noteText}>{t('payment_note')}</Text>
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          {step < TOTAL_STEPS ? (
            <TouchableOpacity testID="next-step" style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>{t('continue_btn')}</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="pay-submit"
              style={[styles.nextBtn, { backgroundColor: Colors.green }, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={Colors.white} /> : (
                <>
                  <Text style={styles.nextBtnText}>{t('pay_now')}</Text>
                  <Text style={styles.nextBtnText}> · {currentSize?.price?.toLocaleString()} RWF</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputField({ label, value, onChangeText, placeholder, keyboardType, testID }: any) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType || 'default'}
        placeholderTextColor={Colors.textTertiary}
      />
    </View>
  );
}

function LockerItem({ locker, selected, size, onSelect, disabled, testID }: any) {
  const availKey = `available_${size}`;
  const avail = locker[availKey] || 0;
  const hasSpace = avail > 0;
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.lockerItem, selected && styles.lockerItemSelected, (disabled || !hasSpace) && styles.lockerItemDisabled]}
      onPress={!disabled && hasSpace ? onSelect : undefined}
    >
      <View style={styles.lockerItemLeft}>
        <Text style={styles.lockerItemName}>{locker.name}</Text>
        <Text style={styles.lockerItemAddr}>{locker.district}</Text>
      </View>
      <View style={[styles.availBadge, { backgroundColor: hasSpace ? Colors.greenLight : '#FEE2E2' }]}>
        <Text style={[styles.availText, { color: hasSpace ? Colors.green : Colors.error }]}>
          {avail} free
        </Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} style={{ marginLeft: 6 }} />}
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value, bold }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontWeight: '800', color: Colors.primary, fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  stepIndicator: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600', backgroundColor: Colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  progressBar: { height: 4, backgroundColor: Colors.border, marginHorizontal: 20, borderRadius: 2, marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  content: { flex: 1, paddingHorizontal: 20 },
  stepContent: { paddingTop: 16 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },
  inputWrap: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, height: 52,
    fontSize: 16, color: Colors.textPrimary,
  },
  sizeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: Colors.border,
  },
  sizeCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  sizeIcon: { fontSize: 32, marginRight: 14 },
  sizeInfo: { flex: 1 },
  sizeName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  sizeNameSelected: { color: Colors.primaryDark },
  sizeDims: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sizePriceBadge: { backgroundColor: Colors.background, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  sizePriceBadgeSelected: { backgroundColor: Colors.primary },
  sizePrice: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  sizePriceSelected: { color: Colors.white },
  lockerSectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, marginTop: 4 },
  lockerItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: Colors.border,
  },
  lockerItemSelected: { borderColor: Colors.primary },
  lockerItemDisabled: { opacity: 0.5 },
  lockerItemLeft: { flex: 1 },
  lockerItemName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  lockerItemAddr: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  availBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  availText: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: Colors.border, gap: 12,
  },
  paymentCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  noteBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.yellowLight,
    borderRadius: 10, padding: 12, gap: 8, marginTop: 8,
  },
  noteText: { flex: 1, fontSize: 12, color: Colors.yellowDark, fontWeight: '500' },
  bottomAction: {
    padding: 20, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  nextBtn: {
    backgroundColor: Colors.primary, height: 56, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextBtnText: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
