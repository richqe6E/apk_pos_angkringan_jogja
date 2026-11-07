import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { usePrinterStore, BluetoothDeviceItem } from '../stores/printerStore';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import {
  ensureBluetoothPermissions,
  printCustomerReceipt,
  printKitchenTicket,
} from '../services/print';

interface PrinterManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrinterManagementModal({ visible, onClose }: PrinterManagementModalProps) {
  const db = useSQLiteContext();
  const {
    cashierPrinter,
    kitchenPrinter,
    isScanning,
    pairedDevices,
    foundDevices,
    autoPrintCashier,
    autoPrintKitchen,
    setCashierPrinter,
    setKitchenPrinter,
    setAutoPrintCashier,
    setAutoPrintKitchen,
    scanDevices,
    connectDevice,
    loadSavedPrinters,
    savePrinterSettings,
  } = usePrinterStore();

  const [selectedDevice, setSelectedDevice] = useState<BluetoothDeviceItem | null>(null);
  const [testingType, setTestingType] = useState<'cashier' | 'kitchen' | null>(null);

  useEffect(() => {
    if (visible) {
      loadSavedPrinters(db);
      ensureBluetoothPermissions();
    }
  }, [visible]);

  const handleStartScan = async () => {
    const perm = await ensureBluetoothPermissions();
    if (!perm) {
      Alert.alert('Izin Dibutuhkan', 'Izin Bluetooth dan Lokasi wajib diaktifkan.');
      return;
    }
    await scanDevices();
  };

  const handleAssignCashier = async (dev: BluetoothDeviceItem) => {
    setCashierPrinter(dev);
    await savePrinterSettings(db);
    Alert.alert('Sukses', `"${dev.name}" ditetapkan sebagai Printer Kasir / Customer.`);
  };

  const handleAssignKitchen = async (dev: BluetoothDeviceItem) => {
    setKitchenPrinter(dev);
    await savePrinterSettings(db);
    Alert.alert('Sukses', `"${dev.name}" ditetapkan sebagai Printer Kitchen / Dapur.`);
  };

  const handleTestPrintCashier = async () => {
    if (!cashierPrinter) {
      Alert.alert('Perhatian', 'Belum ada Printer Kasir yang dipilih.');
      return;
    }

    setTestingType('cashier');
    try {
      await connectDevice(cashierPrinter.address);
      await printCustomerReceipt({
        invoiceNumber: 'TEST-KASIR-001',
        businessDate: '2026-11-06',
        dateTimeString: 'Jumat, 06 Nov 2026, 19:45 WIB',
        tableNumber: 'Meja 01 (Test)',
        customerName: 'Customer Test',
        subtotal: 25000,
        total: 25000,
        paymentMethod: 'tunai',
        paymentAmount: 50000,
        changeAmount: 25000,
        items: [
          { name: 'Nasi Kucing Sambal Teri', price: 5000, qty: 2, subtotal: 10000 },
          { name: 'Sate Usus Bakar', price: 3000, qty: 3, subtotal: 9000 },
          { name: 'Wedang Jahe Geprek', price: 6000, qty: 1, subtotal: 6000 },
        ],
      });
      setTestingType(null);
      Alert.alert('Sukses', 'Uji cetak struk kasir berhasil dikirim.');
    } catch (err: any) {
      setTestingType(null);
      Alert.alert('Gagal', err?.message || 'Gagal menghubungkan ke Printer Kasir.');
    }
  };

