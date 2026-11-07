import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { formatRupiahDisplay } from '../utils/formatRupiah';
import {
  PrintReceiptData,
  printCustomerReceipt,
  printKitchenTicket,
  printKitchenAdditionalTicket,
} from '../services/print';

interface ReceiptPreviewModalProps {
  visible: boolean;
  data: PrintReceiptData | null;
  onClose: () => void;
}

export function ReceiptPreviewModal({ visible, data, onClose }: ReceiptPreviewModalProps) {
  const [previewTab, setPreviewTab] = useState<'customer' | 'kitchen'>('customer');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!data) return null;

  const additionalItems = data.items.filter((i) => i.is_additional === 1);
  const hasAdditional = additionalItems.length > 0;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (previewTab === 'customer') {
        await printCustomerReceipt(data);
      } else {
        if (hasAdditional) {
          await printKitchenAdditionalTicket({
            invoiceNumber: data.invoiceNumber,
            tableNumber: data.tableNumber,
            dateTimeString: data.dateTimeString,
            additionalItems,
          });
        } else {
          await printKitchenTicket({
            invoiceNumber: data.invoiceNumber,
            tableNumber: data.tableNumber,
            dateTimeString: data.dateTimeString,
            items: data.items,
          });
        }
      }
      setIsPrinting(false);
      Alert.alert('Sukses', 'Perintah cetak berhasil dikirim ke printer.');
    } catch (err: any) {
      setIsPrinting(false);
      Alert.alert('Gagal Cetak', err?.message || 'Pastikan printer Bluetooth telah terhubung.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.title}>Pratinjau Kertas Struk Thermal (58mm)</Text>
              <Text style={styles.subtitle}>Format cetak kertas Bluetooth printer kasir & dapur</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Switch Struk Customer vs Tiket Dapur */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, previewTab === 'customer' && styles.tabItemActive]}
              onPress={() => setPreviewTab('customer')}
            >
              <Text style={[styles.tabText, previewTab === 'customer' && styles.tabTextActive]}>
                🧾 Struk Customer (Lengkap)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, previewTab === 'kitchen' && styles.tabItemActive]}
              onPress={() => setPreviewTab('kitchen')}
            >
              <Text style={[styles.tabText, previewTab === 'kitchen' && styles.tabTextActive]}>
                🍳 Tiket Dapur {hasAdditional ? '(Sambungan)' : '(Tanpa Harga)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Visual Kertas Struk 58mm (Tampilan Realistis Thermal Paper) */}
          <ScrollView style={styles.receiptPaperScroll} contentContainerStyle={styles.receiptPaper}>
            {previewTab === 'customer' ? (
              /* ================== TAMPILAN STRUK CUSTOMER ================== */
              <View style={styles.paperContent}>
                <Text style={styles.receiptStoreName}>{data.storeName || 'ANGKRINGAN JOGJA'}</Text>
                {data.storeAddress ? <Text style={styles.receiptStoreSub}>{data.storeAddress}</Text> : null}
                {data.storePhone ? <Text style={styles.receiptStoreSub}>Telp: {data.storePhone}</Text> : null}
                <Text style={styles.receiptDivider}>================================</Text>

                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMeta}>No. Nota: {data.invoiceNumber}</Text>
                  <Text style={styles.receiptMeta}>{data.dateTimeString}</Text>
                </View>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMeta}>Meja: {data.tableNumber}</Text>
                  <Text style={styles.receiptMeta}>Kasir: {data.cashierName || 'Kasir'}</Text>
                </View>
                <Text style={styles.receiptMeta}>Customer: {data.customerName}</Text>
                <Text style={styles.receiptDivider}>--------------------------------</Text>

                {/* Items */}
                {data.items.map((item, idx) => (
                  <View key={idx} style={{ marginBottom: 4 }}>
                    <Text style={styles.receiptItemName}>{item.name}</Text>
                    <View style={styles.receiptItemSubRow}>
                      <Text style={styles.receiptItemQty}>
                        {item.qty} x {formatRupiahDisplay(item.price, false)}
                      </Text>
                      <Text style={styles.receiptItemSubtotal}>
                        {formatRupiahDisplay(item.subtotal, false)}
                      </Text>
                    </View>
                  </View>
                ))}

                <Text style={styles.receiptDivider}>--------------------------------</Text>

                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Subtotal</Text>
                  <Text style={styles.receiptTotalVal}>{formatRupiahDisplay(data.subtotal)}</Text>
                </View>
                {data.discountAmount && data.discountAmount > 0 ? (
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Diskon</Text>
                    <Text style={styles.receiptTotalVal}>- {formatRupiahDisplay(data.discountAmount)}</Text>
                  </View>
                ) : null}
                {data.taxAmount && data.taxAmount > 0 ? (
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Pajak (PB1)</Text>
                    <Text style={styles.receiptTotalVal}>{formatRupiahDisplay(data.taxAmount)}</Text>
                  </View>
                ) : null}

                <View style={[styles.receiptTotalRow, { marginTop: 4 }]}>
                  <Text style={styles.receiptGrandTotalLabel}>TOTAL</Text>
                  <Text style={styles.receiptGrandTotalVal}>{formatRupiahDisplay(data.total)}</Text>
                </View>

                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Bayar ({data.paymentMethod.toUpperCase()})</Text>
                  <Text style={styles.receiptTotalVal}>{formatRupiahDisplay(data.paymentAmount)}</Text>
                </View>
                {data.paymentMethod.toLowerCase() === 'tunai' && (
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Kembalian</Text>
                    <Text style={styles.receiptTotalVal}>{formatRupiahDisplay(data.changeAmount)}</Text>
                  </View>
                )}

                <Text style={styles.receiptDivider}>================================</Text>
                <Text style={styles.receiptFooterText}>
                  {data.receiptFooter || 'Matur Nuwun Sampun Rawuh!'}
                </Text>
                <Text style={styles.receiptFooterSub}>Simpan struk ini sebagai bukti pembayaran</Text>
              </View>
            ) : (
              /* ================== TAMPILAN TIKET DAPUR ================== */
              <View style={styles.paperContent}>
                <Text style={styles.kitchenHeader}>
                  {hasAdditional ? '*** PESANAN TAMBAHAN (SAMBUNGAN) ***' : '*** TIKET DAPUR / KITCHEN ***'}
                </Text>
                <Text style={styles.kitchenTableBig}>MEJA: {data.tableNumber}</Text>
                <Text style={styles.receiptStoreSub}>Nota: {data.invoiceNumber} • {data.dateTimeString}</Text>
                <Text style={styles.receiptDivider}>================================</Text>

                {/* Items Dapur Tanpa Harga */}
                {(hasAdditional ? additionalItems : data.items).map((item, idx) => (
                  <View key={idx} style={styles.kitchenItemRow}>
                    <Text style={styles.kitchenQtyBadge}>[ x{item.qty} ]</Text>
                    <Text style={styles.kitchenItemName}>
                      {item.name} {item.is_additional === 1 ? '(TAMBAHAN)' : ''}
                    </Text>
                  </View>
                ))}

                <Text style={styles.receiptDivider}>================================</Text>
                <Text style={styles.kitchenFooter}>
                  {hasAdditional
                    ? 'Pesanan tambahan meja yang sedang makan!'
                    : 'Segera siapkan & sajikan ke meja!'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Tombol Aksi */}
          <View style={styles.modalActions}>
            <Button
              title="Tutup"
              variant="ghost"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title={isPrinting ? 'Mencetak...' : 'Cetak ke Printer Bluetooth'}
              variant="primary"
              size="md"
              loading={isPrinting}
              onPress={handlePrint}
              style={{ flex: 2 }}
            />
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
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    padding: 3,
    marginBottom: 12,
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
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  receiptPaperScroll: {
    maxHeight: 400,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  receiptPaper: {
    padding: 16,
    alignItems: 'center',
  },
  paperContent: {
    width: 290, // Lebar proporsional simulasi kertas 58mm
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptStoreName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    color: '#0f172a',
  },
  receiptStoreSub: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    textAlign: 'center',
    color: '#475569',
    marginTop: 2,
  },
  receiptDivider: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    textAlign: 'center',
    color: '#64748b',
    marginVertical: 4,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptMeta: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#334155',
  },
  receiptItemName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptItemSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptItemQty: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: '#475569',
  },
  receiptItemSubtotal: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  receiptTotalLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
  },
  receiptTotalVal: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },
  receiptGrandTotalLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  receiptGrandTotalVal: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  receiptFooterText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a',
  },
  receiptFooterSub: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    textAlign: 'center',
    color: '#64748b',
    marginTop: 2,
  },
  kitchenHeader: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    color: Colors.danger,
  },
  kitchenTableBig: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    color: '#0f172a',
    marginVertical: 4,
  },
  kitchenItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  kitchenQtyBadge: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  kitchenItemName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  kitchenFooter: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#b91c1c',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
