import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../utils/theme';
import { mockPods } from '../data/mockData';

const { width } = Dimensions.get('window');

export default function PodsScreen({ navigation }) {
  const [activePod, setActivePod] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: '1',
      user: 'BassMaster',
      text: 'Just got a 5 pounder on a texas rig!',
      time: '2 min ago',
      type: 'text',
    },
    {
      id: '2',
      user: 'CrankBaitKing',
      text: 'What depth?',
      time: '1 min ago',
      type: 'text',
    },
    {
      id: '3',
      user: 'BassMaster',
      text: '12-15ft near the brush pile',
      time: 'Just now',
      type: 'text',
    },
    {
      id: '4',
      user: 'System',
      text: 'FlyFishPro shared their sonar overlay',
      time: 'Just now',
      type: 'sonar',
    },
  ]);

  if (activePod) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient colors={['#0A0E1A', '#1A2235']} style={styles.gradient}>
          {/* Pod Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActivePod(null)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatTitle}>{activePod.name}</Text>
              <View style={styles.memberRow}>
                <View style={styles.memberDots}>
                  {[...Array(activePod.members)].map((_, i) => (
                    <View key={i} style={styles.memberDot} />
                  ))}
                </View>
                <Text style={styles.memberCount}>
                  {activePod.members} anglers nearby
                </Text>
              </View>
            </View>
            <View style={styles.ephemeralBadge}>
              <Ionicons name="timer" size={14} color={colors.warning} />
              <Text style={styles.ephemeralText}>Auto-erase</Text>
            </View>
          </View>

          {/* Messages */}
          <ScrollView style={styles.messagesContainer}>
            <View style={styles.podWarning}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={styles.podWarningText}>
                This Pod is private. Messages auto-delete when all members leave
                the 500m radius.
              </Text>
            </View>

            {messages.map((msg) => (
              <View key={msg.id} style={styles.messageWrapper}>
                {msg.type === 'sonar' ? (
                  <View style={styles.sonarMessage}>
                    <LinearGradient
                      colors={['#1E2942', '#243049']}
                      style={styles.sonarGradient}
                    >
                      <MaterialCommunityIcons
                        name="radar"
                        size={24}
                        color={colors.primary}
                      />
                      <Text style={styles.sonarText}>{msg.text}</Text>
                      <TouchableOpacity style={styles.viewSonarButton}>
                        <Text style={styles.viewSonarText}>View</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                ) : (
                  <View style={styles.message}>
                    <Text style={styles.messageUser}>{msg.user}</Text>
                    <Text style={styles.messageText}>{msg.text}</Text>
                    <Text style={styles.messageTime}>{msg.time}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons
                name="radar"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.quickActionText}>Sonar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="location" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Drop Pin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <Ionicons name="mic" size={24} color={colors.primary} />
              <Text style={styles.quickActionText}>Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <MaterialCommunityIcons
                name="fishbowl"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.quickActionText}>What's Working</Text>
            </TouchableOpacity>
          </View>

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Share with your Pod..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity style={styles.sendButton}>
              <LinearGradient
                colors={colors.gradientPrimary}
                style={styles.sendGradient}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#1A2235']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pods</Text>
          <Text style={styles.subtitle}>
            Connect with nearby anglers in real-time
          </Text>
        </View>

        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <LinearGradient
            colors={['#1E2942', '#243049']}
            style={styles.mapPlaceholder}
          >
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={48}
              color={colors.primary}
            />
            <Text style={styles.mapText}>Map View</Text>
            <Text style={styles.mapSubtext}>
              3 active pods within 2 miles
            </Text>

            {/* Mock pod indicators */}
            <View style={[styles.podMarker, { top: '30%', left: '25%' }]}>
              <View style={styles.podMarkerInner} />
              <View style={styles.podMarkerPulse} />
            </View>
            <View style={[styles.podMarker, { top: '45%', right: '30%' }]}>
              <View style={styles.podMarkerInner} />
              <View style={styles.podMarkerPulse} />
            </View>
            <View style={[styles.podMarker, { bottom: '35%', left: '40%' }]}>
              <View style={styles.podMarkerInner} />
              <View style={styles.podMarkerPulse} />
            </View>

            {/* User location */}
            <View style={styles.userMarker}>
              <Ionicons name="navigate" size={24} color={colors.primary} />
            </View>
          </LinearGradient>
        </View>

        {/* Active Pods */}
        <Text style={styles.sectionTitle}>Active Pods Nearby</Text>
        <ScrollView style={styles.podsList}>
          {mockPods.map((pod) => (
            <TouchableOpacity
              key={pod.id}
              style={styles.podCard}
              onPress={() => setActivePod(pod)}
            >
              <LinearGradient
                colors={['#1E2942', '#243049']}
                style={styles.podGradient}
              >
                <View style={styles.podHeader}>
                  <View style={styles.podIconContainer}>
                    <MaterialCommunityIcons
                      name="account-group"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.podInfo}>
                    <Text style={styles.podName}>{pod.name}</Text>
                    <View style={styles.podMeta}>
                      <View style={styles.podMetaItem}>
                        <Ionicons name="people" size={14} color={colors.textSecondary} />
                        <Text style={styles.podMetaText}>{pod.members}</Text>
                      </View>
                      <View style={styles.podMetaItem}>
                        <Ionicons name="location" size={14} color={colors.textSecondary} />
                        <Text style={styles.podMetaText}>{pod.distance}</Text>
                      </View>
                      <View style={styles.podMetaItem}>
                        <View style={styles.activeDot} />
                        <Text style={styles.podMetaText}>{pod.lastActive}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
                </View>
                <View style={styles.podActivity}>
                  <MaterialCommunityIcons
                    name="message-text"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.podActivityText}>{pod.activity}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}

          {/* Create Pod Button */}
          <TouchableOpacity style={styles.createPodButton}>
            <LinearGradient
              colors={colors.gradientPrimary}
              style={styles.createPodGradient}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.createPodText}>Create New Pod</Text>
            </LinearGradient>
          </TouchableOpacity>

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
  mapContainer: {
    marginHorizontal: spacing.lg,
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.sm,
  },
  mapSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  podMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.warning,
  },
  podMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  userMarker: {
    position: 'absolute',
    bottom: '40%',
    left: '50%',
    marginLeft: -12,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  podsList: {
    paddingHorizontal: spacing.lg,
  },
  podCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  podGradient: {
    padding: spacing.md,
  },
  podHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  podIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  podName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  podMeta: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  podMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  podMetaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  podActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  podActivityText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  createPodButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  createPodGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  createPodText: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: spacing.sm,
  },
  // Chat styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  chatTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  memberDots: {
    flexDirection: 'row',
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  memberCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  ephemeralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  ephemeralText: {
    fontSize: fontSize.xs,
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  messagesContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  podWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  podWarningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  messageWrapper: {
    marginBottom: spacing.md,
  },
  message: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    maxWidth: '80%',
  },
  messageUser: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.primary,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.text,
    marginTop: spacing.xs,
  },
  messageTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  sonarMessage: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  sonarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  sonarText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  viewSonarButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  viewSonarText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: '#fff',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 30,
  },
  input: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  sendButton: {
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  sendGradient: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
