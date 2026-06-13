import { Platform } from 'react-native';

const tintColorLight = '#475569';
const tintColorDark = '#fff';

export const COLORS = {
  primary: '#475569',        // 메인 슬레이트
  primaryLight: '#64748B',   // 라이트 슬레이트
  secondary: '#84CC16',      // 라임 그린
  secondaryLight: '#BEF264', // 라이트 라임
  background: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#1E293B',
  subText: '#64748B',
  border: '#E2E8F0',
  buttonText: '#FFFFFF',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
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
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
