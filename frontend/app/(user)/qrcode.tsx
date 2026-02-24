import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants/Colors';

export default function QRCodeScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{
    parcelId: string;
    qrData: string;
    trackingCode: string;
    recipientName: string;
    destinationLocker: string;
    pickupCode: string;
  }>();

  const qrValue = params.qrData || params.trackingCode || 'AKABATI-INVALID';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Your Akabati parcel is ready!\nTracking: ${params.trackingCode}\nPickup Code: ${params.pickupCode}\nLocation: ${params.destinationLocker}`,
        title: 'Akabati Parcel Pickup',
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="close-qr" onPress={() => router.replace('/(user)/home')}>
            <Ionicons name="close" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('your_qr_code')}</Text>
          <TouchableOpacity testID="share-btn" onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Success Badge */}
        <View style={styles.successBadge}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>{t('parcel_sent')}</Text>
          <Text style={styles.successSub}>Show this QR at the locker to drop off</Text>
        </View>

        {/* QR Code */}
        <View style={styles.qrCard}>
          <View style={styles.qrWrap}>
            <QRCode
              value={qrValue}
              size={200}
              backgroundColor="white"
              color={Colors.textPrimary}
            />
          </View>
          <Text style={styles.pickupLabel}>{t('pickup_code')}</Text>
          <View style={styles.pickupCodeWrap}>
            <Text testID="pickup-code" style={styles.pickupCode}>{params.pickupCode || '------'}</Text>
          </View>
          <Text style={styles.trackingLabel}>Tracking: <Text style={styles.trackingValue}>{params.trackingCode}</Text></Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow icon="person" label="Recipient" value={params.recipientName} />
          <View style={styles.divider} />
          <DetailRow icon="location" label="Destination" value={params.destinationLocker} />
          <View style={styles.divider} />
          <DetailRow icon="cube" label="Parcel ID" value={params.parcelId?.slice(-8)} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 How to drop off</Text>
          {['Go to the origin locker', 'Scan this QR code', 'Place parcel inside', 'Lock the compartment'].map((step, i) => (
            <View key={i} style={styles.instructionRow}>
              <View style={styles.instructionNum}>
                <Text style={styles.instructionNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity testID="share-parcel-btn" style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={Colors.white} />
          <Text style={styles.shareBtnText}>{t('share_code')}</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="done-btn" style={styles.doneBtn} onPress={() => router.replace('/(user)/home')}>
          <Text style={styles.doneBtnText}>{t('done')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: any) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  successBadge: { alignItems: 'center', marginBottom: 20 },
  successIcon: { fontSize: 48, marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  successSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  qrCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  qrWrap: {
    padding: 16, backgroundColor: Colors.white,
    borderRadius: 16, borderWidth: 2, borderColor: Colors.border, marginBottom: 20,
  },
  pickupLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  pickupCodeWrap: {
    backgroundColor: Colors.primaryLight, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 10, marginBottom: 12,
  },
  pickupCode: { fontSize: 28, fontWeight: '900', color: Colors.primaryDark, letterSpacing: 4 },
  trackingLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  trackingValue: { fontWeight: '700', color: Colors.textPrimary },
  detailsCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 4, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 44 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  detailValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },
  instructionsCard: {
    backgroundColor: Colors.yellowLight, borderRadius: 16, padding: 16, marginBottom: 20,
  },
  instructionsTitle: { fontSize: 14, fontWeight: '700', color: Colors.yellowDark, marginBottom: 12 },
  instructionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  instructionNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  instructionNumText: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary },
  instructionText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  shareBtn: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', height: 56, borderRadius: 14, gap: 10, marginBottom: 12,
  },
  shareBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  doneBtn: {
    height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  doneBtnText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
});
