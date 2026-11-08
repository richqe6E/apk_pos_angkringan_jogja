import { Tabs } from 'expo-router';
import React from 'react';
import { HapticTab } from '../../components/haptic-tab';
import { AppIcon } from '../../components/ui/app-icon';
import { Colors } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <AppIcon size={24} name="dashboard" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => (
            <AppIcon size={24} name="menu" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Riwayat',
          tabBarIcon: ({ color }) => (
            <AppIcon size={24} name="history" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Absensi',
          tabBarIcon: ({ color }) => (
            <AppIcon size={24} name="attendance" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="financial"
        options={{
          title: 'Keuangan',
          tabBarIcon: ({ color }) => (
            <AppIcon size={24} name="financial" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color }) => (
            <AppIcon size={24} name="settings" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

