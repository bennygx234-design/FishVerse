import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';

const { width, height } = Dimensions.get('window');

function SplashScreen({ onFinish }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.5);
  const textFadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <View style={splashStyles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#1A2235', '#0A0E1A']}
        style={splashStyles.gradient}
      >
        <Animated.View
          style={[
            splashStyles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#00D4AA', '#00A88A']}
            style={splashStyles.logoGradient}
          >
            <MaterialCommunityIcons name="fish" size={64} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Animated.View
          style={[splashStyles.textContainer, { opacity: textFadeAnim }]}
        >
          <Text style={splashStyles.title}>FishVerse</Text>
          <Text style={splashStyles.tagline}>
            Where every cast can become immortal
          </Text>
        </Animated.View>

        <Animated.View
          style={[splashStyles.features, { opacity: textFadeAnim }]}
        >
          <View style={splashStyles.featureRow}>
            <View style={splashStyles.featureDot} />
            <Text style={splashStyles.featureText}>Proof-of-Catch NFTs</Text>
          </View>
          <View style={splashStyles.featureRow}>
            <View style={splashStyles.featureDot} />
            <Text style={splashStyles.featureText}>Ghost Lure AR</Text>
          </View>
          <View style={splashStyles.featureRow}>
            <View style={splashStyles.featureDot} />
            <Text style={splashStyles.featureText}>Live Pods</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  features: {
    position: 'absolute',
    bottom: 100,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D4AA',
    marginRight: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#64748B',
  },
});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
