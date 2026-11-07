import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';

const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  'house.fill': 'home',
  'cart.fill': 'shopping-cart',
  'shippingbox.fill': 'inventory',
  'clock.fill': 'history',
  'chart.bar.fill': 'bar-chart',
  'chart.bar.doc.horizontal.fill': 'account-balance',
  'square.grid.2x2.fill': 'grid-view',
  'printer.fill': 'print',
  'gearshape.fill': 'settings',
  'person.2.fill': 'people',
  'camera.fill': 'camera-alt',
  'flame.fill': 'local-fire-department',
  'restaurant.fill': 'restaurant',
};

export type IconSymbolName = keyof typeof MAPPING;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  const iconName = MAPPING[name] || 'circle';
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}

