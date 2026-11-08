import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AppIcon } from '../components/ui/app-icon';
import { formatRupiahDisplay } from '../utils/formatRupiah';
import {
  Supplier,
  PurchaseRecord,
  usePurchaseStore,
} from '../stores/purchaseStore';
import { PurchaseFormModal } from '../components/purchase-form-modal';
import { SupplierModal } from '../components/supplier-modal';

type FilterType = 'all' | 'cash' | 'tempo_unpaid' | 'tempo_paid';
type MainTab = 'purchases' | 'suppliers';

export default function PurchasesScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const {
    suppliers,
    purchases,
    totalUnpaidDebt,
    isLoading,
    loadSuppliers,
    loadPurchases,
    settleTempoDebt,
    deletePurchase,
    deleteSupplier,
  } = usePurchaseStore();

  const [activeTab, setActiveTab] = useState<MainTab>('purchases');
  const [filter, setFilter] = useState<FilterType>('all');
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    loadSuppliers(db);
    loadPurchases(db);
  }, [db]);

  const totalSpentAll = purchases.reduce((sum, p) => sum + p.total_amount, 0);

  const filteredPurchases = purchases.filter((p) => {
    if (filter === 'cash') return p.payment_type === 'cash';
    if (filter === 'tempo_unpaid') return p.payment_type === 'tempo' && p.payment_status === 'unpaid';
    if (filter === 'tempo_paid') return p.payment_type === 'tempo' && p.payment_status === 'paid';
    return true;
  });

  const handleSettleDebt = (p: PurchaseRecord) => {
    Alert.alert(
      'Lunasi Hutang Pembelian?',
      `Konfirmasi pelunasan nota #${p.id} kepada ${p.supplier_name} senilai ${formatRupiahDisplay(p.total_amount)}.\n\nNominal ini akan otomatis dicatat sebagai pengeluaran kas operasional saat ini.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lunasi Sekarang',
          style: 'default',
          onPress: async () => {
            try {
              await settleTempoDebt(db, p.id);
              Alert.alert('Sukses', `Hutang kepada ${p.supplier_name} berhasil dilunasi.`);
            } catch (err: any) {
              Alert.alert('Gagal Melunasi', err.message || 'Terjadi kesalahan sistem.');
            }
          },
        },
      ]
    );
  };

  const handleDeletePurchase = (p: PurchaseRecord) => {
    Alert.alert(
      'Hapus Catatan Pembelian?',
      `Yakin ingin menghapus riwayat pembelian #${p.id} dari ${p.supplier_name}? Catatan kas terkait (jika ada) juga akan dihapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurchase(db, p.id);
              Alert.alert('Sukses', 'Riwayat pembelian berhasil dihapus.');
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message || 'Gagal menghapus riwayat pembelian.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSupplier = (s: Supplier) => {
    if ((s.unpaid_debt || 0) > 0) {
      Alert.alert(
        'Tidak Dapat Dihapus',
        `Supplier ${s.name} masih memiliki sisa hutang tempo belum lunas senilai ${formatRupiahDisplay(s.unpaid_debt || 0)}.`
      );
      return;
    }

    Alert.alert(
      'Hapus Data Supplier?',
      `Yakin ingin menghapus ${s.name} dari master supplier?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSupplier(db, s.id);
              Alert.alert('Sukses', `Data supplier ${s.name} berhasil dihapus.`);
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message || 'Gagal menghapus data supplier.');
            }
          },
        },
      ]
    );
  };

  const renderPurchasesTab = () => (
    <View style={styles.tabContentArea}>
      {/* Filter Tabs Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Semua ({purchases.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'cash' && styles.filterPillActive]}
          onPress={() => setFilter('cash')}
        >
          <Text style={[styles.filterText, filter === 'cash' && styles.filterTextActive]}>
            Tunai / Kas Langsung
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'tempo_unpaid' && styles.filterPillActive]}
          onPress={() => setFilter('tempo_unpaid')}
        >
          <Text style={[styles.filterText, filter === 'tempo_unpaid' && styles.filterTextActive]}>
            Tempo Belum Lunas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'tempo_paid' && styles.filterPillActive]}
          onPress={() => setFilter('tempo_paid')}
        >
          <Text style={[styles.filterText, filter === 'tempo_paid' && styles.filterTextActive]}>
            Tempo Lunas
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredPurchases}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listPadding}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Tidak ada catatan pembelian pada kategori ini.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isTempo = item.payment_type === 'tempo';
          const isUnpaid = isTempo && item.payment_status === 'unpaid';

          return (
            <Card style={[styles.purchaseCard, isUnpaid && styles.purchaseCardUnpaid]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.supplierTitleRow}>
                    <Text style={styles.supplierTitle}>{item.supplier_name}</Text>
                    {isTempo ? (
                      isUnpaid ? (
                        <Badge label="Tempo (Hutang Belum Lunas)" variant="danger" size="sm" />
                      ) : (
                        <Badge label="Tempo (Sudah Lunas)" variant="neutral" size="sm" />
                      )
                    ) : (
                      <Badge label="Tunai (Lunas)" variant="success" size="sm" />
                    )}
                  </View>
                  <Text style={styles.purchaseMeta}>
                    Tgl Operasional: {item.business_date} • Nota #{item.id}
                  </Text>
                </View>

                <Text style={styles.purchaseAmount}>
                  {formatRupiahDisplay(item.total_amount)}
                </Text>
              </View>

              {/* Notes & Due Date */}
              <View style={styles.detailsRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  {item.notes ? (
                    <Text style={styles.notesText}>Keterangan: {item.notes}</Text>
                  ) : null}

                  {isTempo && (
                    <Text style={[styles.dueDateText, isUnpaid && { color: Colors.danger }]}>
                      {item.due_date
                        ? `Jatuh Tempo: ${item.due_date}`
                        : 'Tanpa Batas Tanggal Jatuh Tempo'}
                    </Text>
                  )}
                </View>

                {item.receipt_photo_path ? (
                  <TouchableOpacity
                    onPress={() => setViewPhotoUri(item.receipt_photo_path)}
                    style={styles.thumbWrapper}
                  >
                    <Image source={{ uri: item.receipt_photo_path }} style={styles.receiptThumb} />
                    <Text style={styles.thumbLabel}>Nota</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Action Buttons */}
              <View style={styles.cardFooterActions}>
                {isUnpaid && (
                  <Button
                    title="Lunasi Hutang Sekarang"
                    variant="primary"
                    size="sm"
                    onPress={() => handleSettleDebt(item)}
                  />
                )}
                <Button
                  title="Hapus"
                  variant="outline"
                  size="sm"
                  onPress={() => handleDeletePurchase(item)}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );

  const renderSuppliersTab = () => (
    <View style={styles.tabContentArea}>
      <FlatList
        data={suppliers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listPadding}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada master supplier tersimpan.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.supplierCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.supplierNameText}>{item.name}</Text>
              <Text style={styles.supplierPhoneText}>
                {item.phone ? `No. Telp/WA: ${item.phone}` : 'Tanpa No. Telepon'}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Text style={styles.supplierDebtLabel}>
                  Hutang Belum Lunas:{' '}
                  <Text
                    style={{
                      fontWeight: '800',
                      color: (item.unpaid_debt || 0) > 0 ? Colors.danger : Colors.textMuted,
                    }}
                  >
                    {formatRupiahDisplay(item.unpaid_debt || 0)}
                  </Text>
                </Text>
              </View>
            </View>

            <View style={styles.supplierCardActions}>
              <Button
                title="Edit"
                variant="outline"
                size="sm"
                onPress={() => {
                  setEditingSupplier(item);
                  setSupplierModalVisible(true);
                }}
              />
              <Button
                title="Hapus"
                variant="danger"
                size="sm"
                onPress={() => handleDeleteSupplier(item)}
              />
            </View>
          </Card>
        )}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <AppIcon name="arrow-back" size={18} color="#ffffff" />
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Supplier & Pembelian Bahan</Text>
            <Text style={styles.headerSubtitle}>
              Pencatatan Belanja Tunai & Manajemen Hutang Tempo Toko
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Button
            title="+ Supplier Baru"
            variant="outline"
            size="sm"
            onPress={() => {
              setEditingSupplier(null);
              setSupplierModalVisible(true);
            }}
            style={[styles.headerBtn, styles.headerOutlineBtn]}
            textStyle={styles.headerOutlineBtnText}
          />
          <Button
            title="+ Catat Pembelian"
            size="sm"
            onPress={() => setPurchaseModalVisible(true)}
            style={styles.headerBtn}
          />
        </View>
      </View>

      {/* Metrics Summary Row */}
      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Belanja Bahan</Text>
          <Text style={[styles.metricValue, { color: Colors.primary }]}>
            {formatRupiahDisplay(totalSpentAll)}
          </Text>
          <Text style={styles.metricSub}>{purchases.length} nota transaksi</Text>
        </Card>

        <Card style={[styles.metricCard, totalUnpaidDebt > 0 && styles.metricCardAlert]}>
          <Text style={styles.metricLabel}>Total Hutang Tempo Belum Lunas</Text>
          <Text
            style={[
              styles.metricValue,
              { color: totalUnpaidDebt > 0 ? Colors.danger : Colors.textMuted },
            ]}
          >
            {formatRupiahDisplay(totalUnpaidDebt)}
          </Text>
          <Text style={styles.metricSub}>Buku hutang berjalan</Text>
        </Card>

        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Master Supplier</Text>
          <Text style={styles.metricValue}>{suppliers.length}</Text>
          <Text style={styles.metricSub}>Toko / Mitra Terdaftar</Text>
        </Card>
      </View>

      {/* Main Tabs Navigation */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'purchases' && styles.tabBtnActive]}
          onPress={() => setActiveTab('purchases')}
        >
          <Text style={[styles.tabText, activeTab === 'purchases' && styles.tabTextActive]}>
            Riwayat Pembelian
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'suppliers' && styles.tabBtnActive]}
          onPress={() => setActiveTab('suppliers')}
        >
          <Text style={[styles.tabText, activeTab === 'suppliers' && styles.tabTextActive]}>
            Daftar Master Supplier
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'purchases' && renderPurchasesTab()}
            {activeTab === 'suppliers' && renderSuppliersTab()}
          </>
        )}
      </View>

      {/* Purchase Form Modal */}
      <PurchaseFormModal
        visible={purchaseModalVisible}
        onClose={() => setPurchaseModalVisible(false)}
      />

      {/* Supplier Modal */}
      <SupplierModal
        visible={supplierModalVisible}
        supplier={editingSupplier}
        onClose={() => setSupplierModalVisible(false)}
      />

      {/* Receipt Photo Viewer Modal */}
      <Modal visible={!!viewPhotoUri} transparent animationType="fade">
        <View style={styles.photoViewModal}>
          <TouchableOpacity
            style={styles.photoCloseBtn}
            onPress={() => setViewPhotoUri(null)}
          >
            <AppIcon name="close" size={16} color="#000000" />
            <Text style={styles.photoCloseText}>Tutup</Text>
          </TouchableOpacity>
          {viewPhotoUri ? (
            <Image
              source={{ uri: viewPhotoUri }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          ) : null}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
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
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    borderColor: '#ffffff',
  },
  headerOutlineBtn: {
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerOutlineBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 14,
  },
  metricCardAlert: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  tabContentArea: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  listPadding: {
    padding: 16,
    gap: 10,
  },
  purchaseCard: {
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  purchaseCardUnpaid: {
    borderLeftColor: Colors.danger,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supplierTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  purchaseMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  purchaseAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text,
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  thumbWrapper: {
    alignItems: 'center',
  },
  receiptThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  thumbLabel: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  cardFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  supplierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  supplierNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  supplierPhoneText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  supplierDebtLabel: {
    fontSize: 12,
    color: Colors.text,
  },
  supplierCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textMuted,
  },
  photoViewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullPhoto: {
    width: '90%',
    height: '75%',
    borderRadius: 8,
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  photoCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});

