import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { useTransactionStore, PendingOrderSummary } from '../stores/transactionStore';
import { withSqliteRetry } from '../services/database';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { formatRupiahDisplay } from '../utils/formatRupiah';
import { getBusinessDate } from '../utils/sessionHelper';
import { PrintReceiptData } from '../services/print';
import { ReceiptPreviewModal } from './receipt-preview-modal';

export interface CustomTable {
  id: string;
  name: string;
  type?: string;
}

export const DEFAULT_PRESET_TABLES: CustomTable[] = [
  { id: 't1', name: 'Meja 01', type: 'meja' },
  { id: 't2', name: 'Meja 02', type: 'meja' },
  { id: 't3', name: 'Meja 03', type: 'meja' },
  { id: 't4', name: 'Meja 04', type: 'meja' },
  { id: 't5', name: 'Meja 05', type: 'meja' },
  { id: 't6', name: 'Meja 06', type: 'meja' },
  { id: 't7', name: 'Meja 07', type: 'meja' },
  { id: 't8', name: 'Meja 08', type: 'meja' },
  { id: 't9', name: 'Meja 09', type: 'meja' },
  { id: 't10', name: 'Meja 10', type: 'meja' },
  { id: 't11', name: 'Lesehan 01', type: 'lesehan' },
  { id: 't12', name: 'Lesehan 02', type: 'lesehan' },
  { id: 't13', name: 'Lesehan 03', type: 'lesehan' },
  { id: 't14', name: 'Lesehan 04', type: 'lesehan' },
  { id: 't15', name: 'Lesehan 05', type: 'lesehan' },
  { id: 't16', name: 'Bungkus / Take-away', type: 'other' },
];

export function detectTableType(name: string): 'meja' | 'lesehan' | 'other' {
  const lower = name.toLowerCase();
  if (lower.includes('lesehan')) return 'lesehan';
  if (lower.includes('meja')) return 'meja';
  return 'other';
}

export function parseCustomTables(jsonString: string | null | undefined): CustomTable[] {
  if (!jsonString) return DEFAULT_PRESET_TABLES;
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PRESET_TABLES;
    }
    return parsed.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `t_${idx + 1}`,
          name: item.trim(),
          type: detectTableType(item),
        };
      }
      const rawName = String(item.name || `Meja ${idx + 1}`).trim();
      const type: string =
        item.type !== undefined && item.type !== null && String(item.type).trim() !== ''
          ? String(item.type).trim()
          : detectTableType(rawName);
      return {
        id: String(item.id || `t_${idx + 1}`),
        name: rawName,
        type,
      };
    });
  } catch {
    return DEFAULT_PRESET_TABLES;
  }
}

export function validateTableName(
  name: string,
  existingTables: CustomTable[],
  excludeId?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Nama meja wajib diisi.' };
  }
  const isDuplicate = existingTables.some(
    (t) => t.id !== excludeId && t.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    return { valid: false, error: `Meja dengan nama "${trimmed}" sudah terdaftar.` };
  }
  return { valid: true };
}

interface TableSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TableSelectorModal({ visible, onClose }: TableSelectorModalProps) {
  const db = useSQLiteContext();
  const {
    tableNumber,
    setTableNumber,
    pendingOrders,
    openPendingOrder,
    mergeTables,
    storeProfile,
    markTableAsBilling,
    loadPendingOrders,
  } = useTransactionStore();

