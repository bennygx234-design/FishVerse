import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import HomeScreen from '../screens/HomeScreen';
import CatchScreen from '../screens/CatchScreen';
import PodsScreen from '../screens/PodsScreen';
import GhostLureScreen from '../screens/GhostLureScreen';
import BiteWindowScreen from '../screens/BiteWindowScreen';
import DAOScreen from '../screens/DAOScreen';

import { colors } from '../utils/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.backgroundCard,
          borderTopWidth: 0,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeTab : null}>
              <Ionicons name="home" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Pods"
        component={PodsScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeTab : null}>
              <MaterialCommunityIcons
                name="account-group"
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Catch"
        component={CatchScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.catchButtonContainer}>
              <LinearGradient
                colors={colors.gradientPrimary}
                style={styles.catchButton}
              >
                <MaterialCommunityIcons name="fish" size={28} color="#fff" />
              </LinearGradient>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="GhostLure"
        component={GhostLureScreen}
        options={{
          tabBarLabel: 'Ghost',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeTab : null}>
              <MaterialCommunityIcons name="ghost" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="DAO"
        component={DAOScreen}
        options={{
          tabBarLabel: 'Hall',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeTab : null}>
              <MaterialCommunityIcons name="crown" size={24} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="BiteWindow" component={BiteWindowScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  activeTab: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 12,
    padding: 8,
  },
  catchButtonContainer: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catchButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
