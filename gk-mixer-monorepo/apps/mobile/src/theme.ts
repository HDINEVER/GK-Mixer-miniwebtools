// iOS HIG semantic color palette + spacing + typography
// https://developer.apple.com/design/human-interface-guidelines

import { Platform } from 'react-native';

export const Colors = {
  // Light mode
  light: {
    bg: '#F2F2F7',
    card: '#FFFFFF',
    cardBorder: '#E5E5EA',
    primaryText: '#000000',
    secondaryText: '#3C3C4399',
    tertiaryText: '#3C3C434D',
    divider: '#C6C6C8',
    accent: '#FF9900',
    accentBg: '#FFF3E0',
    destructive: '#FF3B30',
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#E5E5EA',
  },
  // Dark mode
  dark: {
    bg: '#000000',
    card: '#1C1C1E',
    cardBorder: '#38383A',
    primaryText: '#FFFFFF',
    secondaryText: '#EBEBF599',
    tertiaryText: '#EBEBF54D',
    divider: '#38383A',
    accent: '#FF9900',
    accentBg: '#2C2416',
    destructive: '#FF453A',
    tabBarBg: '#1C1C1E',
    tabBarBorder: '#38383A',
  },
} as const;

// Typography: iOS semantic text styles mapped to RN
// SF Pro system font is the default on iOS. These sizes match HIG:
// Large Title 34, Title 28, Title 22, Body 17, Callout 16, Subheadline 15,
// Footnote 13, Caption 12, Caption 11
export const FontSize = {
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  body: 17,
  callout: 16,
  subheadline: 15,
  footnote: 13,
  caption1: 12,
  caption2: 11,
};

export const FontWeight = {
  regular: '400' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Spacing: standard iOS increments
export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

// Minimum touch target per HIG
export const MinTouchTarget = 44;

// iOS 原生等宽: Menlo (Terminal 同款, 所有 iOS 设备自带)
// 比 Courier 更现代, 数字/字母对齐更好
export const FontMono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Tabular numbers: keep dynamically updating hex/rgb/pct/ml stable
export const tabularNums = { fontVariant: ['tabular-nums'] as string[] };
