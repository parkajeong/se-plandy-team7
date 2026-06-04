/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Unified Color Palette
const tintColorLight = '#ff6a92'; // Main Pink
const tintColorDark = '#fff';

export const COLORS = {
  primary: '#ff6a92',      // Main Pink
  secondary: '#F2C75C',    // Secondary Yellow
  background: '#FFFFFF',   // Main Background
  surface: '#F8F8FA',      // Secondary Background
  text: '#2B2B2B',         // Main Text (Dark Gray)
  subText: '#6B7280',      // Sub Text (Gray)
  border: '#E5E7EB',       // Border (Light Gray)
  buttonText: '#FFFFFF',   // Button Text (White)
  danger: '#EF4444',       // Error/Danger Red
  success: '#22C55E',      // Success Green
};

export const Colors = {
  light: {
    text: COLORS.text,
    background: COLORS.background,
    tint: tintColorLight,
    icon: COLORS.subText,
    tabIconDefault: COLORS.subText,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
