import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../utils/theme';

const { width, height } = Dimensions.get('window');

export default function CatchScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isScanning, setIsScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);

  const scanAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for the capture button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const startAIScan = () => {
    setIsScanning(true);

    // Animate the scanning line
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Simulate AI analysis
    setTimeout(() => {
      setIsScanning(false);
      setAnalysisData({
        species: 'Largemouth Bass',
        confidence: 97.3,
        length: '22.4 inches',
        weight: '6.8 lbs (estimated)',
        weather: 'Partly Cloudy, 68°F',
        waterTemp: '65°F',
        barometric: '30.15 inHg',
        moonPhase: 'Waxing Crescent',
        location: 'Lake Fork, TX',
        coordinates: '32.8998°N, 97.0403°W',
        biteWindow: 'ACTIVE - Prime conditions!',
        nftEligible: true,
        rarity: 'Epic',
        estimatedValue: '0.45 ETH',
      });
      setShowResult(true);
    }, 3000);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <LinearGradient
          colors={['#0A0E1A', '#1A2235']}
          style={styles.gradient}
        >
          <MaterialCommunityIcons
            name="camera-off"
            size={80}
            color={colors.textSecondary}
          />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            FishVerse needs camera access to capture your catches and create
            Proof-of-Catch NFTs
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <LinearGradient
              colors={colors.gradientPrimary}
              style={styles.permissionButtonGradient}
            >
              <Text style={styles.permissionButtonText}>Grant Access</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  const scanLineTranslateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * 0.5],
  });

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.liveBadge}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>AI ACTIVE</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Scanning Frame */}
        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {isScanning && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslateY }] },
                ]}
              >
                <LinearGradient
                  colors={['transparent', colors.primary, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scanLineGradient}
                />
              </Animated.View>
            )}
          </View>

          <Text style={styles.frameText}>
            {isScanning ? 'Analyzing catch...' : 'Position fish in frame'}
          </Text>
        </View>

        {/* Info Panel */}
        <View style={styles.infoPanel}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={styles.infoText}>Lake Fork, TX</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="thermometer" size={16} color={colors.warning} />
              <Text style={styles.infoText}>68°F</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons
                name="weather-partly-cloudy"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.infoText}>Partly Cloudy</Text>
            </View>
          </View>
          <View style={styles.biteWindowBanner}>
            <MaterialCommunityIcons
              name="clock-check"
              size={18}
              color={colors.success}
            />
            <Text style={styles.biteWindowText}>
              IN BITE WINDOW - NFT Eligible!
            </Text>
          </View>
        </View>

        {/* Capture Button */}
        <View style={styles.captureContainer}>
          <Animated.View
            style={[
              styles.captureButtonOuter,
              { transform: [{ scale: pulseAnimation }] },
            ]}
          >
            <TouchableOpacity
              style={styles.captureButton}
              onPress={startAIScan}
              disabled={isScanning}
            >
              <LinearGradient
                colors={isScanning ? ['#666', '#444'] : colors.gradientPrimary}
                style={styles.captureButtonGradient}
              >
                {isScanning ? (
                  <MaterialCommunityIcons
                    name="loading"
                    size={32}
                    color="#fff"
                  />
                ) : (
                  <Ionicons name="fish" size={32} color="#fff" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.captureText}>
            {isScanning ? 'Processing...' : 'Capture Catch'}
          </Text>
        </View>
      </CameraView>

      {/* Analysis Result Modal */}
      <Modal visible={showResult} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#0A0E1A', '#1A2235']}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>
                <Text style={styles.modalTitle}>Catch Verified!</Text>
                <Text style={styles.modalSubtitle}>AI Analysis Complete</Text>
              </View>

              <View style={styles.speciesCard}>
                <Text style={styles.speciesName}>{analysisData?.species}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {analysisData?.confidence}% Match
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <StatItem icon="ruler" label="Length" value={analysisData?.length} />
                <StatItem icon="scale" label="Weight" value={analysisData?.weight} />
                <StatItem icon="water" label="Water Temp" value={analysisData?.waterTemp} />
                <StatItem icon="speedometer" label="Pressure" value={analysisData?.barometric} />
                <StatItem icon="moon-waning-crescent" label="Moon" value={analysisData?.moonPhase} />
                <StatItem icon="map-marker" label="Location" value={analysisData?.location} />
              </View>

              {analysisData?.nftEligible && (
                <View style={styles.nftSection}>
                  <LinearGradient
                    colors={colors.gradientGold}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.nftCard}
                  >
                    <MaterialCommunityIcons
                      name="ethereum"
                      size={32}
                      color={colors.background}
                    />
                    <View style={styles.nftInfo}>
                      <Text style={styles.nftLabel}>NFT Ready to Mint</Text>
                      <Text style={styles.nftRarity}>{analysisData?.rarity} Rarity</Text>
                      <Text style={styles.nftValue}>Est. Value: {analysisData?.estimatedValue}</Text>
                    </View>
                  </LinearGradient>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.mintButton}
                  onPress={() => {
                    setShowResult(false);
                    // Navigate to minting flow
                  }}
                >
                  <LinearGradient
                    colors={colors.gradientPrimary}
                    style={styles.mintButtonGradient}
                  >
                    <MaterialCommunityIcons
                      name="cube-send"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.mintButtonText}>Mint Trophy NFT</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => setShowResult(false)}
                >
                  <Text style={styles.skipButtonText}>Skip for Now</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const StatItem = ({ icon, label, value }) => (
  <View style={styles.statItem}>
    <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  permissionButton: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  permissionButtonText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  liveText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.success,
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: width * 0.85,
    height: height * 0.45,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
  },
  scanLineGradient: {
    flex: 1,
  },
  frameText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  infoPanel: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  biteWindowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  biteWindowText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.success,
    marginLeft: spacing.sm,
  },
  captureContainer: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: spacing.lg,
  },
  captureButtonOuter: {
    borderRadius: borderRadius.full,
    padding: 4,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  captureButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  speciesCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  speciesName: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  confidenceBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  confidenceText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  statItem: {
    width: '33.33%',
    padding: spacing.xs,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  nftSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  nftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  nftInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nftLabel: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.background,
  },
  nftRarity: {
    fontSize: fontSize.sm,
    color: 'rgba(0,0,0,0.7)',
  },
  nftValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.background,
  },
  modalButtons: {
    gap: spacing.md,
  },
  mintButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  mintButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  mintButtonText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipButtonText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
