import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  enableHaptic?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  enableHaptic = true,
  onPress,
  ...props
}: ButtonProps) {
  const handlePress = (e: any) => {
    if (disabled || loading) return;
    if (enableHaptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.(e);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        pressed && styles[`${variant}Pressed` as keyof typeof styles],
        disabled && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#ffffff' : Colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              textStyles.base,
              textStyles[variant],
              textStyles[size],
              disabled && textStyles.disabledText,
              icon ? { marginLeft: 8 } : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  md: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lg: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  primaryPressed: {
    backgroundColor: Colors.primaryDark,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
  },
  outlinePressed: {
    backgroundColor: Colors.primarySoft,
  },
  secondary: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primaryBorder,
  },
  secondaryPressed: {
    backgroundColor: '#d1fae5',
  },
  danger: {
    backgroundColor: Colors.danger,
    borderColor: '#b91c1c',
  },
  dangerPressed: {
    backgroundColor: '#b91c1c',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  ghostPressed: {
    backgroundColor: Colors.borderLight,
  },
  disabled: {
    backgroundColor: Colors.disabled,
    borderColor: Colors.disabled,
    opacity: 0.65,
  },
});

const textStyles = StyleSheet.create({
  base: {
    fontWeight: '700',
    textAlign: 'center',
  },
  sm: {
    fontSize: 13,
  },
  md: {
    fontSize: 15,
  },
  lg: {
    fontSize: 16,
  },
  primary: {
    color: '#ffffff',
  },
  outline: {
    color: Colors.primary,
  },
  secondary: {
    color: Colors.primaryDark,
  },
  danger: {
    color: '#ffffff',
  },
  ghost: {
    color: Colors.textSecondary,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});

