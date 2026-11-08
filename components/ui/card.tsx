import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { Colors, Shadows, Radii } from '../../constants/theme';

interface CardProps extends ViewProps {
  variant?: 'elevated' | 'outlined' | 'flat' | 'interactive';
  padding?: number;
}

export function Card({ style, variant = 'elevated', padding, children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'flat' && styles.flat,
        variant === 'interactive' && styles.interactive,
        padding !== undefined && { padding },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.card,
    borderRadius: Radii.md || 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  elevated: {
    ...Shadows.sm,
    borderColor: '#e2e8f0',
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: Colors.borderActive,
  },
  flat: {
    backgroundColor: Colors.borderLight,
    borderWidth: 0,
  },
  interactive: {
    ...Shadows.sm,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
});
