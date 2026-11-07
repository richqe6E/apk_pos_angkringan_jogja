import React, { Suspense, useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { migrateDbIfNeeded } from '../services/database';
import { Colors } from '../constants/theme';
import { usePrinterStore } from '../stores/printerStore';
import { useTransactionStore } from '../stores/transactionStore';

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

async function handleDatabaseInit(db: SQLite.SQLiteDatabase): Promise<void> {
  await migrateDbIfNeeded(db);
  try {
    await db.runAsync("UPDATE cash_ledger SET type = 'income' WHERE type = 'in'");
  } catch {}
  await usePrinterStore.getState().loadSavedPrinters(db);
  await useTransactionStore.getState().loadStoreSettings(db);
}

function AppInitializer() {
  const db = SQLite.useSQLiteContext();

  useEffect(() => {
    usePrinterStore.getState().loadSavedPrinters(db).catch((err) => console.warn('Init printers err:', err));
    useTransactionStore.getState().loadStoreSettings(db).catch((err) => console.warn('Init store settings err:', err));
  }, [db]);

  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Suspense fallback={<DatabaseLoadingFallback />}>
        <SQLite.SQLiteProvider databaseName="pos_angkringan.db" onInit={handleDatabaseInit} useSuspense>
          <AppInitializer />
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

