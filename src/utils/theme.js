// FishVerse Theme - Ocean/Nature inspired dark theme

export const colors = {
  // Primary colors
  primary: '#00D4AA',      // Teal/aqua - main accent
  primaryDark: '#00A88A',
  primaryLight: '#33DDBB',

  // Secondary colors
  secondary: '#6366F1',    // Indigo for NFT/blockchain elements
  secondaryDark: '#4F46E5',

  // Background colors
  background: '#0A0E1A',   // Deep ocean blue-black
  backgroundLight: '#141B2D',
  backgroundCard: '#1E2942',

  // Surface colors
  surface: '#1A2235',
  surfaceLight: '#243049',

  // Text colors
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accent colors
  gold: '#FFD700',         // For legendary items
  orange: '#FF7F50',       // For epic items
  purple: '#A855F7',       // For rare items
  blue: '#3B82F6',         // For common items

  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  // Rarity colors
  genesis: '#FFD700',
  legendary: '#A855F7',
  epic: '#FF7F50',
  rare: '#3B82F6',
  common: '#64748B',

  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#00D4AA', '#00A88A'],
  gradientSecondary: ['#6366F1', '#4F46E5'],
  gradientGold: ['#FFD700', '#FFA500'],
  gradientPurple: ['#A855F7', '#7C3AED'],
  gradientBackground: ['#0A0E1A', '#1A2235'],
  gradientCard: ['#1E2942', '#243049'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const getRarityColor = (rarity) => {
  switch (rarity?.toLowerCase()) {
    case 'genesis':
      return colors.genesis;
    case 'legendary':
      return colors.legendary;
    case 'epic':
      return colors.epic;
    case 'rare':
      return colors.rare;
    default:
      return colors.common;
  }
};
