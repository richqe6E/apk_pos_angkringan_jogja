import React, { Suspense } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { migrateDbIfNeeded } from '../services/database';
import { Colors } from '../constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function DatabaseLoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ marginTop: 14, fontSize: 14, color: Colors.textSecondary, fontWeight: '600' }}>
        Menyiapkan Basis Data POS Angkringan Jogja...
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Suspense fallback={<DatabaseLoadingFallback />}>
        <SQLite.SQLiteProvider databaseName="pos_angkringan.db" onInit={migrateDbIfNeeded} useSuspense>
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="transaksi" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </SafeAreaView>
          <StatusBar style="light" backgroundColor={Colors.primaryDark} />
        </SQLite.SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

