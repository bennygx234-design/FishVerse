import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../utils/theme';
import { mockGhostLures } from '../data/mockData';

const { width, height } = Dimensions.get('window');

export default function GhostLureScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isARMode, setIsARMode] = useState(false);
  const [selectedLure, setSelectedLure] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const lureAnimation = useRef(new Animated.Value(0)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow animation for AR elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const playGhostReplay = (lure) => {
    setSelectedLure(lure);
    setIsPlaying(true);

    // Simulate lure movement animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(lureAnimation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(lureAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    setTimeout(() => setIsPlaying(false), 10000);
  };

  if (!permission?.granted && isARMode) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0A0E1A', '#1A2235']} style={styles.gradient}>
          <View style={styles.permissionContainer}>
            <MaterialCommunityIcons
              name="camera-off"
              size={80}
              color={colors.textSecondary}
            />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>
              Ghost Lure AR needs camera access to overlay retrieve patterns on
              the water
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
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (isARMode && permission?.granted) {
    const translateX = lureAnimation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, width * 0.3, 0],
    });

    const translateY = lureAnimation.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [0, 50, 100, 50, 0],
    });

    const glowOpacity = glowAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.8],
    });

    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing="back">
          {/* Header */}
          <View style={styles.arHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setIsARMode(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.arBadge}>
              <View style={styles.arIndicator} />
              <Text style={styles.arText}>AR ACTIVE</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* AR Overlay */}
          <View style={styles.arOverlay}>
            {/* Water surface line */}
            <View style={styles.waterLine}>
              <Animated.View
                style={[styles.waterGlow, { opacity: glowOpacity }]}
              />
            </View>

            {/* Ghost lure visualization */}
            {isPlaying && selectedLure && (
              <Animated.View
                style={[
                  styles.ghostLure,
                  {
                    transform: [{ translateX }, { translateY }],
                  },
                ]}
              >
                <Animated.View
                  style={[styles.lureGlow, { opacity: glowOpacity }]}
                />
                <MaterialCommunityIcons
                  name="hook"
                  size={32}
                  color={colors.primary}
                />
              </Animated.View>
            )}

            {/* Depth indicator */}
            <View style={styles.depthIndicator}>
              <Text style={styles.depthLabel}>Depth</Text>
              <View style={styles.depthBar}>
                <View style={styles.depthFill} />
                <Text style={styles.depthValue}>
                  {selectedLure?.depth || '8-12 ft'}
                </Text>
              </View>
            </View>

            {/* Retrieve info */}
            {selectedLure && (
              <View style={styles.retrieveInfo}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
                  style={styles.retrieveGradient}
                >
                  <Text style={styles.retrieveTitle}>{selectedLure.lure}</Text>
                  <View style={styles.retrieveDetails}>
                    <View style={styles.retrieveItem}>
                      <MaterialCommunityIcons
                        name="speedometer"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.retrieveText}>
                        {selectedLure.speed}
                      </Text>
                    </View>
                    <View style={styles.retrieveItem}>
                      <MaterialCommunityIcons
                        name="gesture-swipe"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.retrieveText}>
                        {selectedLure.rodMotion}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.successRate}>
                    <Text style={styles.successLabel}>
                      {selectedLure.catches} catches in last 7 days
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Controls */}
          <View style={styles.arControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <LinearGradient
                colors={isPlaying ? ['#EF4444', '#DC2626'] : colors.gradientPrimary}
                style={styles.controlGradient}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={28}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.controlText}>
              {isPlaying ? 'Pause Replay' : 'Play Ghost Lure'}
            </Text>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#1A2235']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ghost Lure</Text>
          <Text style={styles.subtitle}>
            See exactly how trophy fish were caught at this spot
          </Text>
        </View>

        {/* AR Mode Button */}
        <TouchableOpacity
          style={styles.arModeCard}
          onPress={() => setIsARMode(true)}
        >
          <LinearGradient
            colors={colors.gradientPurple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.arModeGradient}
          >
            <View style={styles.arModeIcon}>
              <MaterialCommunityIcons name="cube-scan" size={48} color="#fff" />
            </View>
            <View style={styles.arModeInfo}>
              <Text style={styles.arModeTitle}>Launch AR Mode</Text>
              <Text style={styles.arModeDesc}>
                Point at the water to see ghost retrieve patterns
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Available Ghost Replays */}
        <Text style={styles.sectionTitle}>
          Available Replays at This Location
        </Text>
        <ScrollView style={styles.luresList}>
          {mockGhostLures.map((lure) => (
            <TouchableOpacity
              key={lure.id}
              style={styles.lureCard}
              onPress={() => {
                setSelectedLure(lure);
                setIsARMode(true);
              }}
            >
              <LinearGradient
                colors={['#1E2942', '#243049']}
                style={styles.lureGradient}
              >
                <View style={styles.lureHeader}>
                  <View style={styles.lureIconContainer}>
                    <MaterialCommunityIcons
                      name="hook"
                      size={28}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.lureInfo}>
                    <Text style={styles.lureName}>{lure.lure}</Text>
                    <View style={styles.lureMeta}>
                      <Text style={styles.lureMetaText}>
                        Depth: {lure.depth}
                      </Text>
                      <Text style={styles.lureMetaText}>|</Text>
                      <Text style={styles.lureMetaText}>{lure.speed}</Text>
                    </View>
                  </View>
                  <View style={styles.lurePriceTag}>
                    <MaterialCommunityIcons
                      name="coin"
                      size={14}
                      color={colors.gold}
                    />
                    <Text style={styles.lurePrice}>{lure.price}</Text>
                  </View>
                </View>

                <View style={styles.lureStats}>
                  <View style={styles.lureStatItem}>
                    <Ionicons name="fish" size={16} color={colors.success} />
                    <Text style={styles.lureStatText}>
                      {lure.catches} catches
                    </Text>
                  </View>
                  <View style={styles.lureStatItem}>
                    <Ionicons name="time" size={16} color={colors.textSecondary} />
                    <Text style={styles.lureStatText}>{lure.lastCatch}</Text>
                  </View>
                </View>

                <View style={styles.rodMotionPreview}>
                  <MaterialCommunityIcons
                    name="gesture-swipe"
                    size={16}
                    color={colors.textMuted}
                  />
                  <Text style={styles.rodMotionText}>{lure.rodMotion}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}

          {/* Info Card */}
          <View style={styles.infoCard}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.1)', 'rgba(99, 102, 241, 0.05)']}
              style={styles.infoGradient}
            >
              <Ionicons name="information-circle" size={24} color={colors.secondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>How Ghost Lure Works</Text>
                <Text style={styles.infoText}>
                  Ghost replays are recorded from successful catches. The AR
                  overlay shows the exact lure path, depth, and rod motion that
                  landed the fish. Replays are consumable - once purchased,
                  you get 3 views.
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  arModeCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  arModeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  arModeIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arModeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  arModeTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  arModeDesc: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  luresList: {
    paddingHorizontal: spacing.lg,
  },
  lureCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  lureGradient: {
    padding: spacing.md,
  },
  lureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lureInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  lureName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  lureMeta: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  lureMetaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  lurePriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  lurePrice: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  lureStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  lureStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  lureStatText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  rodMotionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  rodMotionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  infoCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  infoGradient: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  // AR Mode styles
  arHeader: {
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
  arBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  arIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purple,
    marginRight: spacing.sm,
  },
  arText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.purple,
  },
  arOverlay: {
    flex: 1,
    position: 'relative',
  },
  waterLine: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 212, 170, 0.5)',
  },
  waterGlow: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
  },
  ghostLure: {
    position: 'absolute',
    top: '40%',
    left: '30%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lureGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 212, 170, 0.3)',
  },
  depthIndicator: {
    position: 'absolute',
    right: spacing.lg,
    top: '40%',
    alignItems: 'flex-end',
  },
  depthLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  depthBar: {
    width: 8,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginTop: spacing.xs,
    position: 'relative',
  },
  depthFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  depthValue: {
    position: 'absolute',
    top: '40%',
    right: 12,
    fontSize: fontSize.xs,
    color: colors.text,
    width: 60,
    textAlign: 'right',
  },
  retrieveInfo: {
    position: 'absolute',
    bottom: 120,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  retrieveGradient: {
    padding: spacing.md,
  },
  retrieveTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  retrieveDetails: {
    marginTop: spacing.sm,
  },
  retrieveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  retrieveText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  successRate: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  successLabel: {
    fontSize: fontSize.sm,
    color: colors.success,
  },
  arControls: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  controlButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  controlGradient: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
