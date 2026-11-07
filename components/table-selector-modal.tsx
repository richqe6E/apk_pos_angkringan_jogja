import React, { useState } from 'react';
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
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { formatRupiahDisplay } from '../utils/formatRupiah';

interface TableSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_TABLES = [
  'Meja 01', 'Meja 02', 'Meja 03', 'Meja 04', 'Meja 05',
  'Meja 06', 'Meja 07', 'Meja 08', 'Meja 09', 'Meja 10',
  'Lesehan 01', 'Lesehan 02', 'Lesehan 03', 'Lesehan 04', 'Lesehan 05',
  'Bungkus / Take-away'
];

export function TableSelectorModal({ visible, onClose }: TableSelectorModalProps) {
  const db = useSQLiteContext();
  const {
    tableNumber,
    setTableNumber,
    pendingOrders,
    openPendingOrder,
    mergeTables,
  } = useTransactionStore();

  const [activeTab, setActiveTab] = useState<'pilih' | 'pending' | 'gabung'>('pilih');
  const [customTable, setCustomTable] = useState('');
  const [selectedPendingForMerge, setSelectedPendingForMerge] = useState<number[]>([]);
  const [mergeTargetName, setMergeTargetName] = useState('');

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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.title}>Pilih & Kelola Meja</Text>
              <Text style={styles.subtitle}>Nomor meja aktif saat ini: {tableNumber}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Tabs */}
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

          {/* Tab 1: Pilih Meja */}
          {activeTab === 'pilih' && (
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.sectionLabel}>Daftar Meja & Lesehan:</Text>
              <View style={styles.gridContainer}>
                {PRESET_TABLES.map((tName) => {
                  const isCurrent = tableNumber === tName;
                  const hasPending = pendingOrders.some((p) => p.table_number === tName);

                  return (
                    <TouchableOpacity
                      key={tName}
                      style={[
                        styles.tableCard,
                        isCurrent && styles.tableCardCurrent,
                        hasPending && styles.tableCardPending,
                      ]}
                      onPress={() => handleSelectTable(tName)}
                    >
                      <Text
                        style={[
                          styles.tableName,
                          isCurrent && styles.tableNameCurrent,
                          hasPending && styles.tableNamePending,
                        ]}
                      >
                        {tName}
                      </Text>
                      {hasPending && (
                        <Badge label="Pending" variant="warning" size="sm" style={{ marginTop: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Atau Ketik Nama/Nomor Meja Khusus:</Text>
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

          {/* Tab 2: Meja Pending Aktif */}
          {activeTab === 'pending' && (
            <ScrollView style={{ maxHeight: 360 }}>
              {pendingOrders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Tidak ada transaksi meja pending saat ini.</Text>
                </View>
              ) : (
                pendingOrders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.pendingItemCard}
                    onPress={() => handleOpenPending(order)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.pendingTableName}>{order.table_number}</Text>
                        <Badge label="Belum Dibayar" variant="warning" size="sm" />
                      </View>
                      <Text style={styles.pendingSub}>
                        {order.invoice_number} • {order.customer_name} • {order.item_count} menu
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.pendingTotal}>{formatRupiahDisplay(order.total)}</Text>
                      <Text style={styles.pendingActionText}>Buka Tagihan →</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {/* Tab 3: Gabung Meja (Merge Table) */}
          {activeTab === 'gabung' && (
            <ScrollView style={{ maxHeight: 360 }}>
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
                        style={[
                          styles.mergeCard,
                          isSelected && styles.mergeCardSelected,
                        ]}
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
    maxWidth: 580,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
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
    marginBottom: 16,
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 10,
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
  },
  tableCardCurrent: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  tableCardPending: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningBg,
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
  customRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
  pendingItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#ffffff',
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
  pendingActionText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
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
});

