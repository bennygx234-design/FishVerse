import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../utils/theme';
import { mockBiteWindows } from '../data/mockData';

const { width } = Dimensions.get('window');

export default function BiteWindowScreen({ navigation }) {
  const [selectedWindow, setSelectedWindow] = useState(mockBiteWindows[0]);
  const pulseAnimation = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for active window
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress animation
    Animated.timing(progressAnimation, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();
  }, []);

  const pulseScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const pulseOpacity = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#1A2235']} style={styles.gradient}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>BiteWindow</Text>
            <Text style={styles.subtitle}>
              AI-powered 30-minute feeding predictions
            </Text>
          </View>

          {/* Current Window Status */}
          <Animated.View
            style={[
              styles.activeWindowCard,
              {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeWindowGradient}
            >
              <View style={styles.activeWindowHeader}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>WINDOW ACTIVE</Text>
                </View>
                <View style={styles.nftBadge}>
                  <MaterialCommunityIcons
                    name="check-decagram"
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.nftBadgeText}>NFT Eligible</Text>
                </View>
              </View>

              <Text style={styles.activeWindowTime}>6:15 - 6:45 AM</Text>
              <Text style={styles.activeWindowRemaining}>
                18 minutes remaining
              </Text>

              <View style={styles.activeWindowMeter}>
                <View style={styles.meterBackground}>
                  <Animated.View
                    style={[
                      styles.meterFill,
                      {
                        width: progressAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '95%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.meterLabel}>95% Catch Probability</Text>
              </View>

              <View style={styles.activeSpecies}>
                {['Largemouth Bass', 'Crappie'].map((species, index) => (
                  <View key={index} style={styles.speciesTag}>
                    <MaterialCommunityIcons
                      name="fish"
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.speciesTagText}>{species}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Conditions Card */}
          <View style={styles.conditionsCard}>
            <LinearGradient
              colors={['#1E2942', '#243049']}
              style={styles.conditionsGradient}
            >
              <Text style={styles.conditionsTitle}>Current Conditions</Text>
              <View style={styles.conditionsGrid}>
                <ConditionItem
                  icon="weather-partly-cloudy"
                  label="Weather"
                  value="Partly Cloudy"
                  status="good"
                />
                <ConditionItem
                  icon="thermometer"
                  label="Air Temp"
                  value="68°F"
                  status="optimal"
                />
                <ConditionItem
                  icon="water-thermometer"
                  label="Water Temp"
                  value="65°F"
                  status="optimal"
                />
                <ConditionItem
                  icon="gauge"
                  label="Pressure"
                  value="30.15 inHg"
                  status="good"
                />
                <ConditionItem
                  icon="moon-waning-crescent"
                  label="Moon Phase"
                  value="Waxing Crescent"
                  status="good"
                />
                <ConditionItem
                  icon="sun-clock"
                  label="Solunar"
                  value="Major Period"
                  status="optimal"
                />
              </View>
            </LinearGradient>
          </View>

          {/* Upcoming Windows */}
          <Text style={styles.sectionTitle}>Today's Windows</Text>
          {mockBiteWindows.map((window, index) => (
            <TouchableOpacity
              key={window.id}
              style={styles.windowCard}
              onPress={() => setSelectedWindow(window)}
            >
              <LinearGradient
                colors={['#1E2942', '#243049']}
                style={styles.windowGradient}
              >
                <View style={styles.windowHeader}>
                  <View style={styles.windowTimeContainer}>
                    <Ionicons
                      name="time"
                      size={20}
                      color={
                        index === 0
                          ? colors.success
                          : index === 1
                          ? colors.warning
                          : colors.textSecondary
                      }
                    />
                    <Text style={styles.windowTime}>{window.time}</Text>
                  </View>
                  <View style={styles.ratingContainer}>
                    <Text
                      style={[
                        styles.ratingValue,
                        {
                          color:
                            window.rating >= 90
                              ? colors.success
                              : window.rating >= 70
                              ? colors.warning
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {window.rating}%
                    </Text>
                  </View>
                </View>

                <View style={styles.windowMeter}>
                  <View
                    style={[
                      styles.windowMeterFill,
                      {
                        width: `${window.rating}%`,
                        backgroundColor:
                          window.rating >= 90
                            ? colors.success
                            : window.rating >= 70
                            ? colors.warning
                            : colors.textMuted,
                      },
                    ]}
                  />
                </View>

                <View style={styles.windowDetails}>
                  <View style={styles.windowSpecies}>
                    {window.species.map((species, idx) => (
                      <Text key={idx} style={styles.windowSpeciesText}>
                        {species}
                        {idx < window.species.length - 1 ? ', ' : ''}
                      </Text>
                    ))}
                  </View>
                  <Text style={styles.windowConditions}>{window.conditions}</Text>
                </View>

                <View style={styles.windowMoon}>
                  <MaterialCommunityIcons
                    name="moon-waning-crescent"
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text style={styles.windowMoonText}>{window.moon}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}

          {/* Data Sources */}
          <View style={styles.sourcesCard}>
            <Text style={styles.sourcesTitle}>Data Sources</Text>
            <View style={styles.sourcesGrid}>
              <View style={styles.sourceItem}>
                <View style={styles.sourceIcon}>
                  <MaterialCommunityIcons
                    name="weather-cloudy"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.sourceText}>NOAA Weather</Text>
              </View>
              <View style={styles.sourceItem}>
                <View style={styles.sourceIcon}>
                  <MaterialCommunityIcons
                    name="water"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.sourceText}>USGS Water</Text>
              </View>
              <View style={styles.sourceItem}>
                <View style={styles.sourceIcon}>
                  <MaterialCommunityIcons
                    name="moon-full"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.sourceText}>Solunar Tables</Text>
              </View>
              <View style={styles.sourceItem}>
                <View style={styles.sourceIcon}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.sourceText}>Pod Reports</Text>
              </View>
            </View>
          </View>

          {/* Watch Sync */}
          <TouchableOpacity style={styles.watchCard}>
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.watchGradient}
            >
              <MaterialCommunityIcons
                name="watch"
                size={32}
                color="#fff"
              />
              <View style={styles.watchInfo}>
                <Text style={styles.watchTitle}>Sync to Watch</Text>
                <Text style={styles.watchDesc}>
                  Get push alerts for bite windows
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const ConditionItem = ({ icon, label, value, status }) => {
  const statusColor =
    status === 'optimal'
      ? colors.success
      : status === 'good'
      ? colors.warning
      : colors.textMuted;

  return (
    <View style={styles.conditionItem}>
      <MaterialCommunityIcons name={icon} size={24} color={statusColor} />
      <Text style={styles.conditionLabel}>{label}</Text>
      <Text style={styles.conditionValue}>{value}</Text>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
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
  activeWindowCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  activeWindowGradient: {
    padding: spacing.lg,
  },
  activeWindowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: spacing.xs,
  },
  liveText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#fff',
  },
  nftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  nftBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: spacing.xs,
  },
  activeWindowTime: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: spacing.md,
  },
  activeWindowRemaining: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.8)',
  },
  activeWindowMeter: {
    marginTop: spacing.lg,
  },
  meterBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: borderRadius.full,
  },
  meterLabel: {
    fontSize: fontSize.sm,
    color: '#fff',
    marginTop: spacing.sm,
    fontWeight: 'bold',
  },
  activeSpecies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  speciesTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  speciesTagText: {
    fontSize: fontSize.sm,
    color: '#fff',
    marginLeft: spacing.xs,
  },
  conditionsCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  conditionsGradient: {
    padding: spacing.md,
  },
  conditionsTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  conditionItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  conditionLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  conditionValue: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  windowCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  windowGradient: {
    padding: spacing.md,
  },
  windowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  windowTime: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  ratingContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  ratingValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  windowMeter: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  windowMeterFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  windowDetails: {
    marginTop: spacing.md,
  },
  windowSpecies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  windowSpeciesText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  windowConditions: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  windowMoon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  windowMoonText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  sourcesCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  sourcesTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sourceItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  watchCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  watchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  watchInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  watchTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  watchDesc: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
});
