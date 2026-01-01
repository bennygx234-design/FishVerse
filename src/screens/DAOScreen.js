import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../utils/theme';
import { mockDAOSpecies } from '../data/mockData';

const { width } = Dimensions.get('window');

const mockProposals = [
  {
    id: '1',
    title: 'Increase Slot Limit for Largemouth Bass',
    description: 'Propose raising minimum slot limit from 14" to 15" on Lake Fork',
    author: 'BassMaster_Pro',
    status: 'active',
    votes: { for: 847, against: 234 },
    endsIn: '2 days',
    type: 'conservation',
  },
  {
    id: '2',
    title: 'Conservation Grant: Madison River Restoration',
    description: 'Allocate 5 ETH from treasury to river restoration efforts',
    author: 'FlyFishKing',
    status: 'active',
    votes: { for: 1203, against: 89 },
    endsIn: '5 days',
    type: 'funding',
  },
  {
    id: '3',
    title: 'Add Northern Pike to Hall of Species',
    description: 'Include Northern Pike as a tracked Genesis species',
    author: 'MuskieHunter',
    status: 'passed',
    votes: { for: 2341, against: 156 },
    endsIn: 'Passed',
    type: 'governance',
  },
];

export default function DAOScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('trophies');

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#1A2235']} style={styles.gradient}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Hall of Species</Text>
            <Text style={styles.subtitle}>
              Genesis Trophy Holders Govern FishVerse
            </Text>
          </View>

          {/* DAO Stats */}
          <View style={styles.statsCard}>
            <LinearGradient
              colors={colors.gradientGold}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statsGradient}
            >
              <View style={styles.statItem}>
                <Text style={styles.statValue}>847</Text>
                <Text style={styles.statLabel}>Genesis NFTs</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>156</Text>
                <Text style={styles.statLabel}>DAO Members</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>$124K</Text>
                <Text style={styles.statLabel}>Conservation</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'trophies' && styles.activeTab]}
              onPress={() => setActiveTab('trophies')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'trophies' && styles.activeTabText,
                ]}
              >
                Genesis Trophies
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'proposals' && styles.activeTab]}
              onPress={() => setActiveTab('proposals')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'proposals' && styles.activeTabText,
                ]}
              >
                Proposals
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'treasury' && styles.activeTab]}
              onPress={() => setActiveTab('treasury')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'treasury' && styles.activeTabText,
                ]}
              >
                Treasury
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {activeTab === 'trophies' && (
            <View style={styles.content}>
              <Text style={styles.contentTitle}>
                One Genesis Trophy Per Species Per Water Body
              </Text>
              <Text style={styles.contentSubtitle}>
                These legendary catches govern the FishVerse ecosystem
              </Text>

              {mockDAOSpecies.map((trophy) => (
                <TouchableOpacity key={trophy.id} style={styles.genesisCard}>
                  <LinearGradient
                    colors={['#1E2942', '#243049']}
                    style={styles.genesisGradient}
                  >
                    <View style={styles.genesisHeader}>
                      <View style={styles.genesisBadge}>
                        <MaterialCommunityIcons
                          name="crown"
                          size={16}
                          color={colors.gold}
                        />
                        <Text style={styles.genesisBadgeText}>GENESIS</Text>
                      </View>
                      <View style={styles.votePower}>
                        <Ionicons name="flash" size={14} color={colors.primary} />
                        <Text style={styles.votePowerText}>
                          {trophy.votes} VP
                        </Text>
                      </View>
                    </View>

                    <View style={styles.genesisContent}>
                      <View style={styles.fishIcon}>
                        <MaterialCommunityIcons
                          name="fish"
                          size={40}
                          color={colors.gold}
                        />
                      </View>
                      <View style={styles.genesisInfo}>
                        <Text style={styles.genesisSpecies}>
                          {trophy.species}
                        </Text>
                        <Text style={styles.genesisLocation}>
                          {trophy.waterBody}
                        </Text>
                        <View style={styles.genesisStats}>
                          <Text style={styles.genesisWeight}>
                            {trophy.weight}
                          </Text>
                          <Text style={styles.genesisDate}>{trophy.date}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.genesisOwner}>
                      <View style={styles.ownerAvatar}>
                        <Ionicons
                          name="person"
                          size={16}
                          color={colors.textSecondary}
                        />
                      </View>
                      <Text style={styles.ownerName}>{trophy.owner}</Text>
                      <View style={styles.proposalCount}>
                        <Text style={styles.proposalCountText}>
                          {trophy.proposals} active proposals
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeTab === 'proposals' && (
            <View style={styles.content}>
              <View style={styles.proposalHeader}>
                <Text style={styles.contentTitle}>Active Proposals</Text>
                <TouchableOpacity style={styles.createButton}>
                  <LinearGradient
                    colors={colors.gradientPrimary}
                    style={styles.createGradient}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createText}>Create</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {mockProposals.map((proposal) => (
                <TouchableOpacity key={proposal.id} style={styles.proposalCard}>
                  <LinearGradient
                    colors={['#1E2942', '#243049']}
                    style={styles.proposalGradient}
                  >
                    <View style={styles.proposalTopRow}>
                      <View
                        style={[
                          styles.proposalTypeBadge,
                          {
                            backgroundColor:
                              proposal.type === 'conservation'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : proposal.type === 'funding'
                                ? 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(99, 102, 241, 0.1)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.proposalTypeText,
                            {
                              color:
                                proposal.type === 'conservation'
                                  ? colors.success
                                  : proposal.type === 'funding'
                                  ? colors.warning
                                  : colors.secondary,
                            },
                          ]}
                        >
                          {proposal.type.toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.proposalStatus,
                          {
                            backgroundColor:
                              proposal.status === 'active'
                                ? 'rgba(0, 212, 170, 0.1)'
                                : 'rgba(168, 85, 247, 0.1)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.proposalStatusText,
                            {
                              color:
                                proposal.status === 'active'
                                  ? colors.primary
                                  : colors.purple,
                            },
                          ]}
                        >
                          {proposal.status === 'active' ? proposal.endsIn : 'Passed'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.proposalTitle}>{proposal.title}</Text>
                    <Text style={styles.proposalDescription}>
                      {proposal.description}
                    </Text>

                    <View style={styles.voteBar}>
                      <View
                        style={[
                          styles.voteFill,
                          {
                            width: `${
                              (proposal.votes.for /
                                (proposal.votes.for + proposal.votes.against)) *
                              100
                            }%`,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.voteStats}>
                      <View style={styles.voteStat}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={colors.success}
                        />
                        <Text style={styles.voteStatText}>
                          {proposal.votes.for} For
                        </Text>
                      </View>
                      <View style={styles.voteStat}>
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={colors.error}
                        />
                        <Text style={styles.voteStatText}>
                          {proposal.votes.against} Against
                        </Text>
                      </View>
                    </View>

                    {proposal.status === 'active' && (
                      <View style={styles.voteButtons}>
                        <TouchableOpacity style={styles.voteForButton}>
                          <Text style={styles.voteForText}>Vote For</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.voteAgainstButton}>
                          <Text style={styles.voteAgainstText}>Vote Against</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeTab === 'treasury' && (
            <View style={styles.content}>
              <Text style={styles.contentTitle}>Conservation Treasury</Text>
              <Text style={styles.contentSubtitle}>
                2% of every NFT sale funds conservation
              </Text>

              <View style={styles.treasuryCard}>
                <LinearGradient
                  colors={colors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.treasuryGradient}
                >
                  <MaterialCommunityIcons
                    name="safe"
                    size={48}
                    color="#fff"
                  />
                  <Text style={styles.treasuryBalance}>45.7 ETH</Text>
                  <Text style={styles.treasuryUsd}>~$124,350 USD</Text>
                </LinearGradient>
              </View>

              <Text style={styles.allocationTitle}>Fund Allocations</Text>

              <View style={styles.allocationCard}>
                <View style={styles.allocationItem}>
                  <View style={styles.allocationIcon}>
                    <MaterialCommunityIcons
                      name="fish"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.allocationInfo}>
                    <Text style={styles.allocationName}>
                      State Stocking Programs
                    </Text>
                    <Text style={styles.allocationPercent}>40%</Text>
                  </View>
                  <Text style={styles.allocationAmount}>18.3 ETH</Text>
                </View>

                <View style={styles.allocationItem}>
                  <View style={styles.allocationIcon}>
                    <MaterialCommunityIcons
                      name="water"
                      size={20}
                      color={colors.secondary}
                    />
                  </View>
                  <View style={styles.allocationInfo}>
                    <Text style={styles.allocationName}>
                      Habitat Restoration
                    </Text>
                    <Text style={styles.allocationPercent}>35%</Text>
                  </View>
                  <Text style={styles.allocationAmount}>16.0 ETH</Text>
                </View>

                <View style={styles.allocationItem}>
                  <View style={styles.allocationIcon}>
                    <MaterialCommunityIcons
                      name="school"
                      size={20}
                      color={colors.warning}
                    />
                  </View>
                  <View style={styles.allocationInfo}>
                    <Text style={styles.allocationName}>Youth Programs</Text>
                    <Text style={styles.allocationPercent}>15%</Text>
                  </View>
                  <Text style={styles.allocationAmount}>6.9 ETH</Text>
                </View>

                <View style={styles.allocationItem}>
                  <View style={styles.allocationIcon}>
                    <MaterialCommunityIcons
                      name="flask"
                      size={20}
                      color={colors.purple}
                    />
                  </View>
                  <View style={styles.allocationInfo}>
                    <Text style={styles.allocationName}>Research Grants</Text>
                    <Text style={styles.allocationPercent}>10%</Text>
                  </View>
                  <Text style={styles.allocationAmount}>4.5 ETH</Text>
                </View>
              </View>

              <View style={styles.onChainBadge}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={20}
                  color={colors.success}
                />
                <Text style={styles.onChainText}>
                  All transactions on-chain and verifiable
                </Text>
              </View>
            </View>
          )}

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
  statsCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  statsGradient: {
    flexDirection: 'row',
    padding: spacing.md,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.background,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(0,0,0,0.6)',
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  contentTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  contentSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  genesisCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  genesisGradient: {
    padding: spacing.md,
  },
  genesisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genesisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  genesisBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  votePower: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  votePowerText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  genesisContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  fishIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genesisInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  genesisSpecies: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  genesisLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  genesisStats: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  genesisWeight: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.md,
  },
  genesisDate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  genesisOwner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  ownerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerName: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  proposalCount: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  proposalCountText: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  createGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  createText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: spacing.xs,
  },
  proposalCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  proposalGradient: {
    padding: spacing.md,
  },
  proposalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proposalTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  proposalTypeText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  proposalStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  proposalStatusText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  proposalTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  proposalDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  voteBar: {
    height: 6,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  voteFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
  },
  voteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  voteStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteStatText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  voteButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  voteForButton: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  voteForText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#fff',
  },
  voteAgainstButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  voteAgainstText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  treasuryCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  treasuryGradient: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  treasuryBalance: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: spacing.md,
  },
  treasuryUsd: {
    fontSize: fontSize.lg,
    color: 'rgba(255,255,255,0.8)',
  },
  allocationTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  allocationCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  allocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  allocationIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allocationInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  allocationName: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  allocationPercent: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  allocationAmount: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
  },
  onChainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  onChainText: {
    fontSize: fontSize.sm,
    color: colors.success,
    marginLeft: spacing.sm,
  },
});
