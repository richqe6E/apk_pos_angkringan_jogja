import { create } from 'zustand';
import { Platform } from 'react-native';
import { BluetoothManager } from '@vardrz/react-native-bluetooth-escpos-printer';
import { SQLiteDatabase, withSqliteRetry } from '../services/database';

export interface BluetoothDeviceItem {
  name: string;
  address: string; // MAC address
}

interface PrinterState {
  cashierPrinter: BluetoothDeviceItem | null;
  kitchenPrinter: BluetoothDeviceItem | null;
  isCashierConnected: boolean;
  isKitchenConnected: boolean;
  isScanning: boolean;
  pairedDevices: BluetoothDeviceItem[];
  foundDevices: BluetoothDeviceItem[];
  autoPrintKitchen: boolean; // Otomatis cetak dapur saat checkout / simpan meja
  autoPrintCashier: boolean; // Otomatis cetak customer saat bayar

  // Actions
  setCashierPrinter: (device: BluetoothDeviceItem | null) => void;
  setKitchenPrinter: (device: BluetoothDeviceItem | null) => void;
  setAutoPrintKitchen: (val: boolean) => void;
  setAutoPrintCashier: (val: boolean) => void;
  loadSavedPrinters: (db: SQLiteDatabase) => Promise<void>;
  savePrinterSettings: (db: SQLiteDatabase) => Promise<void>;
  scanDevices: () => Promise<void>;
  connectDevice: (address: string) => Promise<boolean>;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  cashierPrinter: null,
  kitchenPrinter: null,
  isCashierConnected: false,
  isKitchenConnected: false,
  isScanning: false,
  pairedDevices: [],
  foundDevices: [],
  autoPrintKitchen: true,
  autoPrintCashier: true,

  setCashierPrinter: (device) => {
    set({ cashierPrinter: device });
  },

  setKitchenPrinter: (device) => {
    set({ kitchenPrinter: device });
  },

  setAutoPrintKitchen: (val) => set({ autoPrintKitchen: val }),
  setAutoPrintCashier: (val) => set({ autoPrintCashier: val }),

  loadSavedPrinters: async (db: SQLiteDatabase) => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<{ key: string; value: string }>(
          `SELECT key, value FROM settings WHERE key IN (
            'printer_cashier_mac', 'printer_cashier_name',
            'printer_kitchen_mac', 'printer_kitchen_name',
            'auto_print_kitchen', 'auto_print_cashier'
          )`
        )
      );

      const map: Record<string, string> = {};
      (rows || []).forEach((r) => {
        map[r.key] = r.value;
      });

      if (map.printer_cashier_mac) {
        set({
          cashierPrinter: {
            address: map.printer_cashier_mac,
            name: map.printer_cashier_name || 'Printer Kasir',
          },
        });
      }

      if (map.printer_kitchen_mac) {
        set({
          kitchenPrinter: {
            address: map.printer_kitchen_mac,
            name: map.printer_kitchen_name || 'Printer Dapur',
          },
        });
      }

      if (map.auto_print_kitchen !== undefined) {
        set({ autoPrintKitchen: map.auto_print_kitchen === '1' });
      }
      if (map.auto_print_cashier !== undefined) {
        set({ autoPrintCashier: map.auto_print_cashier === '1' });
      }
    } catch (err) {
      console.error('Error loading saved printers:', err);
    }
  },

  savePrinterSettings: async (db: SQLiteDatabase) => {
    const { cashierPrinter, kitchenPrinter, autoPrintKitchen, autoPrintCashier } = get();
    try {
      const entries = [
        ['printer_cashier_mac', cashierPrinter?.address || ''],
        ['printer_cashier_name', cashierPrinter?.name || ''],
        ['printer_kitchen_mac', kitchenPrinter?.address || ''],
        ['printer_kitchen_name', kitchenPrinter?.name || ''],
        ['auto_print_kitchen', autoPrintKitchen ? '1' : '0'],
        ['auto_print_cashier', autoPrintCashier ? '1' : '0'],
      ];

      for (const [k, v] of entries) {
        await withSqliteRetry(() =>
          db.runAsync(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = ?`,
            [k, v, v]
          )
        );
      }
    } catch (err) {
      console.error('Error saving printer settings:', err);
    }
  },

  scanDevices: async () => {
    if (Platform.OS !== 'android') return;
    set({ isScanning: true });
    try {
      // Pastikan bluetooth aktif
      await BluetoothManager.enableBluetooth();

      const responseString = await BluetoothManager.scanDevices();
      let parsed: any = {};
      if (typeof responseString === 'string') {
        parsed = JSON.parse(responseString);
      } else {
        parsed = responseString;
      }

      const paired: BluetoothDeviceItem[] = (parsed.paired || []).map((d: any) => ({
        name: d.name || 'Bluetooth Device',
        address: d.address,
      }));

      const found: BluetoothDeviceItem[] = (parsed.found || []).map((d: any) => ({
        name: d.name || 'Bluetooth Device',
        address: d.address,
      }));

      set({ pairedDevices: paired, foundDevices: found, isScanning: false });
    } catch (err) {
      console.warn('Bluetooth scan error:', err);
      set({ isScanning: false });
    }
  },

  connectDevice: async (address: string) => {
    if (Platform.OS !== 'android') return false;
    try {
      await BluetoothManager.connect(address);
      return true;
    } catch (err) {
      console.warn('Bluetooth connect error:', err);
      return false;
    }
  },
}));

