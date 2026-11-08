import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from '../../constants/theme';

export type AppIconName =
  | 'dashboard'
  | 'menu'
  | 'history'
  | 'attendance'
  | 'financial'
  | 'settings'
  | 'cart'
  | 'cash'
  | 'qris'
  | 'bank'
  | 'table'
  | 'people'
  | 'person'
  | 'supplier'
  | 'receipt'
  | 'search'
  | 'close'
  | 'close-circle'
  | 'check'
  | 'check-circle'
  | 'plus'
  | 'minus'
  | 'delete'
  | 'trash'
  | 'edit'
  | 'camera'
  | 'camera-reverse'
  | 'image'
  | 'print'
  | 'refresh'
  | 'lock'
  | 'tag'
  | 'discount'
  | 'clock'
  | 'alert'
  | 'alert-circle'
  | 'info'
  | 'filter'
  | 'phone'
  | 'calendar'
  | 'pin'
  | 'back'
  | 'arrow-back'
  | 'chevron-down'
  | 'star'
  | 'store';

export type AppIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
};

interface AppIconProps {
  name: AppIconName;
  size?: AppIconSize;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AppIcon({
  name,
  size = 'md',
  color = Colors.text,
  style,
}: AppIconProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 22;

  switch (name) {
    case 'dashboard':
      return <Ionicons name="grid" size={pixelSize} color={color} style={style} />;
    case 'menu':
      return <Ionicons name="restaurant" size={pixelSize} color={color} style={style} />;
    case 'history':
      return <Ionicons name="time" size={pixelSize} color={color} style={style} />;
    case 'attendance':
      return <Ionicons name="camera" size={pixelSize} color={color} style={style} />;
    case 'financial':
      return <Ionicons name="bar-chart" size={pixelSize} color={color} style={style} />;
    case 'settings':
      return <Ionicons name="settings-sharp" size={pixelSize} color={color} style={style} />;
    case 'cart':
      return <Ionicons name="cart" size={pixelSize} color={color} style={style} />;
    case 'cash':
      return <Ionicons name="cash-outline" size={pixelSize} color={color} style={style} />;
    case 'qris':
      return <Ionicons name="qr-code-outline" size={pixelSize} color={color} style={style} />;
    case 'bank':
      return <Ionicons name="business-outline" size={pixelSize} color={color} style={style} />;
    case 'table':
      return <MaterialCommunityIcons name="table-chair" size={pixelSize} color={color} style={style} />;
    case 'people':
      return <Ionicons name="people" size={pixelSize} color={color} style={style} />;
    case 'person':
      return <Ionicons name="person" size={pixelSize} color={color} style={style} />;
    case 'supplier':
      return <Ionicons name="cube-outline" size={pixelSize} color={color} style={style} />;
    case 'receipt':
      return <Ionicons name="receipt-outline" size={pixelSize} color={color} style={style} />;
    case 'search':
      return <Ionicons name="search" size={pixelSize} color={color} style={style} />;
    case 'close':
      return <Ionicons name="close" size={pixelSize} color={color} style={style} />;
    case 'close-circle':
      return <Ionicons name="close-circle" size={pixelSize} color={color} style={style} />;
    case 'check':
      return <Ionicons name="checkmark" size={pixelSize} color={color} style={style} />;
    case 'check-circle':
      return <Ionicons name="checkmark-circle" size={pixelSize} color={color} style={style} />;
    case 'plus':
      return <Ionicons name="add" size={pixelSize} color={color} style={style} />;
    case 'minus':
      return <Ionicons name="remove" size={pixelSize} color={color} style={style} />;
    case 'delete':
    case 'trash':
      return <Ionicons name="trash-outline" size={pixelSize} color={color} style={style} />;
    case 'edit':
      return <Ionicons name="pencil" size={pixelSize} color={color} style={style} />;
    case 'camera':
      return <Ionicons name="camera-outline" size={pixelSize} color={color} style={style} />;
    case 'camera-reverse':
      return <Ionicons name="camera-reverse-outline" size={pixelSize} color={color} style={style} />;
    case 'image':
      return <Ionicons name="image-outline" size={pixelSize} color={color} style={style} />;
    case 'print':
      return <Ionicons name="print-outline" size={pixelSize} color={color} style={style} />;
    case 'refresh':
      return <Ionicons name="refresh" size={pixelSize} color={color} style={style} />;
    case 'lock':
      return <Ionicons name="lock-closed" size={pixelSize} color={color} style={style} />;
    case 'tag':
    case 'discount':
      return <Ionicons name="pricetag-outline" size={pixelSize} color={color} style={style} />;
    case 'clock':
      return <Ionicons name="time-outline" size={pixelSize} color={color} style={style} />;
    case 'alert':
      return <Ionicons name="warning-outline" size={pixelSize} color={color} style={style} />;
    case 'alert-circle':
      return <Ionicons name="alert-circle" size={pixelSize} color={color} style={style} />;
    case 'info':
      return <Ionicons name="information-circle-outline" size={pixelSize} color={color} style={style} />;
    case 'filter':
      return <Ionicons name="funnel-outline" size={pixelSize} color={color} style={style} />;
    case 'phone':
      return <Ionicons name="call-outline" size={pixelSize} color={color} style={style} />;
    case 'calendar':
      return <Ionicons name="calendar-outline" size={pixelSize} color={color} style={style} />;
    case 'pin':
      return <Ionicons name="keypad-outline" size={pixelSize} color={color} style={style} />;
    case 'back':
    case 'arrow-back':
      return <Ionicons name="arrow-back" size={pixelSize} color={color} style={style} />;
    case 'chevron-down':
      return <Ionicons name="chevron-down" size={pixelSize} color={color} style={style} />;
    case 'star':
      return <Ionicons name="star" size={pixelSize} color={color} style={style} />;
    case 'store':
      return <Ionicons name="storefront-outline" size={pixelSize} color={color} style={style} />;
    default:
      return <Ionicons name="ellipse" size={pixelSize} color={color} style={style} />;
  }
}
