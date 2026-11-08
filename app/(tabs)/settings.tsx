import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/theme';
import { RealtimeClockBadge } from '../../components/realtime-clock-badge';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { withSqliteRetry } from '../../services/database';
import { usePrinterStore } from '../../stores/printerStore';
import { PrinterManagementModal } from '../../components/printer-management-modal';
import { AdminPinModal } from '../../components/admin-pin-modal';
import { saveImageLocally } from '../../utils/imageStorage';
import {
  exportDatabaseToJson,
  restoreDatabaseFromJson,
  clearTransactionsAndAttendance,
} from '../../services/backup';

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const {
    cashierPrinter,
    kitchenPrinter,
    autoPrintCashier,
    autoPrintKitchen,
    setAutoPrintCashier,
    setAutoPrintKitchen,
    loadSavedPrinters,
  } = usePrinterStore();

  const [storeName, setStoreName] = useState('Angkringan Jogja');
  const [storeAddress, setStoreAddress] = useState('Jl. Malioboro No. 45, Yogyakarta');
  const [storePhone, setStorePhone] = useState('0812-3456-7890');
  const [receiptFooter, setReceiptFooter] = useState('Matur Nuwun Sampun Rawuh!');
  const [adminPin, setAdminPin] = useState('123456');
  const [newAdminPin, setNewAdminPin] = useState('');

  // QRIS State
  const [qrisImagePath, setQrisImagePath] = useState<string | null>(null);
  const [isPickingQris, setIsPickingQris] = useState(false);

  // Multi-Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountHolder, setNewAccountHolder] = useState('');

  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [adminPinModalVisible, setAdminPinModalVisible] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<'clear_data' | 'restore_db' | null>(null);
  const [pendingRestoreJson, setPendingRestoreJson] = useState<string | null>(null);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSavedPrinters(db);
  }, [db]);

  const loadSettings = async () => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings')
      );

      (rows || []).forEach((row) => {
        if (row.key === 'store_name') setStoreName(row.value);
        if (row.key === 'store_address') setStoreAddress(row.value);
        if (row.key === 'store_phone') setStorePhone(row.value);
        if (row.key === 'receipt_footer') setReceiptFooter(row.value);
        if (row.key === 'admin_pin') setAdminPin(row.value);
        if (row.key === 'qris_image_path') setQrisImagePath(row.value || null);
        if (row.key === 'bank_accounts') {
          try {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed)) setBankAccounts(parsed);
          } catch (err) {
            console.warn('Gagal parse bank_accounts:', err);
          }
        }
      });
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  // QRIS Handlers
  const processAndSaveQris = async (selectedUri: string) => {
    const savedUri = await saveImageLocally(selectedUri, 'logo');
    await withSqliteRetry(() =>
      db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('qris_image_path', ?)",
        [savedUri]
      )
    );
    setQrisImagePath(savedUri);
    Alert.alert('Sukses', 'Foto QRIS toko berhasil disimpan dan siap ditampilkan di layar kasir.');
  };

  const handlePickQrisImage = async () => {
    Alert.alert('Foto QRIS Toko', 'Pilih sumber gambar barcode QRIS:', [
      {
        text: 'Buka Kamera',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Izin Ditolak', 'Izin kamera diperlukan untuk memotret barcode QRIS.');
              return;
            }
            setIsPickingQris(true);
            const res = await ImagePicker.launchCameraAsync({
              quality: 0.85,
              allowsEditing: false,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
              await processAndSaveQris(res.assets[0].uri);
            }
          } catch (err: any) {
            Alert.alert('Gagal Memotret', err?.message || 'Terjadi kesalahan saat memotret QRIS.');
          } finally {
            setIsPickingQris(false);
          }
        },
      },
      {
        text: 'Pilih dari Galeri',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Izin Ditolak', 'Izin galeri diperlukan untuk memilih foto QRIS.');
              return;
            }
            setIsPickingQris(true);
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.85,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
              await processAndSaveQris(res.assets[0].uri);
            }
          } catch (err: any) {
            Alert.alert('Gagal Memilih Foto', err?.message || 'Terjadi kesalahan saat memilih foto QRIS.');
          } finally {
            setIsPickingQris(false);
          }
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleDeleteQrisImage = () => {
    Alert.alert(
      'Konfirmasi Hapus QRIS',
      'Apakah Anda yakin ingin menghapus foto QRIS toko? Kasir tidak akan dapat menampilkan QRIS ke pelanggan hingga foto baru diunggah.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await withSqliteRetry(() =>
                db.runAsync(
                  "INSERT OR REPLACE INTO settings (key, value) VALUES ('qris_image_path', '')"
                )
              );
              setQrisImagePath(null);
              Alert.alert('Sukses', 'Foto QRIS berhasil dihapus.');
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err?.message || 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  // Multi-Bank Handlers
  const handleOpenAddBankModal = () => {
    setNewBankName('');
    setNewAccountNumber('');
    setNewAccountHolder('');
    setBankModalVisible(true);
  };

  const handleSaveBankAccount = async () => {
    if (!newBankName.trim()) {
      Alert.alert('Perhatian', 'Nama bank wajib diisi atau dipilih dari tombol pilihan cepat.');
      return;
    }
    if (!newAccountNumber.trim()) {
      Alert.alert('Perhatian', 'Nomor rekening wajib diisi.');
      return;
    }
    if (!newAccountHolder.trim()) {
      Alert.alert('Perhatian', 'Nama pemilik rekening (a.n.) wajib diisi.');
      return;
    }

    const newAccount: BankAccount = {
      id: Date.now().toString(),
      bank_name: newBankName.trim(),
      account_number: newAccountNumber.trim(),
      account_holder: newAccountHolder.trim(),
    };

    const updated = [...bankAccounts, newAccount];
    try {
      await withSqliteRetry(() =>
        db.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('bank_accounts', ?)",
          [JSON.stringify(updated)]
        )
      );
      setBankAccounts(updated);
      setBankModalVisible(false);
      setNewBankName('');
      setNewAccountNumber('');
      setNewAccountHolder('');
      Alert.alert('Sukses', `Rekening ${newAccount.bank_name} berhasil didaftarkan.`);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleDeleteBankAccount = (id: string, bankName: string, accNum: string) => {
    Alert.alert(
      'Konfirmasi Hapus Rekening',
      `Apakah Anda yakin ingin menghapus rekening ${bankName} (${accNum}) dari daftar?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const updated = bankAccounts.filter((b) => b.id !== id);
            try {
              await withSqliteRetry(() =>
                db.runAsync(
                  "INSERT OR REPLACE INTO settings (key, value) VALUES ('bank_accounts', ?)",
                  [JSON.stringify(updated)]
                )
              );
              setBankAccounts(updated);
              Alert.alert('Sukses', 'Rekening bank berhasil dihapus.');
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err?.message || 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!storeName.trim()) {
      Alert.alert('Perhatian', 'Nama usaha wajib diisi.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await withSqliteRetry(async () => {
        await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('store_name', ?)", [storeName.trim()]);
        await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('store_address', ?)", [storeAddress.trim()]);
        await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('store_phone', ?)", [storePhone.trim()]);
        await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('receipt_footer', ?)", [receiptFooter.trim()]);
      });
      Alert.alert('Sukses', 'Informasi profil usaha angkringan berhasil disimpan.');
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangeAdminPin = async () => {
    if (newAdminPin.trim().length < 4) {
      Alert.alert('Perhatian', 'PIN Admin minimal terdiri dari 4 hingga 6 digit angka.');
      return;
    }

    try {
      await withSqliteRetry(() =>
        db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_pin', ?)", [
          newAdminPin.trim(),
        ])
      );
      setAdminPin(newAdminPin.trim());
      setNewAdminPin('');
      Alert.alert('Sukses', 'PIN Keamanan Admin / Pemilik berhasil diperbarui.');
    } catch (err: any) {
      Alert.alert('Gagal Mengubah PIN', err.message);
    }
  };

  const handleBackupDatabase = async () => {
    setIsBackingUp(true);
    try {
      const fileUri = await exportDatabaseToJson(db);
      Alert.alert(
        'Cadangan Berhasil Dibuat',
        `Seluruh database lokal (15 tabel) berhasil diexport ke format JSON.\n\nLokasi: ${fileUri}`
      );
    } catch (err: any) {
      Alert.alert('Gagal Cadangkan', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handlePickRestoreFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        setPendingRestoreJson(content);
        setPendingAdminAction('restore_db');
        setAdminPinModalVisible(true);
      }
    } catch (err: any) {
      Alert.alert('Gagal Membaca Berkas', err.message);
    }
  };

  const handleClearDataRequest = () => {
    setPendingAdminAction('clear_data');
    setAdminPinModalVisible(true);
  };

  const handleAdminPinSuccess = async () => {
    setAdminPinModalVisible(false);

    if (pendingAdminAction === 'clear_data') {
      Alert.alert(
        'Konfirmasi Terakhir Reset Data',
        'PERINGATAN: Tindakan ini akan menghapus seluruh data transaksi, item pesanan, absensi, dan mutasi kas. Master menu katalog dan pengaturan tetap tersimpan.\n\nApakah Anda yakin?',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Bersihkan Sekarang',
            style: 'destructive',
            onPress: async () => {
              try {
                await clearTransactionsAndAttendance(db);
                Alert.alert('Selesai', 'Seluruh riwayat transaksi dan absensi berhasil dibersihkan.');
              } catch (err: any) {
                Alert.alert('Gagal Membersihkan Data', err.message);
              }
            },
          },
        ]
      );
    } else if (pendingAdminAction === 'restore_db' && pendingRestoreJson) {
      setIsRestoring(true);
      try {
        const res = await restoreDatabaseFromJson(db, pendingRestoreJson);
        Alert.alert('Pemulihan Sukses', res.message);
        loadSettings();
      } catch (err: any) {
        Alert.alert('Gagal Memulihkan Database', err.message);
      } finally {
        setIsRestoring(false);
        setPendingRestoreJson(null);
      }
    }

    setPendingAdminAction(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Pengaturan & Preferensi Sistem</Text>
          <Text style={styles.headerSubtitle}>
            Profil Usaha, Printer Bluetooth, Backup JSON & Keamanan PIN
          </Text>
        </View>
        <RealtimeClockBadge showDate={false} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Profil Usaha */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Profil Usaha Angkringan</Text>
          <Text style={styles.sectionSubtitle}>
            Informasi toko yang akan tercetak di kepala (header) dan kaki (footer) struk thermal
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Usaha / Angkringan</Text>
            <TextInput
              style={styles.textInput}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Contoh: Angkringan Jogja"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alamat Usaha</Text>
            <TextInput
              style={styles.textInput}
              value={storeAddress}
              onChangeText={setStoreAddress}
              placeholder="Contoh: Jl. Malioboro No. 45, Yogyakarta"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nomor Kontak / WhatsApp</Text>
            <TextInput
              style={styles.textInput}
              value={storePhone}
              onChangeText={setStorePhone}
              placeholder="Contoh: 0812-3456-7890"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pesan Kaki Struk (Footer Message)</Text>
            <TextInput
              style={styles.textInput}
              value={receiptFooter}
              onChangeText={setReceiptFooter}
              placeholder="Contoh: Matur Nuwun Sampun Rawuh!"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.cardActionRow}>
            <Button
              title="Simpan Profil Usaha"
              variant="primary"
              loading={isSavingProfile}
              onPress={handleSaveProfile}
              style={{ minWidth: 160 }}
            />
          </View>
        </Card>

        {/* Section 2: Pembayaran QRIS Toko */}
        <Card style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.sectionTitle}>Pembayaran QRIS Toko (Merchant QRIS)</Text>
              <Text style={styles.sectionSubtitle}>
                Unggah gambar/barcode QRIS toko untuk ditampilkan langsung di layar kasir saat pelanggan membayar via QRIS
              </Text>
            </View>
            <Badge
              label={qrisImagePath ? 'QRIS Aktif' : 'Belum Ada'}
              variant={qrisImagePath ? 'success' : 'neutral'}
            />
          </View>

          {qrisImagePath ? (
            <View style={styles.qrisCardContainer}>
              <View style={styles.qrisImageWrapper}>
                <Image
                  source={{ uri: qrisImagePath }}
                  style={styles.qrisImagePreview}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.qrisInfoWrapper}>
                <Text style={styles.qrisStatusTitle}>Foto QRIS Siap Digunakan</Text>
                <Text style={styles.qrisStatusDesc}>
                  Kasir dapat memunculkan barcode QRIS ini secara penuh agar pelanggan mudah melakukan scan pembayaran dengan semua aplikasi e-wallet (GoPay, OVO, Dana, ShopeePay) & m-Banking.
                </Text>
                <View style={styles.qrisActionBtnRow}>
                  <Button
                    title="Ganti Foto QRIS"
                    variant="outline"
                    size="sm"
                    loading={isPickingQris}
                    onPress={handlePickQrisImage}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Hapus QRIS"
                    variant="danger"
                    size="sm"
                    onPress={handleDeleteQrisImage}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.qrisPlaceholderContainer}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📱</Text>
              <Text style={styles.placeholderTitle}>Belum Ada Foto QRIS Toko</Text>
              <Text style={styles.placeholderSubtitle}>
                Unggah foto stiker atau tangkapan layar barcode QRIS dari BCA, Mandiri, BRI, GoPay, ShopeePay, atau merchant aggregator Anda.
              </Text>
              <Button
                title="+ Pilih Foto QRIS dari Galeri"
                variant="primary"
                loading={isPickingQris}
                onPress={handlePickQrisImage}
                style={{ marginTop: 12 }}
              />
            </View>
          )}
        </Card>

        {/* Section 3: Rekening Bank Toko (Multi-Bank Transfer) */}
        <Card style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.sectionTitle}>Rekening Bank Toko (Multi-Bank Transfer)</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar rekening tujuan transfer untuk mempermudah kasir menampilkan nomor rekening dan pemilik ke pelanggan
              </Text>
            </View>
            <Button
              title="+ Tambah Rekening"
              variant="outline"
              size="sm"
              onPress={handleOpenAddBankModal}
            />
          </View>

          {bankAccounts.length === 0 ? (
            <View style={styles.emptyBankContainer}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>🏦</Text>
              <Text style={styles.placeholderTitle}>Belum Ada Rekening Bank Didaftarkan</Text>
              <Text style={styles.placeholderSubtitle}>
                Daftarkan rekening bank toko (BCA, Mandiri, BRI, BNI, dll) agar kasir dapat memilih rekening saat metode transfer dipilih.
              </Text>
            </View>
          ) : (
            <View style={styles.bankGrid}>
              {bankAccounts.map((account) => (
                <View key={account.id} style={styles.bankItemCard}>
                  <View style={styles.bankItemHeader}>
                    <Badge label={account.bank_name.toUpperCase()} variant="info" size="sm" />
                    <TouchableOpacity
                      onPress={() => handleDeleteBankAccount(account.id, account.bank_name, account.account_number)}
                      style={styles.deleteBankBtn}
                    >
                      <Text style={styles.deleteBankBtnText}>✕ Hapus</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.bankAccountNumber} selectable>{account.account_number}</Text>
                  <Text style={styles.bankAccountHolder}>a.n. {account.account_holder}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Section 4: Multi-Printer Bluetooth */}
        <Card style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Multi-Printer Bluetooth ESC/POS (58mm)</Text>
              <Text style={styles.sectionSubtitle}>
                Routing otomatis struk kasir & struk dapur (tanpa harga)
              </Text>
            </View>
            <Button
              title="Kelola Printer"
              variant="outline"
              size="sm"
              onPress={() => setPrinterModalVisible(true)}
            />
          </View>

          <View style={styles.printerStatusRow}>
            <View style={styles.printerBox}>
              <Text style={styles.printerLabel}>Printer Kasir (Customer):</Text>
              <Text style={styles.printerName}>
                {cashierPrinter ? cashierPrinter.name : 'Belum Ditentukan'}
              </Text>
              <Badge
                label={cashierPrinter ? cashierPrinter.address : 'Tidak Terhubung'}
                variant={cashierPrinter ? 'success' : 'neutral'}
                size="sm"
              />
            </View>

            <View style={styles.printerBox}>
              <Text style={styles.printerLabel}>Printer Kitchen (Dapur):</Text>
              <Text style={styles.printerName}>
                {kitchenPrinter ? kitchenPrinter.name : 'Belum Ditentukan'}
              </Text>
              <Badge
                label={kitchenPrinter ? kitchenPrinter.address : 'Tidak Terhubung'}
                variant={kitchenPrinter ? 'info' : 'neutral'}
                size="sm"
              />
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Otomatis Cetak Struk Kasir saat Selesai Bayar</Text>
              <Text style={styles.toggleSub}>Mencetak struk customer secara langsung tanpa popup</Text>
            </View>
            <Switch
              value={autoPrintCashier}
              onValueChange={setAutoPrintCashier}
              trackColor={{ false: '#d1d5db', true: Colors.primary }}
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Otomatis Cetak Struk Dapur saat Simpan Meja</Text>
              <Text style={styles.toggleSub}>
                Mencetak tiket pesanan dapur / sambungan tanpa nominal harga
              </Text>
            </View>
            <Switch
              value={autoPrintKitchen}
              onValueChange={setAutoPrintKitchen}
              trackColor={{ false: '#d1d5db', true: Colors.primary }}
            />
          </View>
        </Card>

        {/* Section 3: Cadangan & Pemulihan Database JSON */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Cadangkan & Pulihkan Data (100% Offline)</Text>
          <Text style={styles.sectionSubtitle}>
            Simpan cadangan berkas JSON database ke penyimpanan eksternal, Google Drive atau kirim via WA
          </Text>

          <View style={styles.backupButtonsRow}>
            <Button
              title="Cadangkan Database (Export JSON)"
              variant="outline"
              loading={isBackingUp}
              onPress={handleBackupDatabase}
              style={{ flex: 1 }}
            />
            <Button
              title="Pulihkan Database (Import JSON)"
              variant="outline"
              loading={isRestoring}
              onPress={handlePickRestoreFile}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Tip Keamanan: Sangat disarankan untuk mengekspor cadangan JSON seminggu sekali atau
              setiap akhir bulan untuk menjaga seluruh data penjualan, absensi, dan master menu tetap aman.
            </Text>
          </View>
        </Card>

        {/* Section 4: Keamanan PIN Admin */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Keamanan & PIN Otorisasi Pemilik</Text>
          <Text style={styles.sectionSubtitle}>
            PIN 6-digit untuk memproteksi input HPP bulanan, hapus data, dan pembersihan foto absensi
          </Text>

          <View style={styles.pinFormRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>PIN Admin Baru (4 - 6 Digit)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ketik PIN baru..."
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={newAdminPin}
                onChangeText={setNewAdminPin}
              />
            </View>
            <Button
              title="Ubah PIN"
              variant="outline"
              onPress={handleChangeAdminPin}
              style={{ marginTop: 20 }}
            />
          </View>
        </Card>

        {/* Section 5: Zona Bahaya */}
        <Card style={[styles.cardSection, styles.dangerZoneCard]}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>
            Zona Bahaya (Tindakan Terproteksi PIN)
          </Text>
          <Text style={styles.sectionSubtitle}>
            Pembersihan riwayat operasional toko. Lakukan hanya jika sesi operasional telah selesai diaudit.
          </Text>

          <View style={{ marginTop: 10 }}>
            <Button
              title="Bersihkan Seluruh Riwayat Transaksi & Absensi"
              variant="danger"
              onPress={handleClearDataRequest}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Printer Management Modal */}
      <PrinterManagementModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />

      {/* Admin PIN Modal */}
      <AdminPinModal
        visible={adminPinModalVisible}
        title="Otorisasi PIN Pemilik"
        description="Masukkan PIN Admin untuk memverifikasi tindakan terproteksi ini"
        onClose={() => {
          setAdminPinModalVisible(false);
          setPendingAdminAction(null);
        }}
        onSuccess={handleAdminPinSuccess}
      />

      {/* Modal Tambah Rekening Bank */}
      <Modal
        visible={bankModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.bankModalCard}>
            <View style={styles.bankModalHeader}>
              <View>
                <Text style={styles.bankModalTitle}>Tambah Rekening Bank Toko</Text>
                <Text style={styles.bankModalSubtitle}>
                  Daftarkan nomor rekening tujuan transfer pembayaran
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBankModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕ Batal</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Pilihan Bank Populer:</Text>
            <View style={styles.presetBankRow}>
              {['BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'BCA Syariah', 'CIMB Niaga'].map((bank) => (
                <TouchableOpacity
                  key={bank}
                  style={[
                    styles.presetBankChip,
                    newBankName.toUpperCase() === bank.toUpperCase() && styles.presetBankChipActive,
                  ]}
                  onPress={() => setNewBankName(bank)}
                >
                  <Text
                    style={[
                      styles.presetBankChipText,
                      newBankName.toUpperCase() === bank.toUpperCase() && styles.presetBankChipTextActive,
                    ]}
                  >
                    {bank}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Bank / Dompet Digital</Text>
              <TextInput
                style={styles.textInput}
                value={newBankName}
                onChangeText={setNewBankName}
                placeholder="Contoh: BCA / Mandiri / SeaBank"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nomor Rekening</Text>
              <TextInput
                style={styles.textInput}
                value={newAccountNumber}
                onChangeText={setNewAccountNumber}
                placeholder="Contoh: 1234567890"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Pemilik Rekening (Atas Nama / a.n.)</Text>
              <TextInput
                style={styles.textInput}
                value={newAccountHolder}
                onChangeText={setNewAccountHolder}
                placeholder="Contoh: Angkringan Jogja / Budi Santoso"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.bankModalActionRow}>
              <Button
                title="Batal"
                variant="ghost"
                onPress={() => setBankModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Simpan Rekening"
                variant="primary"
                onPress={handleSaveBankAccount}
                style={{ flex: 1.5 }}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  cardSection: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  printerStatusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  printerBox: {
    flex: 1,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  printerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  printerName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  backupButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  infoBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoText: {
    fontSize: 11,
    color: Colors.primaryDark,
    lineHeight: 16,
  },
  pinFormRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  dangerZoneCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    backgroundColor: '#fef2f2',
  },
  // QRIS Styles
  qrisCardContainer: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'center',
  },
  qrisImageWrapper: {
    width: 140,
    height: 140,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  qrisImagePreview: {
    width: '100%',
    height: '100%',
  },
  qrisInfoWrapper: {
    flex: 1,
    gap: 6,
  },
  qrisStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  qrisStatusDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  qrisActionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  qrisPlaceholderContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  placeholderSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 400,
    lineHeight: 16,
  },
  // Multi-Bank Styles
  emptyBankContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bankItemCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
  },
  bankItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteBankBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: Colors.dangerBg,
  },
  deleteBankBtnText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '700',
  },
  bankAccountNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 1,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  bankAccountHolder: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  bankModalCard: {
    width: '100%',
    maxWidth: 520,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  bankModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  bankModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  bankModalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  modalCloseBtnText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  presetBankRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  presetBankChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBankChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  presetBankChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  presetBankChipTextActive: {
    color: Colors.primaryDark,
  },
  bankModalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
});
