import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../constants/theme';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md';
}

export function Badge({
  label,
  variant = 'neutral',
  style,
  textStyle,
  size = 'md',
}: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], size === 'sm' && styles.badgeSm, style]}>
      <Text style={[styles.text, textStyles[variant], size === 'sm' && styles.textSm, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  success: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBorder,
  },
  warning: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warningBorder,
  },
  danger: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
  },
  info: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primaryBorder,
  },
  neutral: {
    backgroundColor: Colors.borderLight,
    borderColor: Colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.borderActive,
  },
  primary: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primaryBorder,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
    fontWeight: '600',
  },
});

const textStyles = StyleSheet.create({
  success: {
    color: Colors.success,
  },
  warning: {
    color: Colors.warning,
  },
  danger: {
    color: Colors.danger,
  },
  info: {
    color: Colors.primaryDark,
  },
  neutral: {
    color: Colors.textSecondary,
  },
  outline: {
    color: Colors.textSecondary,
  },
  primary: {
    color: Colors.primaryDark,
  },
});

