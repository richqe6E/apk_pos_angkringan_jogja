import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { useTransactionStore } from '../stores/transactionStore';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { formatRupiahDisplay, formatRupiahInput } from '../utils/formatRupiah';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (res: {
    txId: number;
    invoiceNumber: string;
    total: number;
    paymentAmount: number;
    change: number;
    dailySeq?: number;
    paymentMethod: 'tunai' | 'qris' | 'transfer';
  }) => void;
}

export function PaymentModal({ visible, onClose, onSuccess }: PaymentModalProps) {
  const db = useSQLiteContext();
  const {
    tableNumber,
    customerName,
    cart,
    getSubtotal,
    getTaxAmount,
    getTotal,
    checkout,
    isCheckingOut,
  } = useTransactionStore();

  const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'qris' | 'transfer'>('tunai');
  const [amountString, setAmountString] = useState('');

  const subtotal = getSubtotal();
  const tax = getTaxAmount();
  const total = getTotal();

  const parsedAmount = parseInt(amountString.replace(/\D/g, ''), 10) || 0;
  const change = Math.max(0, parsedAmount - total);
  const isShort = paymentMethod === 'tunai' && parsedAmount < total;

  useEffect(() => {
    if (visible) {
      setPaymentMethod('tunai');
      setAmountString('');
    }
  }, [visible]);

  // Tombol Cepat Uang
  const handleQuickAmount = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAmountString(String(val));
  };

  const handleUangPas = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAmountString(String(total));
  };

  // Keypad Handlers
  const handleKeypadPress = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (amountString.length > 11) return; // limit nominal wajar
    setAmountString((prev) => prev + val);
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAmountString((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAmountString('');
  };

  // Submit Checkout
  const handleExecuteCheckout = async () => {
    if (paymentMethod === 'tunai' && isShort) {
      Alert.alert(
        'Pembayaran Kurang',
        `Nominal tunai yang diterima (${formatRupiahDisplay(parsedAmount)}) masih kurang dari total tagihan (${formatRupiahDisplay(total)}).`
      );
      return;
    }

    const finalAmount = paymentMethod === 'tunai' ? parsedAmount : total;

    try {
      const res = await checkout(db, paymentMethod, finalAmount);
      onClose();
      onSuccess(res);
    } catch (err: any) {
      Alert.alert('Gagal Transaksi', err?.message || 'Terjadi kesalahan saat memproses pembayaran.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header Pembayaran */}
          <View style={styles.modalHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.title}>Tahap Pembayaran Kasir</Text>
                <Badge label={tableNumber} variant="info" />
              </View>
              <Text style={styles.subtitle}>
                Pelanggan: <Text style={{ fontWeight: '700', color: Colors.text }}>{customerName}</Text> • {cart.length} item pesanan
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕ Batal</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bodySplit}>
            {/* Sisi Kiri: Rincian Tagihan & Metode Bayar */}
            <View style={styles.leftPane}>
              {/* Box Total Tagihan Utama */}
              <View style={styles.totalBox}>
                <Text style={styles.totalBoxLabel}>TOTAL TAGIHAN</Text>
                <Text style={styles.totalBoxAmount}>{formatRupiahDisplay(total)}</Text>
                <View style={styles.summaryBreakdown}>
                  <Text style={styles.summaryItem}>Subtotal: {formatRupiahDisplay(subtotal)}</Text>
                  {tax > 0 && <Text style={styles.summaryItem}>Pajak: {formatRupiahDisplay(tax)}</Text>}
                </View>
              </View>

              {/* Pilihan Metode Pembayaran (Tunai, QRIS, Transfer) */}
              <Text style={styles.sectionHeading}>Metode Pembayaran:</Text>
              <View style={styles.methodRow}>
                <TouchableOpacity
                  style={[
                    styles.methodBtn,
                    paymentMethod === 'tunai' && styles.methodBtnActive,
                  ]}
                  onPress={() => {
                    setPaymentMethod('tunai');
                    setAmountString('');
                  }}
                >
                  <Text
                    style={[
                      styles.methodBtnText,
                      paymentMethod === 'tunai' && styles.methodBtnTextActive,
                    ]}
                  >
                    💵 Tunai
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodBtn,
                    paymentMethod === 'qris' && styles.methodBtnActive,
                  ]}
                  onPress={() => {
                    setPaymentMethod('qris');
                    setAmountString(String(total));
                  }}
                >
                  <Text
                    style={[
                      styles.methodBtnText,
                      paymentMethod === 'qris' && styles.methodBtnTextActive,
                    ]}
                  >
                    📱 QRIS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodBtn,
                    paymentMethod === 'transfer' && styles.methodBtnActive,
                  ]}
                  onPress={() => {
                    setPaymentMethod('transfer');
                    setAmountString(String(total));
                  }}
                >
                  <Text
                    style={[
                      styles.methodBtnText,
                      paymentMethod === 'transfer' && styles.methodBtnTextActive,
                    ]}
                  >
                    🏦 Transfer
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tampilan Status Kembalian / Status Non-Tunai */}
              {paymentMethod === 'tunai' ? (
                <View style={styles.changeBox}>
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Uang Diterima:</Text>
                    <Text style={styles.changeValue}>
                      {formatRupiahDisplay(parsedAmount)}
                    </Text>
                  </View>
                  <View style={[styles.changeRow, { marginTop: 8 }]}>
                    <Text style={styles.changeLabel}>
                      {isShort ? 'Kekurangan Uang:' : 'Kembalian Pelanggan:'}
                    </Text>
                    <Text
                      style={[
                        styles.changeAmount,
                        isShort ? { color: Colors.danger } : { color: Colors.success },
                      ]}
                    >
                      {isShort
                        ? `- ${formatRupiahDisplay(total - parsedAmount)}`
                        : formatRupiahDisplay(change)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.nonCashNotice}>
                  <Text style={styles.nonCashText}>
                    Pembayaran via <Text style={{ fontWeight: '700' }}>{paymentMethod.toUpperCase()}</Text> sebesar {formatRupiahDisplay(total)} diakui lunas secara otomatis tanpa kembalian uang fisik.
                  </Text>
                </View>
              )}
            </View>

            {/* Sisi Kanan: Keypad Angka & Tombol Cepat (Jika Tunai) */}
            {paymentMethod === 'tunai' ? (
              <View style={styles.rightPane}>
                {/* Tombol Pecahan Uang Cepat */}
                <Text style={styles.sectionHeading}>Pilihan Uang Pas & Pecahan:</Text>
                <View style={styles.quickAmountRow}>
                  <TouchableOpacity style={styles.quickBtnPas} onPress={handleUangPas}>
                    <Text style={styles.quickBtnPasText}>Uang Pas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAmount(10000)}>
                    <Text style={styles.quickBtnText}>10 Ribu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAmount(20000)}>
                    <Text style={styles.quickBtnText}>20 Ribu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAmount(50000)}>
                    <Text style={styles.quickBtnText}>50 Ribu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => handleQuickAmount(100000)}>
                    <Text style={styles.quickBtnText}>100 Ribu</Text>
                  </TouchableOpacity>
                </View>

                {/* Keypad Angka Taktil */}
                <View style={styles.keypadGrid}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '000'].map((digit) => (
                    <TouchableOpacity
                      key={digit}
                      style={styles.keypadBtn}
                      onPress={() => handleKeypadPress(digit)}
                    >
                      <Text style={styles.keypadDigit}>{digit}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.keypadBtn, styles.keypadBtnAction]} onPress={handleBackspace}>
                    <Text style={styles.keypadActionText}>⌫ Hapus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.keypadBtn, styles.keypadBtnClear]} onPress={handleClear}>
                    <Text style={styles.keypadClearText}>C Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.rightPane, { justifyContent: 'center', alignItems: 'center' }]}>
                <View style={styles.qrPlaceholderBox}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>📱</Text>
                  <Text style={styles.qrTitle}>Siap Terima Pembayaran {paymentMethod.toUpperCase()}</Text>
                  <Text style={styles.qrSubtitle}>
                    Pastikan pelanggan telah melakukan transfer / scan QRIS sesuai nominal Rp {total.toLocaleString('id-ID')}.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Tombol Eksekusi Bawah */}
          <View style={styles.footerActions}>
            <Button
              title="Batal"
              variant="ghost"
              size="lg"
              style={{ flex: 1 }}
              onPress={onClose}
              disabled={isCheckingOut}
            />
            <Button
              title={
                isCheckingOut
                  ? 'Menyimpan Transaksi...'
                  : `Selesaikan Pembayaran & Cetak Nota (${formatRupiahDisplay(total)})`
              }
              variant="primary"
              size="lg"
              style={{ flex: 2 }}
              loading={isCheckingOut}
              disabled={isCheckingOut || (paymentMethod === 'tunai' && isShort)}
              onPress={handleExecuteCheckout}
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
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 780,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  closeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  bodySplit: {
    flexDirection: 'row',
    gap: 20,
  },
  leftPane: {
    flex: 1.1,
  },
  rightPane: {
    flex: 1.2,
  },
  totalBox: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  totalBoxAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginTop: 4,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  summaryItem: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  methodBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  methodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  methodBtnTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  changeBox: {
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  changeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  changeAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  nonCashNotice: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    padding: 14,
  },
  nonCashText: {
    fontSize: 13,
    color: '#15803d',
    lineHeight: 18,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickBtnPas: {
    flex: 1,
    minWidth: 80,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickBtnPasText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  quickBtn: {
    flex: 1,
    minWidth: 65,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keypadBtn: {
    width: '31%',
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadDigit: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  keypadBtnAction: {
    width: '48%',
    backgroundColor: Colors.borderLight,
  },
  keypadActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  keypadBtnClear: {
    width: '48%',
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
  },
  keypadClearText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  qrPlaceholderBox: {
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 8,
    width: '100%',
  },
  qrTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  qrSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
});