  const handleTestPrintKitchen = async () => {
    if (!kitchenPrinter) {
      Alert.alert('Perhatian', 'Belum ada Printer Kitchen yang dipilih.');
      return;
    }

    setTestingType('kitchen');
    try {
      await connectDevice(kitchenPrinter.address);
      await printKitchenTicket({
        invoiceNumber: 'TEST-DAPUR-001',
        tableNumber: 'Meja 01 (Test)',
        dateTimeString: '19:45 WIB',
        items: [
          { name: 'Nasi Kucing Sambal Teri', price: 0, qty: 2, subtotal: 0 },
          { name: 'Sate Usus Bakar (Bakar Pedas)', price: 0, qty: 3, subtotal: 0 },
          { name: 'Wedang Jahe Geprek (Hangat)', price: 0, qty: 1, subtotal: 0 },
        ],
      });
      setTestingType(null);
      Alert.alert('Sukses', 'Uji cetak tiket dapur berhasil dikirim.');
    } catch (err: any) {
      setTestingType(null);
      Alert.alert('Gagal', err?.message || 'Gagal menghubungkan ke Printer Kitchen.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.title}>Pengaturan Multi-Printer Bluetooth</Text>
              <Text style={styles.subtitle}>
                Hubungkan printer thermal kasir & dapur secara terpisah
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }}>
            {/* 1. Status Printer Aktif */}
            <View style={styles.activePrintersRow}>
              {/* Box Printer Kasir */}
              <View style={[styles.printerBox, cashierPrinter && styles.printerBoxActive]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.printerBoxTitle}>🧾 Printer Kasir / Nota</Text>
                  <Badge label={cashierPrinter ? 'Terpasang' : 'Kosong'} variant={cashierPrinter ? 'success' : 'neutral'} size="sm" />
                </View>
                <Text style={styles.printerBoxName} numberOfLines={1}>
                  {cashierPrinter ? cashierPrinter.name : 'Belum ditetapkan'}
                </Text>
                <Text style={styles.printerBoxMac} numberOfLines={1}>
                  {cashierPrinter ? cashierPrinter.address : 'Pilih perangkat di bawah'}
                </Text>

                <View style={styles.printerBoxFooter}>
                  <Button
                    title="Uji Cetak Nota"
                    variant="outline"
                    size="sm"
                    loading={testingType === 'cashier'}
                    disabled={!cashierPrinter || testingType !== null}
                    onPress={handleTestPrintCashier}
                  />
                  {cashierPrinter && (
                    <TouchableOpacity onPress={() => handleAssignCashier({ name: '', address: '' })}>
                      <Text style={{ fontSize: 11, color: Colors.danger, fontWeight: '700', marginLeft: 8 }}>Lepas</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Box Printer Dapur */}
              <View style={[styles.printerBox, kitchenPrinter && styles.printerBoxActive]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.printerBoxTitle}>🍳 Printer Kitchen / Dapur</Text>
                  <Badge label={kitchenPrinter ? 'Terpasang' : 'Kosong'} variant={kitchenPrinter ? 'success' : 'neutral'} size="sm" />
                </View>
                <Text style={styles.printerBoxName} numberOfLines={1}>
                  {kitchenPrinter ? kitchenPrinter.name : 'Belum ditetapkan'}
                </Text>
                <Text style={styles.printerBoxMac} numberOfLines={1}>
                  {kitchenPrinter ? kitchenPrinter.address : 'Pilih perangkat di bawah'}
                </Text>

                <View style={styles.printerBoxFooter}>
                  <Button
                    title="Uji Cetak Dapur"
                    variant="outline"
                    size="sm"
                    loading={testingType === 'kitchen'}
                    disabled={!kitchenPrinter || testingType !== null}
                    onPress={handleTestPrintKitchen}
                  />
                  {kitchenPrinter && (
                    <TouchableOpacity onPress={() => handleAssignKitchen({ name: '', address: '' })}>
                      <Text style={{ fontSize: 11, color: Colors.danger, fontWeight: '700', marginLeft: 8 }}>Lepas</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* 2. Pengaturan Otomasi Cetak */}
            <View style={styles.settingSwitchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.switchTitle}>Otomatis Cetak Struk Customer</Text>
                <Text style={styles.switchSub}>Cetak nota kasir secara otomatis saat pembayaran transaksi selesai</Text>
              </View>
              <Switch
                value={autoPrintCashier}
                onValueChange={(val) => {
                  setAutoPrintCashier(val);
                  savePrinterSettings(db);
                }}
                trackColor={{ false: Colors.border, true: Colors.primarySoft }}
                thumbColor={autoPrintCashier ? Colors.primary : Colors.disabled}
              />
            </View>

            <View style={styles.settingSwitchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.switchTitle}>Otomatis Cetak Tiket Dapur (Kitchen Ticket)</Text>
                <Text style={styles.switchSub}>Kirim tiket pesanan tanpa harga ke dapur saat pesanan disimpan/dibayar</Text>
              </View>
              <Switch
                value={autoPrintKitchen}
                onValueChange={(val) => {
                  setAutoPrintKitchen(val);
                  savePrinterSettings(db);
                }}
                trackColor={{ false: Colors.border, true: Colors.primarySoft }}
                thumbColor={autoPrintKitchen ? Colors.primary : Colors.disabled}
              />
            </View>

            {/* 3. Tombol Pindai Bluetooth & Daftar Perangkat */}
            <View style={styles.scanSectionHeader}>
              <Text style={styles.sectionTitle}>Perangkat Bluetooth Tersedia</Text>
              <Button
                title={isScanning ? 'Memindai...' : '🔍 Pindai Bluetooth'}
                variant="primary"
                size="sm"
                loading={isScanning}
                onPress={handleStartScan}
              />
            </View>

            {pairedDevices.length === 0 && foundDevices.length === 0 ? (
              <View style={styles.emptyScanBox}>
                <Text style={styles.emptyScanText}>
                  {Platform.OS === 'android'
                    ? 'Tekan tombol "Pindai Bluetooth" di atas untuk mencari printer thermal 58mm yang aktif.'
                    : 'Fitur cetak Bluetooth ESC/POS hanya didukung pada perangkat Android fisik.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {[...pairedDevices, ...foundDevices].map((device, idx) => {
                  const isCashier = cashierPrinter?.address === device.address;
                  const isKitchen = kitchenPrinter?.address === device.address;

                  return (
                    <View key={`${device.address}-${idx}`} style={styles.deviceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceMac}>{device.address}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Button
                          title={isCashier ? 'Kasir ✓' : '+ Kasir'}
                          variant={isCashier ? 'primary' : 'outline'}
                          size="sm"
                          onPress={() => handleAssignCashier(device)}
                        />
                        <Button
                          title={isKitchen ? 'Dapur ✓' : '+ Dapur'}
                          variant={isKitchen ? 'primary' : 'outline'}
                          size="sm"
                          onPress={() => handleAssignKitchen(device)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={{ marginTop: 16 }}>
            <Button title="Selesai & Tutup" variant="ghost" size="md" onPress={onClose} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  closeText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  activePrintersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  printerBox: {
    flex: 1,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
  },
  printerBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  printerBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  printerBoxName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 6,
  },
  printerBoxMac: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  printerBoxFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  switchSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scanSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    textTransform: 'uppercase',
  },
  emptyScanBox: {
    padding: 24,
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    alignItems: 'center',
  },
  emptyScanText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  deviceMac: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