  const [activeTab, setActiveTab] = useState<'pilih' | 'pending' | 'gabung'>('pilih');
  const [tables, setTables] = useState<CustomTable[]>(DEFAULT_PRESET_TABLES);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isManageMode, setIsManageMode] = useState(false);

  // Form Tambah / Edit Meja
  const [tableFormVisible, setTableFormVisible] = useState(false);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [formTableId, setFormTableId] = useState('');
  const [formTableName, setFormTableName] = useState('');
  const [formTableType, setFormTableType] = useState<string>('');
  const [isSavingTable, setIsSavingTable] = useState(false);

  const [customTable, setCustomTable] = useState('');
  const [selectedPendingForMerge, setSelectedPendingForMerge] = useState<number[]>([]);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [tempBillData, setTempBillData] = useState<PrintReceiptData | null>(null);
  const [tempBillModalVisible, setTempBillModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCustomTables();
      loadPendingOrders(db).catch(() => {});
    }
  }, [visible]);

  const loadCustomTables = async () => {
    try {
      const row = await withSqliteRetry(() =>
        db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'custom_tables'")
      );
      const loaded = parseCustomTables(row?.value);
      setTables(loaded);
    } catch (err) {
      console.error('Error loading custom tables from settings:', err);
      setTables(DEFAULT_PRESET_TABLES);
    }
  };

  const saveCustomTables = async (newTables: CustomTable[]) => {
    try {
      const jsonStr = JSON.stringify(newTables);
      await withSqliteRetry(() =>
        db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('custom_tables', ?)", [jsonStr])
      );
      setTables(newTables);
    } catch (err: any) {
      console.error('Error saving custom tables:', err);
      Alert.alert('Gagal', err?.message || 'Gagal menyimpan konfigurasi meja ke database');
    }
  };

  const handleOpenAddTable = () => {
    setIsEditingTable(false);
    setFormTableId('');
    setFormTableName('');
    setFormTableType('');
    setTableFormVisible(true);
  };

  const handleOpenEditTable = (t: CustomTable) => {
    setIsEditingTable(true);
    setFormTableId(t.id);
    setFormTableName(t.name);
    setFormTableType(t.type || '');
    setTableFormVisible(true);
  };

  const handleSaveTable = async () => {
    const name = formTableName.trim();
    const val = validateTableName(name, tables, isEditingTable ? formTableId : undefined);
    if (!val.valid) {
      Alert.alert('Perhatian', val.error || 'Nama meja tidak valid.');
      return;
    }

    setIsSavingTable(true);
    try {
      if (isEditingTable) {
        const oldTable = tables.find((t) => t.id === formTableId);
        const oldName = oldTable ? oldTable.name : '';

        if (oldName && oldName !== name) {
          // Sinkronisasi otomatis transaksi pending & billing saat nama meja diubah
          await withSqliteRetry(() =>
            db.runAsync(
              "UPDATE transactions SET table_number = ? WHERE table_number = ? AND status IN ('pending', 'billing')",
              [name, oldName]
            )
          );

          if (tableNumber === oldName) {
            setTableNumber(name);
          }
          await loadPendingOrders(db);
        }

        const updated = tables.map((t) =>
          t.id === formTableId ? { ...t, name, type: formTableType } : t
        );
        await saveCustomTables(updated);
        setTableFormVisible(false);
        Alert.alert('Sukses', `Meja "${name}" berhasil diperbarui.`);
      } else {
        const newTable: CustomTable = {
          id: `tbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name,
          type: formTableType,
        };
        const updated = [...tables, newTable];
        await saveCustomTables(updated);
        setTableFormVisible(false);
        Alert.alert('Sukses', `Meja "${name}" berhasil ditambahkan.`);
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Terjadi kesalahan saat menyimpan meja');
    } finally {
      setIsSavingTable(false);
    }
  };

  const handleDeleteTable = async (t: CustomTable) => {
    try {
      // Pencegahan: Larang menghapus meja yang sedang memiliki pesanan aktif (pending/billing)
      const activeTx = await withSqliteRetry(() =>
        db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM transactions WHERE table_number = ? AND status IN ('pending', 'billing')",
          [t.name]
        )
      );
      const hasActiveOrder =
        (activeTx?.count ?? 0) > 0 ||
        pendingOrders.some((p) => p.table_number.toLowerCase() === t.name.toLowerCase());

      if (hasActiveOrder) {
        Alert.alert(
          'Tidak Dapat Dihapus',
          `Meja "${t.name}" sedang digunakan oleh transaksi aktif (pending/siap bayar). Selesaikan atau batalkan pesanan tersebut sebelum menghapus meja.`
        );
        return;
      }

      Alert.alert(
        'Konfirmasi Hapus Meja',
        `Apakah Anda yakin ingin menghapus "${t.name}" dari master meja?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus Meja',
            style: 'destructive',
            onPress: async () => {
              try {
                const updated = tables.filter((item) => item.id !== t.id);
                await saveCustomTables(updated);
                if (tableNumber === t.name) {
                  setTableNumber(updated[0]?.name || 'Meja 01');
                }
                Alert.alert('Sukses', `Meja "${t.name}" berhasil dihapus.`);
              } catch (err: any) {
                Alert.alert('Gagal', err?.message || 'Gagal menghapus meja');
              }
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Terjadi kesalahan sistem saat memeriksa meja');
    }
  };

  const handleCardLongPress = (t: CustomTable) => {
    Alert.alert(`Kelola Meja: ${t.name}`, 'Pilih tindakan untuk meja ini:', [
      { text: 'Batal', style: 'cancel' },
      {
        text: '✏️ Edit Nama / Tipe',
        onPress: () => handleOpenEditTable(t),
      },
      {
        text: '🗑️ Hapus Meja',
        style: 'destructive',
        onPress: () => handleDeleteTable(t),
      },
    ]);
  };

  const handleSelectTable = (name: string) => {
    setTableNumber(name);
    onClose();
  };

  const handleOpenPending = async (order: PendingOrderSummary) => {
    try {
      await openPendingOrder(db, order.id);
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal membuka pesanan meja');
    }
  };

  const handleTemporaryBill = async (order: PendingOrderSummary) => {
    try {
      const items = await db.getAllAsync<any>(
        'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC',
        [order.id]
      );
      const tx = await db.getFirstAsync<any>(
        'SELECT tax_amount, discount_amount, cashier_name, business_date FROM transactions WHERE id = ?',
        [order.id]
      );

      await markTableAsBilling(db, order.id);

      const billPayload: PrintReceiptData = {
        storeName: storeProfile.storeName,
        storeAddress: storeProfile.storeAddress,
        storePhone: storeProfile.storePhone,
        receiptFooter: storeProfile.receiptFooter,
        invoiceNumber: order.invoice_number,
        businessDate: tx?.business_date || getBusinessDate(),
        dateTimeString: order.created_at,
        tableNumber: order.table_number,
        customerName: order.customer_name,
        cashierName: tx?.cashier_name || 'Kasir',
        items: (items || []).map((i) => ({
          name: i.menu_name,
          price: i.price,
          qty: i.qty,
          subtotal: i.subtotal,
          is_additional: i.is_additional,
        })),
        subtotal: order.subtotal,
        taxAmount: tx?.tax_amount || 0,
        discountAmount: tx?.discount_amount || 0,
        total: order.total,
        paymentMethod: 'tagihan_sementara',
        paymentAmount: 0,
        changeAmount: 0,
      };

      setTempBillData(billPayload);
      setTempBillModalVisible(true);
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal memproses tagihan sementara');
    }
  };

  const toggleMergeSelection = (id: number) => {
    if (selectedPendingForMerge.includes(id)) {
      setSelectedPendingForMerge(selectedPendingForMerge.filter((item) => item !== id));
    } else {
      setSelectedPendingForMerge([...selectedPendingForMerge, id]);
    }
  };

  const handleExecuteMerge = async () => {
    if (selectedPendingForMerge.length < 2) {
      Alert.alert('Perhatian', 'Pilih minimal 2 meja pending untuk digabung.');
      return;
    }

    const targetName = mergeTargetName.trim() || 'Gabungan Meja';
    try {
      const mergedId = await mergeTables(db, selectedPendingForMerge, targetName);
      await openPendingOrder(db, mergedId);
      Alert.alert('Sukses', `Berhasil menggabungkan tagihan menjadi "${targetName}".`);
      setSelectedPendingForMerge([]);
      setMergeTargetName('');
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal menggabungkan meja');
    }
  };

  // Kalkulasi filter & badge counter
  const allCount = tables.length;
  const occupiedCount = pendingOrders.length;
  const uniqueTypes = Array.from(
    new Set(
      tables
        .map((t) => (t.type ? t.type.trim() : ''))
        .filter((typ) => typ.length > 0)
    )
  );

  const getFilteredTables = (): CustomTable[] => {
    if (categoryFilter === 'all') {
      return tables;
    }
    if (categoryFilter === 'occupied') {
      const matched = tables.filter((t) =>
        pendingOrders.some((p) => p.table_number.toLowerCase() === t.name.toLowerCase())
      );
      // Sertakan juga nama meja ad-hoc yang sedang aktif pending bila belum ada di master
      pendingOrders.forEach((p) => {
        if (!matched.some((t) => t.name.toLowerCase() === p.table_number.toLowerCase())) {
          matched.push({
            id: `pending_${p.id}`,
            name: p.table_number,
            type: detectTableType(p.table_number),
          });
        }
      });
      return matched;
    }
    return tables.filter(
      (t) => (t.type || '').trim().toLowerCase() === categoryFilter.toLowerCase()
    );
  };

  const filteredTables = getFilteredTables();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header Modal */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.title}>Pilih & Kelola Meja</Text>
              <Text style={styles.subtitle}>Nomor meja aktif saat ini: {tableNumber}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Main Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'pilih' && styles.tabItemActive]}
              onPress={() => setActiveTab('pilih')}
            >
              <Text style={[styles.tabText, activeTab === 'pilih' && styles.tabTextActive]}>
                Pilih Meja
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'pending' && styles.tabItemActive]}
              onPress={() => setActiveTab('pending')}
            >
              <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
                Meja Pending ({pendingOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'gabung' && styles.tabItemActive]}
              onPress={() => setActiveTab('gabung')}
            >
              <Text style={[styles.tabText, activeTab === 'gabung' && styles.tabTextActive]}>
                Gabung Meja
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: PILIH MEJA (DENGAN CRUD & FILTER) */}
          {activeTab === 'pilih' && (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Header Pengelolaan Meja Dinamis */}
              <View style={styles.tableListHeader}>
                <Text style={styles.sectionLabel}>Daftar Meja & Lesehan:</Text>
                <View style={styles.tableHeaderButtons}>
                  <Button
                    title="+ Tambah Meja"
                    variant="primary"
                    size="sm"
                    onPress={handleOpenAddTable}
                  />
                  <Button
                    title={isManageMode ? '✓ Selesai' : '⚙️ Kelola Meja'}
                    variant={isManageMode ? 'secondary' : 'outline'}
                    size="sm"
                    onPress={() => setIsManageMode(!isManageMode)}
                  />
                </View>
              </View>

              {/* Sub-Tab Kategori Filter Meja Dinamis */}
              <View style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[styles.filterPill, categoryFilter === 'all' && styles.filterPillActive]}
                  onPress={() => setCategoryFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      categoryFilter === 'all' && styles.filterPillTextActive,
                    ]}
                  >
                    Semua ({allCount})
                  </Text>
                </TouchableOpacity>

                {uniqueTypes.map((typ) => {
                  const count = tables.filter(
                    (t) => (t.type || '').trim().toLowerCase() === typ.toLowerCase()
                  ).length;
                  const isActive = categoryFilter.toLowerCase() === typ.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={typ}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                      onPress={() => setCategoryFilter(typ)}
                    >
                      <Text
                        style={[styles.filterPillText, isActive && styles.filterPillTextActive]}
                      >
                        {typ} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    categoryFilter === 'occupied' && styles.filterPillActive,
                  ]}
                  onPress={() => setCategoryFilter('occupied')}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      categoryFilter === 'occupied' && styles.filterPillTextActive,
                    ]}
                  >
                    Terisi / Billing ({occupiedCount})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Grid Kartu Meja Dinamis */}
              <View style={styles.gridContainer}>
                {filteredTables.map((t) => {
                  const tName = t.name;
                  const isCurrent = tableNumber === tName;
                  const pendingOrder = pendingOrders.find(
                    (p) => p.table_number.toLowerCase() === tName.toLowerCase()
                  );
                  const isBilling = pendingOrder?.status === 'billing';
                  const isOccupied = !!pendingOrder && !isBilling;
                  const isEmpty = !pendingOrder;

                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.tableCard,
                        isCurrent && styles.tableCardCurrent,
                        isOccupied && styles.tableCardPending,
                        isBilling && styles.tableCardBilling,
                      ]}
                      onPress={() => {
                        if (isManageMode) {
                          handleOpenEditTable(t);
                        } else if (pendingOrder) {
                          handleOpenPending(pendingOrder);
                        } else {
                          handleSelectTable(tName);
                        }
                      }}
                      onLongPress={() => handleCardLongPress(t)}
                      activeOpacity={0.7}
                    >
                      {/* Tombol pintas edit pada pojok atas kartu */}
                      {!isManageMode && (
                        <TouchableOpacity
                          style={styles.cardCornerEditBtn}
                          onPress={() => handleOpenEditTable(t)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.cardCornerEditText}>✏️</Text>
                        </TouchableOpacity>
                      )}

                      <Text
                        style={[
                          styles.tableName,
                          isCurrent && styles.tableNameCurrent,
                          isOccupied && styles.tableNamePending,
                          isBilling && styles.tableNameBilling,
                        ]}
                        numberOfLines={1}
                      >
                        {tName}
                      </Text>

                      {/* Status Badges */}
                      {isEmpty && (
                        <Badge label="Kosong" variant="success" size="sm" style={{ marginTop: 4 }} />
                      )}
                      {isOccupied && (
                        <Badge label="Terisi" variant="warning" size="sm" style={{ marginTop: 4 }} />
                      )}
                      {isBilling && (
                        <Badge label="Siap Bayar" variant="info" size="sm" style={{ marginTop: 4 }} />
                      )}

                      {/* Kontrol Aksi Meja saat Mode Kelola Aktif */}
                      {isManageMode && (
                        <View style={styles.cardManageActions}>
                          <TouchableOpacity
                            style={styles.manageActionBtnEdit}
                            onPress={() => handleOpenEditTable(t)}
                          >
                            <Text style={styles.manageActionBtnEditText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.manageActionBtnDelete}
                            onPress={() => handleDeleteTable(t)}
                          >
                            <Text style={styles.manageActionBtnDeleteText}>Hapus</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredTables.length === 0 && (
                <View style={styles.emptyFilteredContainer}>
                  <Text style={styles.emptyFilteredText}>
                    {categoryFilter === 'occupied'
                      ? 'Tidak ada meja yang sedang terisi atau siap bayar.'
                      : 'Belum ada meja dalam kategori ini.'}
                  </Text>
                </View>
              )}

              {/* Input Ad-Hoc Meja Khusus */}
              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                Atau Ketik Nama/Nomor Meja Khusus:
              </Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customTable}
                  onChangeText={setCustomTable}
                  placeholder="Contoh: Meja VIP Depan / Meja 12"
                  placeholderTextColor={Colors.placeholder}
                />
                <Button
                  title="Gunakan"
                  variant="primary"
                  size="md"
                  disabled={!customTable.trim()}
                  onPress={() => handleSelectTable(customTable.trim())}
                />
              </View>
            </ScrollView>
          )}

          {/* TAB 2: MEJA PENDING AKTIF */}
          {activeTab === 'pending' && (
            <ScrollView style={{ maxHeight: 380 }}>
              {pendingOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Tidak ada transaksi meja pending saat ini.</Text>
                </View>
              ) : (
                pendingOrders.map((order) => (
                  <View key={order.id} style={styles.pendingCardWrapper}>
                    <View style={styles.pendingCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.pendingTableName}>{order.table_number}</Text>
                          {order.status === 'billing' ? (
                            <Badge label="Siap Bayar / Billing" variant="info" size="sm" />
                          ) : (
                            <Badge label="Terisi" variant="warning" size="sm" />
                          )}
                        </View>
                        <Text style={styles.pendingSub}>
                          {order.invoice_number} • {order.customer_name} • {order.item_count} menu
                        </Text>
                      </View>
                      <Text style={styles.pendingTotal}>{formatRupiahDisplay(order.total)}</Text>
                    </View>
                    <View style={styles.pendingActionsRow}>
                      <Button
                        title="📋 Tagihan Sementara"
                        variant="outline"
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => handleTemporaryBill(order)}
                      />
                      <Button
                        title="Buka Pesanan →"
                        variant="primary"
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => handleOpenPending(order)}
                      />
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* TAB 3: GABUNG MEJA (MERGE TABLES) */}
          {activeTab === 'gabung' && (
            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={styles.sectionLabel}>
                Pilih minimal 2 meja pending yang akan disatukan tagihannya:
              </Text>

              {pendingOrders.length < 2 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Dibutuhkan minimal 2 transaksi pending aktif untuk melakukan penggabungan meja.
                  </Text>
                </View>
              ) : (
                <>
                  {pendingOrders.map((order) => {
                    const isSelected = selectedPendingForMerge.includes(order.id);
                    return (
                      <TouchableOpacity
                        key={order.id}
                        style={[styles.mergeCard, isSelected && styles.mergeCardSelected]}
                        onPress={() => toggleMergeSelection(order.id)}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.pendingTableName}>{order.table_number}</Text>
                          <Text style={styles.pendingSub}>
                            {order.customer_name} • {order.item_count} menu
                          </Text>
                        </View>
                        <Text style={styles.pendingTotal}>{formatRupiahDisplay(order.total)}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
                    Nama Meja Gabungan Baru:
                  </Text>
                  <TextInput
                    style={styles.customInput}
                    value={mergeTargetName}
                    onChangeText={setMergeTargetName}
                    placeholder="Contoh: Meja 05-08 Rombongan"
                    placeholderTextColor={Colors.placeholder}
                  />

                  <Button
                    title={`Gabung ${selectedPendingForMerge.length} Meja Terpilih`}
                    variant="primary"
                    size="md"
                    style={{ marginTop: 14 }}
                    disabled={selectedPendingForMerge.length < 2}
                    onPress={handleExecuteMerge}
                  />
                </>
              )}
            </ScrollView>
          )}

          {/* MODAL / DIALOG FORM TAMBAH & EDIT MEJA */}
          {tableFormVisible && (
            <View style={styles.formDialogOverlay}>
              <Card style={styles.formDialogCard}>
                <View style={styles.formDialogHeader}>
                  <Text style={styles.formDialogTitle}>
                    {isEditingTable ? 'Edit Meja' : '+ Tambah Meja Baru'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTableFormVisible(false)}
                    style={styles.closeBtn}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nama / Nomor Meja</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formTableName}
                    onChangeText={setFormTableName}
                    placeholder="Contoh: Meja 11, Lesehan 06, Gazebo VIP"
                    placeholderTextColor={Colors.placeholder}
                    autoFocus
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Tipe / Area Meja (Opsional / Bebas)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formTableType}
                    onChangeText={setFormTableType}
                    placeholder="Contoh: Lesehan, Outdoor, VIP, Lantai 2..."
                    placeholderTextColor={Colors.placeholder}
                  />
                </View>

                {isEditingTable && (
                  <Text style={styles.formHelpText}>
                    ℹ️ Mengubah nama meja otomatis memperbarui nota pending & billing yang sedang berjalan di meja ini.
                  </Text>
                )}

                <View style={styles.formActionsRow}>
                  <Button
                    title="Batal"
                    variant="outline"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => setTableFormVisible(false)}
                  />
                  <Button
                    title={isEditingTable ? 'Simpan Perubahan' : 'Tambah Meja'}
                    variant="primary"
                    size="md"
                    style={{ flex: 1 }}
                    loading={isSavingTable}
                    onPress={handleSaveTable}
                  />
                </View>
              </Card>
            </View>
          )}

          {/* Modal Pratinjau Tagihan Sementara */}
          <ReceiptPreviewModal
            visible={tempBillModalVisible}
            data={tempBillData}
            initialTab="temp_bill"
            onClose={() => setTempBillModalVisible(false)}
          />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    position: 'relative',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    padding: 3,
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 5,
  },
  tabItemActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  tableListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tableHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 76,
  },
  tableCardCurrent: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  tableCardPending: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningBg,
  },
  tableCardBilling: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  tableName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  tableNameCurrent: {
    color: Colors.primaryDark,
  },
  tableNamePending: {
    color: Colors.warning,
  },
  tableNameBilling: {
    color: '#1d4ed8',
  },
  cardCornerEditBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 3,
    opacity: 0.7,
  },
  cardCornerEditText: {
    fontSize: 10,
  },
  cardManageActions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    width: '100%',
  },
  manageActionBtnEdit: {
    flex: 1,
    backgroundColor: Colors.borderLight,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
  },
  manageActionBtnEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  manageActionBtnDelete: {
    flex: 1,
    backgroundColor: Colors.dangerBg,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
  },
  manageActionBtnDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
  },
  emptyFilteredContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFilteredText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  pendingCardWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pendingActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  customRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  customInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  pendingTableName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  pendingSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pendingTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  mergeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  mergeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: Colors.borderActive,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  // Dialog Form Tambah / Edit Meja
  formDialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    zIndex: 100,
  },
  formDialogCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 20,
  },
  formDialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  formDialogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  formHelpText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 14,
    lineHeight: 16,
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
