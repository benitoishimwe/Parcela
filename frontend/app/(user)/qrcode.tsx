import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors, Shadows } from '../../constants/Colors';

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

  const qrValue = params.qrData || params.trackingCode || 'PARCELA-INVALID';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Your Parcela parcel is ready!\nTracking: ${params.trackingCode}\nPickup Code: ${params.pickupCode}\nLocation: ${params.destinationLocker}`,
        title: 'Parcela Parcel Pickup',
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="close-qr" style={styles.headerBtn} onPress={() => router.replace('/(user)/home')}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('your_qr_code')}</Text>
          <TouchableOpacity testID="share-btn" style={styles.headerBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Success Banner */}
        <View style={styles.successBanner}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIconEmoji}>✅</Text>
          </View>
          <View style={styles.successText}>
            <Text style={styles.successTitle}>{t('parcel_sent')}</Text>
            <Text style={styles.successSub}>Show this QR at the locker to drop off your parcel</Text>
          </View>
        </View>

        {/* QR Card */}
        <View style={styles.qrCard}>
          <View style={styles.qrBadge}>
            <Ionicons name="qr-code" size={14} color={Colors.primary} />
            <Text style={styles.qrBadgeText}>Drop-off QR Code</Text>
          </View>

          <View style={styles.qrFrame}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <QRCode
              value={qrValue}
              size={188}
              backgroundColor="white"
              color={Colors.textPrimary}
            />
          </View>

          <Text style={styles.scanHint}>Scan at the locker terminal</Text>

          {/* Pickup Code */}
          <View style={styles.pickupCodeSection}>
            <Text style={styles.pickupCodeLabel}>Pickup Code</Text>
            <View style={styles.pickupCodeBox}>
              <Text testID="pickup-code" style={styles.pickupCode}>{params.pickupCode || '------'}</Text>
            </View>
            <Text style={styles.pickupCodeHint}>Alternative to QR — share with recipient</Text>
          </View>

          {/* Tracking */}
          <View style={styles.trackingRow}>
            <Ionicons name="barcode-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.trackingLabel}>Tracking:</Text>
            <Text testID="tracking-code-display" style={styles.trackingValue}>{params.trackingCode}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow icon="person-outline" label="Recipient" value={params.recipientName} />
          <View style={styles.cardDivider} />
          <DetailRow icon="location-outline" label="Destination Locker" value={params.destinationLocker} />
          <View style={styles.cardDivider} />
          <DetailRow icon="cube-outline" label="Parcel ID" value={`…${params.parcelId?.slice(-8)}`} />
        </View>

        {/* How to drop off */}
        <View style={styles.stepsCard}>
          <View style={styles.stepsHeader}>
            <Ionicons name="list-circle-outline" size={18} color={Colors.yellowDark} />
            <Text style={styles.stepsTitle}>How to drop off</Text>
          </View>
          {[
            { icon: 'navigate-outline', text: 'Go to the origin locker location' },
            { icon: 'qr-code-outline', text: 'Scan this QR code on the terminal' },
            { icon: 'archive-outline', text: 'Place parcel inside the compartment' },
            { icon: 'lock-closed-outline', text: 'Close and lock the compartment' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Ionicons name={step.icon as any} size={16} color={Colors.textSecondary} />
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity testID="share-parcel-btn" style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={Colors.white} />
          <Text style={styles.shareBtnText}>{t('share_code')}</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="done-btn" style={styles.doneBtn} onPress={() => router.replace('/(user)/home')}>
          <Text style={styles.doneBtnText}>{t('done')}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: any; label: string; value: string | undefined }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const CORNER_SIZE = 20;
const CORNER_THICK = 3;
const CORNER_COLOR = Colors.primary;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.greenLight, borderRadius: 18, padding: 16, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: Colors.green,
  },
  successIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
  },
  successIconEmoji: { fontSize: 26 },
  successText: { flex: 1 },
  successTitle: { fontSize: 16, fontWeight: '800', color: Colors.greenDark },
  successSub: { fontSize: 12, color: Colors.green, marginTop: 2, lineHeight: 17 },

  qrCard: {
    backgroundColor: Colors.white, borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 14,
    ...Shadows.large,
  },
  qrBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 20,
  },
  qrBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark },
  qrFrame: {
    padding: 16, position: 'relative',
    borderRadius: 4, marginBottom: 12,
  },
  // Corner decorations
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderTopLeftRadius: 4, borderColor: CORNER_COLOR },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderTopRightRadius: 4, borderColor: CORNER_COLOR },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderBottomLeftRadius: 4, borderColor: CORNER_COLOR },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: 4, borderColor: CORNER_COLOR },
  scanHint: { fontSize: 12, color: Colors.textTertiary, marginBottom: 20, fontWeight: '500' },

  pickupCodeSection: { alignItems: 'center', marginBottom: 16, width: '100%' },
  pickupCodeLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  pickupCodeBox: {
    backgroundColor: Colors.primaryLight, borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 12, width: '100%', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  pickupCode: { fontSize: 32, fontWeight: '900', color: Colors.primaryDark, letterSpacing: 6 },
  pickupCodeHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 8, textAlign: 'center' },

  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackingLabel: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  trackingValue: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary },

  detailsCard: {
    backgroundColor: Colors.white, borderRadius: 18, marginBottom: 14, overflow: 'hidden',
    ...Shadows.card,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  cardDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 54 },
  detailIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },

  stepsCard: {
    backgroundColor: Colors.yellowLight, borderRadius: 18, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  stepsTitle: { fontSize: 14, fontWeight: '800', color: Colors.yellowDark },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.yellow, alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '900', color: Colors.textPrimary },
  stepText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500', flex: 1 },

  shareBtn: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', height: 56, borderRadius: 16, gap: 10, marginBottom: 12,
    ...Shadows.primary,
  },
  shareBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  doneBtn: {
    height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  doneBtnText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
});
