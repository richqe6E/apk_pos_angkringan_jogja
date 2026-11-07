import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { RealtimeClockBadge } from '../components/realtime-clock-badge';
import { IconSymbol } from '../components/ui/icon-symbol';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { MenuItem, useMenuStore } from '../stores/menuStore';
import { useTransactionStore } from '../stores/transactionStore';
import { formatRupiahDisplay } from '../utils/formatRupiah';

// Modals
import { TableSelectorModal } from '../components/table-selector-modal';
import { CustomerSelectorModal } from '../components/customer-selector-modal';
import { QuickEditProductModal } from '../components/quick-edit-product-modal';
import { PaymentModal } from '../components/payment-modal';
import { ReceiptPreviewModal } from '../components/receipt-preview-modal';
import { PrinterManagementModal } from '../components/printer-management-modal';
import { PrintReceiptData, autoRoutePrint } from '../services/print';
import { formatFullIndonesianDate, formatRealtimeClock, getBusinessDate } from '../utils/sessionHelper';

export default function TransaksiScreen() {
  const router = useRouter();
  const db = useSQLiteContext();

  // Stores
  const {
    categories,
    menus,
    selectedCategoryId,
    searchQuery,
    loadCategories,
    loadMenus,
    setSelectedCategoryId,
    setSearchQuery,
  } = useMenuStore();

  const {
    cart,
    tableNumber,
    activePendingTransactionId,
    customerName,
    eligibleReward,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    getSubtotal,
    getTaxAmount,
    getTotal,
    saveAsPendingOrder,
    loadPendingOrders,
  } = useTransactionStore();

  // Modals state
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [quickEditModalVisible, setQuickEditModalVisible] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<PrintReceiptData | null>(null);
  const [selectedMenuForEdit, setSelectedMenuForEdit] = useState<MenuItem | null>(null);

  // Inisialisasi data
  useEffect(() => {
    loadCategories(db);
    loadMenus(db);
    loadPendingOrders(db);
  }, [db]);

  // Filter menu berdasarkan kategori & pencarian teks
  const filteredMenus = menus.filter((item) => {
    const matchCategory =
      selectedCategoryId === null || item.category_id === selectedCategoryId;
    const matchQuery =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery);
    return matchCategory && matchQuery;
  });

  const subtotal = getSubtotal();
  const tax = getTaxAmount();
  const grandTotal = getTotal();

  // Handle Simpan Meja / Pending
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Perhatian', 'Keranjang pesanan masih kosong.');
      return;
    }

    try {
      const res = await saveAsPendingOrder(db);
      Alert.alert(
        'Pesanan Meja Disimpan',
        `Pesanan ${tableNumber} berhasil disimpan sebagai pending (${res.invoiceNumber}).`,
        [{ text: 'OK', onPress: () => clearCart() }]
      );
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal menyimpan pesanan pending');
    }
  };

  // Handle Batal Order
  const handleCancelOrder = () => {
    if (cart.length === 0) return;
    Alert.alert(
      'Batalkan Pesanan',
      'Yakin ingin mengosongkan seluruh isi keranjang transaksi ini?',
      [
        { text: 'Tidak', style: 'cancel' },
        { text: 'Ya, Kosongkan', style: 'destructive', onPress: () => clearCart() },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Bar Hijau Emerald */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="house.fill" size={20} color="#ffffff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>ANGKRINGAN JOGJA</Text>
            <Text style={styles.headerSubtitle}>Terminal Kasir & Pesanan Meja</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Customer Selector Bar di Header */}
          <TouchableOpacity
            style={styles.customerHeaderBtn}
            onPress={() => setCustomerModalVisible(true)}
          >
            <IconSymbol name="person.2.fill" size={18} color="#ffffff" />
            <Text style={styles.customerHeaderName}>{customerName}</Text>
            {eligibleReward && (
              <Badge label="Klaim Reward" variant="success" size="sm" style={{ marginLeft: 6 }} />
            )}
            <Text style={styles.dropdownCaret}>▼</Text>
          </TouchableOpacity>

          {/* Printer Management Trigger */}
          <TouchableOpacity
            style={styles.printerHeaderBtn}
            onPress={() => setPrinterModalVisible(true)}
          >
            <IconSymbol name="printer.fill" size={18} color="#ffffff" />
            <Text style={styles.printerHeaderLabel}>Printer</Text>
          </TouchableOpacity>
        </View>

        {/* Live Realtime Clock */}
        <RealtimeClockBadge />
      </View>

      {/* 2. Main Dual-Panel Split Screen */}
      <View style={styles.splitBody}>
        {/* ============================================================== */}
        {/* PANEL KIRI: KATALOG MENU & KATEGORI (65% LEBAR LAYAR)         */}
        {/* ============================================================== */}
        <View style={styles.leftCatalogPanel}>
          {/* Top Search & Toolbar */}
          <View style={styles.catalogTopBar}>
            <View style={styles.searchBox}>
              <IconSymbol name="flame.fill" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari menu nasi kucing, sate, bakaran, wedang..."
                placeholderTextColor={Colors.placeholder}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={{ color: Colors.textMuted, paddingHorizontal: 6, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.tableSelectorTrigger}
              onPress={() => setTableModalVisible(true)}
            >
              <Text style={styles.tableTriggerLabel}>Meja:</Text>
              <Text style={styles.tableTriggerValue}>{tableNumber}</Text>
              <Text style={styles.tableTriggerCaret}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Grid Katalog Menu */}
          <ScrollView contentContainerStyle={styles.menuGridContainer}>
            {filteredMenus.length === 0 ? (
              <View style={styles.emptyGridContainer}>
                <Text style={styles.emptyGridText}>Tidak ada menu yang sesuai dengan pencarian.</Text>
              </View>
            ) : (
              <View style={styles.menuGrid}>
                {filteredMenus.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.menuCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      addToCart(item);
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setSelectedMenuForEdit(item);
                      setQuickEditModalVisible(true);
                    }}
                    delayLongPress={2000} // Long-press 2-3 detik untuk Quick Edit
                  >
                    {/* Wadah Foto Menu Bersih */}
                    <View style={styles.menuImageContainer}>
                      {item.image_path ? (
                        <Image source={{ uri: item.image_path }} style={styles.menuImage} />
                      ) : (
                        <View style={styles.menuImagePlaceholder}>
                          <Text style={{ fontSize: 28 }}>🍢</Text>
                        </View>
                      )}
                      {item.track_stock === 1 && (
                        <View style={styles.stockBadge}>
                          <Text style={styles.stockBadgeText}>Stok: {item.stock}</Text>
                        </View>
                      )}
                    </View>

                    {/* Informasi Menu */}
                    <View style={styles.menuInfoContainer}>
                      <Text style={styles.menuName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.menuPrice}>
                        {formatRupiahDisplay(item.price)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Baris Kategori Horizontal di Bagian Bawah */}
          <View style={styles.bottomCategoryBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  selectedCategoryId === null && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategoryId(null)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategoryId === null && styles.categoryPillTextActive,
                  ]}
                >
                  🍴 Semua Menu
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => {
                const isActive = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryPill,
                      isActive && styles.categoryPillActive,
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* ============================================================== */}
        {/* PANEL KANAN: KERANJANG CHECKOUT & DUA TAHAP BAYAR (35% LEBAR) */}
        {/* ============================================================== */}
        <View style={styles.rightCartPanel}>
          {/* Header Keranjang */}
          <View style={styles.cartHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cartTitle}>Pesanan Meja</Text>
                <Badge
                  label={activePendingTransactionId ? 'Pending Aktif' : 'Order Baru'}
                  variant={activePendingTransactionId ? 'warning' : 'info'}
                  size="sm"
                />
              </View>
              <Text style={styles.cartTableInfo}>
                {tableNumber} • {customerName}
              </Text>
            </View>

            <Button
              title="Kelola Meja"
              variant="outline"
              size="sm"
              onPress={() => setTableModalVisible(true)}
            />
          </View>

          {/* Tabel Mini Header Keranjang */}
          <View style={styles.cartTableHeader}>
            <Text style={[styles.cartColHeader, { flex: 2 }]}>Menu</Text>
            <Text style={[styles.cartColHeader, { width: 90, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.cartColHeader, { width: 85, textAlign: 'right' }]}>Subtotal</Text>
          </View>

          {/* Scrollable Item Keranjang */}
          <ScrollView style={styles.cartItemsScroll} contentContainerStyle={{ paddingVertical: 4 }}>
            {cart.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🛒</Text>
                <Text style={styles.emptyCartTitle}>Keranjang Kosong</Text>
                <Text style={styles.emptyCartDesc}>
                  Ketuk menu di katalog sebelah kiri untuk menambahkan pesanan meja ini.
                </Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.cartRow}>
                  {/* Nama & Harga Satuan */}
                  <View style={{ flex: 2, paddingRight: 6 }}>
                    <Text style={styles.cartItemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.cartItemUnitPrice}>
                      {formatRupiahDisplay(item.price)}
                      {item.is_additional === 1 && (
                        <Text style={{ color: Colors.warning, fontWeight: '700' }}> (Tambahan)</Text>
                      )}
                    </Text>
                  </View>

                  {/* Stepper Qty [-] Qty [+] */}
                  <View style={styles.qtyStepper}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateCartQty(item.menu_id, item.qty - 1)}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateCartQty(item.menu_id, item.qty + 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Subtotal Item & Tombol Hapus */}
                  <View style={{ width: 85, alignItems: 'flex-end' }}>
                    <Text style={styles.cartItemSubtotal}>
                      {formatRupiahDisplay(item.subtotal)}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteItemBtn}
                      onPress={() => removeFromCart(item.menu_id)}
                    >
                      <Text style={styles.deleteItemText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Ringkasan Biaya Tagihan */}
          <View style={styles.cartSummaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sub Total</Text>
              <Text style={styles.summaryVal}>{formatRupiahDisplay(subtotal)}</Text>
            </View>
            {tax > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pajak (PB1)</Text>
                <Text style={styles.summaryVal}>{formatRupiahDisplay(tax)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmount}>{formatRupiahDisplay(grandTotal)}</Text>
            </View>
          </View>

          {/* Tombol Aksi Keranjang */}
          <View style={styles.cartActionsFooter}>
            <View style={styles.secondaryActionsRow}>
              <Button
                title="Batal"
                variant="danger"
                size="md"
                style={{ flex: 1 }}
                disabled={cart.length === 0}
                onPress={handleCancelOrder}
              />
              <Button
                title={activePendingTransactionId ? 'Perbarui Meja' : 'Simpan Pending'}
                variant="outline"
                size="md"
                style={{ flex: 1.5 }}
                disabled={cart.length === 0}
                onPress={handleHoldOrder}
              />
            </View>

            {/* Tombol Utama Bayar Sekarang (Membuka Tahap 2 Pembayaran) */}
            <Button
              title={`Bayar Sekarang (${formatRupiahDisplay(grandTotal)})`}
              variant="primary"
              size="lg"
              style={styles.payButton}
              disabled={cart.length === 0}
              onPress={() => setPaymentModalVisible(true)}
            />
          </View>
        </View>
      </View>

      {/* 3. Modal-Modal Fungsional Terintegrasi */}
      <TableSelectorModal
        visible={tableModalVisible}
        onClose={() => setTableModalVisible(false)}
      />

      <CustomerSelectorModal
        visible={customerModalVisible}
        onClose={() => setCustomerModalVisible(false)}
      />

      <QuickEditProductModal
        visible={quickEditModalVisible}
        menu={selectedMenuForEdit}
        onClose={() => {
          setQuickEditModalVisible(false);
          setSelectedMenuForEdit(null);
        }}
      />

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        onSuccess={async (result) => {
          // Siapkan data cetak struk lengkap
          const now = new Date();
          const receiptPayload: PrintReceiptData = {
            storeName: 'ANGKRINGAN JOGJA',
            storeAddress: 'Jl. Malioboro No. 45, Yogyakarta',
            storePhone: '0812-3456-7890',
            receiptFooter: 'Matur Nuwun Sampun Rawuh!',
            invoiceNumber: result.invoiceNumber,
            businessDate: getBusinessDate(now),
            dateTimeString: `${formatFullIndonesianDate(now)}, ${formatRealtimeClock(now)}`,
            tableNumber,
            customerName,
            cashierName: 'Kasir',
            items: cart.map((i) => ({
              name: i.name,
              price: i.price,
              qty: i.qty,
              subtotal: i.subtotal,
              is_additional: i.is_additional,
            })),
            subtotal,
            taxAmount: tax,
            total: result.total,
            paymentMethod: 'tunai', // default or selected
            paymentAmount: result.paymentAmount,
            changeAmount: result.change,
          };

          setLastReceiptData(receiptPayload);
          setReceiptPreviewVisible(true);

          // Eksekusi auto-print multi-printer Bluetooth di background
          autoRoutePrint(receiptPayload).catch((e) => console.warn('Auto print err:', e));
        }}
      />

      <ReceiptPreviewModal
        visible={receiptPreviewVisible}
        data={lastReceiptData}
        onClose={() => setReceiptPreviewVisible(false)}
      />

      <PrinterManagementModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryDark,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  customerHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  customerHeaderName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  printerHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    gap: 6,
  },
  printerHeaderLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  dropdownCaret: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginLeft: 8,
  },
  splitBody: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCatalogPanel: {
    flex: 6.5,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.background,
  },
  catalogTopBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBox: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
  },
  tableSelectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: 6,
  },
  tableTriggerLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tableTriggerValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginLeft: 4,
  },
  tableTriggerCaret: {
    fontSize: 10,
    color: Colors.primaryDark,
    marginLeft: 6,
  },
  menuGridContainer: {
    padding: 12,
  },
  emptyGridContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyGridText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuCard: {
    width: '23.8%', // ~4 kolom pada tablet
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  menuImageContainer: {
    height: 90,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  menuImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  menuImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  menuInfoContainer: {
    padding: 10,
  },
  menuName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    minHeight: 34,
  },
  menuPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 4,
  },
  bottomCategoryBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  categoryScroll: {
    gap: 8,
    paddingHorizontal: 6,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#ffffff',
  },
  categoryPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  rightCartPanel: {
    flex: 3.5,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  cartTableInfo: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cartTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartColHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  cartItemsScroll: {
    flex: 1,
    paddingHorizontal: 14,
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyCartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyCartDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 220,
    marginTop: 4,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  cartItemUnitPrice: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  qtyStepper: {
    width: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  qtyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    minWidth: 18,
    textAlign: 'center',
  },
  cartItemSubtotal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  deleteItemBtn: {
    marginTop: 2,
  },
  deleteItemText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '600',
  },
  cartSummaryBox: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  cartActionsFooter: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payButton: {
    height: 52,
  },
});
