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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { RealtimeClockBadge } from '../components/realtime-clock-badge';
import { AppIcon } from '../components/ui/app-icon';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { MenuItem, useMenuStore } from '../stores/menuStore';
import { CartItem, useTransactionStore } from '../stores/transactionStore';
import { formatRupiahDisplay } from '../utils/formatRupiah';

// Modals
import { TableSelectorModal } from '../components/table-selector-modal';
import { CustomerSelectorModal } from '../components/customer-selector-modal';
import { MenuFormModal } from '../components/menu-form-modal';
import { PaymentModal } from '../components/payment-modal';
import { ReceiptPreviewModal } from '../components/receipt-preview-modal';
import { PrinterManagementModal } from '../components/printer-management-modal';
import { CashierSelectorModal } from '../components/cashier-selector-modal';
import { QuickEditModal } from '../components/quick-edit-modal';
import { ItemNotesModal } from '../components/item-notes-modal';
import {
  PrintReceiptData,
  autoRoutePrint,
  printKitchenTicket,
  printKitchenAdditionalTicket,
  printTemporaryBill,
} from '../services/print';
import { formatFullIndonesianDate, formatRealtimeClock, getBusinessDate } from '../utils/sessionHelper';

interface MenuCardProps {
  item: MenuItem;
  onPress: (item: MenuItem) => void;
  onLongPress: (item: MenuItem) => void;
}

