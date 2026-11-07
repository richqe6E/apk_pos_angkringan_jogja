import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { Colors, Shadows } from '../../constants/theme';

interface CardProps extends ViewProps {
  variant?: 'elevated' | 'outlined' | 'flat';
}

export function Card({ style, variant = 'elevated', children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'flat' && styles.flat,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    ...Shadows.sm,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: Colors.borderActive,
  },
  flat: {
    backgroundColor: Colors.borderLight,
    borderWidth: 0,
  },
});

