import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, getRarityColor } from '../utils/theme';
import { mockTrophies, userStats } from '../data/mockData';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#1A2235']}
        style={styles.gradient}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.username}>Captain Angler</Text>
            </View>
            <TouchableOpacity style={styles.profileButton}>
              <LinearGradient
                colors={colors.gradientPrimary}
                style={styles.profileGradient}
              >
                <Ionicons name="person" size={24} color={colors.background} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statsContainer}
          >
            <StatCard
              icon="fish"
              label="Total Catches"
              value={userStats.totalCatches}
              color={colors.primary}
            />
            <StatCard
              icon="diamond-stone"
              label="NFTs Owned"
              value={userStats.totalNFTs}
              color={colors.secondary}
            />
            <StatCard
              icon="star"
              label="Genesis Trophies"
              value={userStats.genesisCount}
              color={colors.gold}
            />
            <StatCard
              icon="leaf"
              label="Conservation"
              value={userStats.conservationContributed}
              color={colors.success}
            />
          </ScrollView>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionButton
              icon="camera"
              label="New Catch"
              colors={colors.gradientPrimary}
              onPress={() => navigation.navigate('Catch')}
            />
            <ActionButton
              icon="map"
              label="Join Pod"
              colors={colors.gradientSecondary}
              onPress={() => navigation.navigate('Pods')}
            />
            <ActionButton
              icon="pulse"
              label="Bite Window"
              colors={['#FF7F50', '#FF6347']}
              onPress={() => navigation.navigate('BiteWindow')}
            />
            <ActionButton
              icon="eye"
              label="Ghost Lure"
              colors={colors.gradientPurple}
              onPress={() => navigation.navigate('GhostLure')}
            />
          </View>

          {/* Trophy Gallery */}
          <View style={styles.trophyHeader}>
            <Text style={styles.sectionTitle}>Your Trophy Wall</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trophyScroll}
          >
            {mockTrophies.map((trophy) => (
              <TrophyCard key={trophy.id} trophy={trophy} />
            ))}
          </ScrollView>

          {/* Next Bite Window */}
          <View style={styles.biteWindowCard}>
            <LinearGradient
              colors={['#1E2942', '#243049']}
              style={styles.biteWindowGradient}
            >
              <View style={styles.biteWindowHeader}>
                <MaterialCommunityIcons
                  name="clock-alert"
                  size={24}
                  color={colors.warning}
                />
                <Text style={styles.biteWindowTitle}>Next Prime Window</Text>
              </View>
              <Text style={styles.biteWindowTime}>6:15 AM - 6:45 AM</Text>
              <View style={styles.biteWindowMeter}>
                <View style={[styles.biteWindowFill, { width: '95%' }]} />
              </View>
              <Text style={styles.biteWindowDesc}>
                95% catch probability - Largemouth Bass, Crappie
              </Text>
            </LinearGradient>
          </View>

          {/* Token Balance */}
          <TouchableOpacity style={styles.tokenCard}>
            <LinearGradient
              colors={colors.gradientGold}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tokenGradient}
            >
              <MaterialCommunityIcons
                name="ethereum"
                size={32}
                color={colors.background}
              />
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenLabel}>FishVerse Tokens</Text>
                <Text style={styles.tokenValue}>{userStats.tokens} FVT</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color={colors.background}
              />
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const StatCard = ({ icon, label, value, color }) => (
  <View style={styles.statCard}>
    <MaterialCommunityIcons name={icon} size={28} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionButton = ({ icon, label, colors: gradientColors, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <LinearGradient colors={gradientColors} style={styles.actionGradient}>
      <Ionicons name={icon} size={28} color="#fff" />
    </LinearGradient>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const TrophyCard = ({ trophy }) => (
  <TouchableOpacity style={styles.trophyCard}>
    <Image source={{ uri: trophy.image }} style={styles.trophyImage} />
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.9)']}
      style={styles.trophyOverlay}
    >
      <View
        style={[
          styles.rarityBadge,
          { backgroundColor: getRarityColor(trophy.rarity) },
        ]}
      >
        <Text style={styles.rarityText}>{trophy.rarity}</Text>
      </View>
      <Text style={styles.trophySpecies}>{trophy.species}</Text>
      <Text style={styles.trophyWeight}>{trophy.weight}</Text>
      <View style={styles.trophyNft}>
        <MaterialCommunityIcons
          name="ethereum"
          size={14}
          color={colors.gold}
        />
        <Text style={styles.trophyValue}>{trophy.nftValue}</Text>
      </View>
    </LinearGradient>
    {trophy.arModel && (
      <View style={styles.arBadge}>
        <Ionicons name="cube" size={16} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  username: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  profileGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    paddingLeft: spacing.lg,
    marginVertical: spacing.md,
  },
  statCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    width: 120,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '22%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  trophyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },
  seeAll: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  trophyScroll: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
  },
  trophyCard: {
    width: CARD_WIDTH,
    height: 220,
    borderRadius: borderRadius.lg,
    marginRight: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.backgroundCard,
  },
  trophyImage: {
    width: '100%',
    height: '100%',
  },
  trophyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  rarityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  rarityText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  trophySpecies: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  trophyWeight: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  trophyNft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  trophyValue: {
    fontSize: fontSize.sm,
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  arBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  biteWindowCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  biteWindowGradient: {
    padding: spacing.md,
  },
  biteWindowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  biteWindowTitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  biteWindowTime: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.sm,
  },
  biteWindowMeter: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  biteWindowFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
  },
  biteWindowDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  tokenCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  tokenGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  tokenInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tokenLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(0,0,0,0.6)',
  },
  tokenValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.background,
  },
});