const MemoizedMenuCard = React.memo(({ item, onPress, onLongPress }: MenuCardProps) => {
  return (
    <TouchableOpacity
      style={styles.menuCard}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={200}
    >
      <View style={styles.menuImageContainer}>
        {item.image_path ? (
          <Image source={{ uri: item.image_path }} style={styles.menuImage} />
        ) : (
          <View style={styles.menuImagePlaceholder}>
            <AppIcon name="cart" size={26} color={Colors.textMuted} />
          </View>
        )}
        {item.track_stock === 1 && (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>Stok: {item.stock}</Text>
          </View>
        )}
      </View>
      <View style={styles.menuInfoContainer}>
        <Text style={styles.menuName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.menuPrice}>
          {formatRupiahDisplay(item.price)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

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
    activeCashier,
    activeCashierName,
    customerName,
    eligibleReward,
    storeProfile,
    discountAmount,
    loadStoreSettings,
    addToCart,
    updateCartQty,
    updateCartItemNotes,
    removeFromCart,
    clearCart,
    getSubtotal,
    getTaxAmount,
    getTotal,
    saveAsPendingOrder,
    loadPendingOrders,
    markTableAsBilling,
  } = useTransactionStore();

  // Modals state
  const [cashierModalVisible, setCashierModalVisible] = useState(false);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [quickEditModalVisible, setQuickEditModalVisible] = useState(false);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [receiptPreviewTab, setReceiptPreviewTab] = useState<'customer' | 'kitchen' | 'temp_bill'>('customer');
  const [lastReceiptData, setLastReceiptData] = useState<PrintReceiptData | null>(null);
  const [selectedMenuForEdit, setSelectedMenuForEdit] = useState<MenuItem | null>(null);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [selectedCartItemForNotes, setSelectedCartItemForNotes] = useState<CartItem | null>(null);

  // Inisialisasi data
  useEffect(() => {
    loadCategories(db);
    loadMenus(db);
    loadPendingOrders(db);
    loadStoreSettings(db);
    if (!activeCashier && !activeCashierName) {
      setCashierModalVisible(true);
    }
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

  // Handle Simpan Meja / Pending & Cetak Tiket Dapur
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Perhatian', 'Keranjang pesanan masih kosong.');
      return;
    }

    try {
      const now = new Date();
      const timeStr = `${formatFullIndonesianDate(now)}, ${formatRealtimeClock(now)}`;
      const res = await saveAsPendingOrder(db);

      if (res.isAdditional && res.deltaItems.length > 0) {
        // Cetak tiket dapur untuk pesanan tambahan (hanya item tambahan)
        printKitchenAdditionalTicket({
          invoiceNumber: res.invoiceNumber,
          tableNumber: res.tableNumber || tableNumber,
          dateTimeString: timeStr,
          additionalItems: res.deltaItems.map((d) => ({
            name: d.name,
            price: d.price,
            qty: d.qty,
            subtotal: d.subtotal,
            is_additional: 1,
            notes: d.notes,
          })),
        }).catch((err) => console.warn('Gagal cetak tiket sambungan dapur:', err));

        Alert.alert(
          'Pesanan Sambungan Disimpan',
          `Pesanan tambahan meja ${tableNumber} berhasil disimpan (${res.invoiceNumber}) dan tiket pesanan tambahan dikirim ke dapur.`,
          [{ text: 'OK', onPress: () => clearCart() }]
        );
      } else {
        // Cetak tiket dapur awal untuk pesanan meja baru (tanpa harga)
        printKitchenTicket({
          invoiceNumber: res.invoiceNumber,
          tableNumber: res.tableNumber || tableNumber,
          dateTimeString: timeStr,
          items: cart.map((i) => ({
            name: i.name,
            price: i.price,
            qty: i.qty,
            subtotal: i.subtotal,
            is_additional: 0,
            notes: i.notes,
          })),
        }).catch((err) => console.warn('Gagal cetak tiket dapur:', err));

        Alert.alert(
          'Pesanan Meja Disimpan',
          `Pesanan ${tableNumber} berhasil disimpan sebagai pending (${res.invoiceNumber}) dan tiket dikirim ke dapur.`,
          [{ text: 'OK', onPress: () => clearCart() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal menyimpan pesanan pending');
    }
  };

  // Handle Pratinjau / Cetak Tagihan Sementara
  const handleTemporaryBill = async () => {
    if (cart.length === 0) {
      Alert.alert('Perhatian', 'Keranjang pesanan masih kosong.');
      return;
    }

    try {
      const now = new Date();
      let invoiceNo = 'INV-TEMP';

      if (activePendingTransactionId) {
        await markTableAsBilling(db, activePendingTransactionId);
        const txRow = await db.getFirstAsync<{ invoice_number: string }>(
          'SELECT invoice_number FROM transactions WHERE id = ?',
          [activePendingTransactionId]
        );
        if (txRow?.invoice_number) invoiceNo = txRow.invoice_number;
      }

      const tempBillPayload: PrintReceiptData = {
        storeName: storeProfile.storeName || 'ANGKRINGAN JOGJA',
        storeAddress: storeProfile.storeAddress || 'Jl. Malioboro No. 45, Yogyakarta',
        storePhone: storeProfile.storePhone || '0812-3456-7890',
        receiptFooter: storeProfile.receiptFooter || 'Matur Nuwun Sampun Rawuh!',
        invoiceNumber: invoiceNo,
        businessDate: getBusinessDate(now),
        dateTimeString: `${formatFullIndonesianDate(now)}, ${formatRealtimeClock(now)}`,
        tableNumber,
        customerName,
        cashierName: activeCashier || activeCashierName || 'Kasir',
        items: cart.map((i) => ({
          name: i.name,
          price: i.price,
          qty: i.qty,
          subtotal: i.subtotal,
          is_additional: i.is_additional,
          notes: i.notes,
        })),
        subtotal,
        taxAmount: tax,
        discountAmount,
        total: grandTotal,
        paymentMethod: 'tagihan_sementara',
        paymentAmount: 0,
        changeAmount: 0,
      };

      setLastReceiptData(tempBillPayload);
      setReceiptPreviewTab('temp_bill');
      setReceiptPreviewVisible(true);
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Gagal memproses tagihan sementara');
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
            <AppIcon name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>ANGKRINGAN JOGJA</Text>
            <Text style={styles.headerSubtitle}>Terminal Kasir & Pesanan Meja</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Cashier Selector Bar di Header */}
          <TouchableOpacity
            style={styles.cashierHeaderBtn}
            onPress={() => setCashierModalVisible(true)}
          >
            <AppIcon name="people" size={17} color="#ffffff" />
            <Text style={styles.cashierHeaderName}>
              {activeCashier || activeCashierName ? `Kasir: ${activeCashier || activeCashierName}` : 'Pilih Kasir'}
            </Text>
            <AppIcon name="chevron-down" size={12} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {/* Customer Selector Bar di Header */}
          <TouchableOpacity
            style={styles.customerHeaderBtn}
            onPress={() => setCustomerModalVisible(true)}
          >
            <AppIcon name="people" size={17} color="#ffffff" />
            <Text style={styles.customerHeaderName}>{customerName}</Text>
            {eligibleReward && (
              <Badge label="Klaim Reward" variant="success" size="sm" style={{ marginLeft: 6 }} />
            )}
            <AppIcon name="chevron-down" size={12} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          {/* Printer Management Trigger */}
          <TouchableOpacity
            style={styles.printerHeaderBtn}
            onPress={() => setPrinterModalVisible(true)}
          >
            <AppIcon name="print" size={17} color="#ffffff" />
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
              <AppIcon name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari menu nasi kucing, sate, bakaran, wedang..."
                placeholderTextColor={Colors.placeholder}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppIcon name="close" size={15} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.tableSelectorTrigger}
              onPress={() => setTableModalVisible(true)}
            >
              <AppIcon name="table" size={16} color={Colors.primaryDark} style={{ marginRight: 6 }} />
              <Text style={styles.tableTriggerLabel}>Meja:</Text>
              <Text style={styles.tableTriggerValue}>{tableNumber}</Text>
              <AppIcon name="chevron-down" size={12} color={Colors.primaryDark} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>

          {/* Grid Katalog Menu (Tervirtualisasi untuk Efisiensi RAM 4GB) */}
          {filteredMenus.length === 0 ? (
            <View style={styles.emptyGridContainer}>
              <Text style={styles.emptyGridText}>Tidak ada menu yang sesuai dengan pencarian.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMenus}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <MemoizedMenuCard
                  item={item}
                  onPress={(m) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    addToCart(m);
                  }}
                  onLongPress={(m) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setSelectedMenuForEdit(m);
                    setQuickEditModalVisible(true);
                  }}
                />
              )}
              numColumns={3}
              key="catalog-grid-3cols"
              columnWrapperStyle={styles.menuGridRow}
              contentContainerStyle={styles.menuGridContainer}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== 'web'}
            />
          )}

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
                  Semua Menu
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
                <AppIcon name="cart" size={40} color={Colors.textMuted} style={{ marginBottom: 10 }} />
                <Text style={styles.emptyCartTitle}>Keranjang Kosong</Text>
                <Text style={styles.emptyCartDesc}>
                  Ketuk menu di katalog sebelah kiri untuk menambahkan pesanan meja ini.
                </Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.cartRow}>
                  {/* Nama, Harga Satuan & Tombol Catatan */}
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

                    {/* Tombol Catatan Per Item */}
                    <TouchableOpacity
                      style={[styles.cartNoteBtn, item.notes ? styles.cartNoteBtnActive : null]}
                      onPress={() => {
                        setSelectedCartItemForNotes(item);
                        setNotesModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <AppIcon
                        name="edit"
                        size={11}
                        color={item.notes ? Colors.primaryDark : Colors.textMuted}
                      />
                      <Text
                        style={[styles.cartNoteBtnText, item.notes ? styles.cartNoteBtnTextActive : null]}
                        numberOfLines={1}
                      >
                        {item.notes ? item.notes : '+ Catatan'}
                      </Text>
                    </TouchableOpacity>
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
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <AppIcon name="trash" size={12} color={Colors.danger} />
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
                style={{ flex: 1.3 }}
                disabled={cart.length === 0}
                onPress={handleHoldOrder}
              />
              <Button
                title="Tagihan"
                variant="secondary"
                size="md"
                style={{ flex: 1 }}
                disabled={cart.length === 0}
                onPress={handleTemporaryBill}
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

      <MenuFormModal
        visible={menuModalVisible}
        menuItem={selectedMenuForEdit}
        onClose={() => {
          setMenuModalVisible(false);
          setSelectedMenuForEdit(null);
        }}
      />

      <QuickEditModal
        visible={quickEditModalVisible}
        menuItem={selectedMenuForEdit}
        onClose={() => {
          setQuickEditModalVisible(false);
          setSelectedMenuForEdit(null);
        }}
        onOpenFullEdit={() => setMenuModalVisible(true)}
      />

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        onSuccess={async (result) => {
          // Siapkan data cetak struk lengkap
          const now = new Date();
          const receiptPayload: PrintReceiptData = {
            storeName: storeProfile.storeName || 'ANGKRINGAN JOGJA',
            storeAddress: storeProfile.storeAddress || 'Jl. Malioboro No. 45, Yogyakarta',
            storePhone: storeProfile.storePhone || '0812-3456-7890',
            receiptFooter: storeProfile.receiptFooter || 'Matur Nuwun Sampun Rawuh!',
            invoiceNumber: result.invoiceNumber,
            businessDate: getBusinessDate(now),
            dateTimeString: `${formatFullIndonesianDate(now)}, ${formatRealtimeClock(now)}`,
            tableNumber,
            customerName,
            cashierName: activeCashier || activeCashierName || 'Kasir',
            items: cart.map((i) => ({
              name: i.name,
              price: i.price,
              qty: i.qty,
              subtotal: i.subtotal,
              is_additional: i.is_additional,
              notes: i.notes,
            })),
            subtotal,
            taxAmount: tax,
            total: result.total,
            paymentMethod: result.paymentMethod || 'tunai',
            paymentAmount: result.paymentAmount,
            changeAmount: result.change,
            cashReceived: result.cashReceived,
            qrisReceived: result.qrisReceived,
          };

          setLastReceiptData(receiptPayload);
          setReceiptPreviewTab('customer');
          setReceiptPreviewVisible(true);

          // Eksekusi auto-print multi-printer Bluetooth di background
          autoRoutePrint(receiptPayload).catch((e) => console.warn('Auto print err:', e));
        }}
      />

      <ReceiptPreviewModal
        visible={receiptPreviewVisible}
        data={lastReceiptData}
        initialTab={receiptPreviewTab}
        onClose={() => setReceiptPreviewVisible(false)}
      />

      <CashierSelectorModal
        visible={cashierModalVisible}
        onClose={() => setCashierModalVisible(false)}
      />

      <PrinterManagementModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />

      <ItemNotesModal
        visible={notesModalVisible}
        itemName={selectedCartItemForNotes?.name || ''}
        initialNotes={selectedCartItemForNotes?.notes || ''}
        onClose={() => setNotesModalVisible(false)}
        onSave={(notes) => {
          if (selectedCartItemForNotes) {
            updateCartItemNotes(selectedCartItemForNotes.id, notes);
          }
        }}
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
  cashierHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  cashierHeaderName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
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
    flex: 5.4, // Terkalibrasi untuk Samsung Galaxy Tab A9 (8.7 inci): rasio lega 54% katalog : 46% keranjang
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
  menuGridRow: {
    gap: 8,
    marginBottom: 8,
  },
  menuCard: {
    flex: 1,
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
    flex: 4.6,
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
  cartNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: '95%',
  },
  cartNoteBtnActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  cartNoteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  cartNoteBtnTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  qtyStepper: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
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
