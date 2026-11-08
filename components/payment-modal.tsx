import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { useTransactionStore } from '../stores/transactionStore';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AppIcon } from './ui/app-icon';
import { ModalHeader } from './ui/modal-header';
import { formatRupiahDisplay, formatRupiahInput } from '../utils/formatRupiah';

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

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

  // QRIS & Multi-Bank State
  const [qrisImagePath, setQrisImagePath] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Angkringan Jogja');
  const [qrisFullScreenVisible, setQrisFullScreenVisible] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);

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
      setQrisFullScreenVisible(false);
      setCopiedBankId(null);

      // Load QRIS image path, bank accounts, and store name from settings table
      (async () => {
        try {
          const rows = await db.getAllAsync<{ key: string; value: string }>(
            "SELECT key, value FROM settings WHERE key IN ('qris_image_path', 'bank_accounts', 'store_name')"
          );
          (rows || []).forEach((row) => {
            if (row.key === 'qris_image_path') {
              setQrisImagePath(row.value && row.value.trim().length > 0 ? row.value : null);
            }
            if (row.key === 'store_name' && row.value) {
              setStoreName(row.value);
            }
            if (row.key === 'bank_accounts') {
              try {
                const parsed = JSON.parse(row.value);
                if (Array.isArray(parsed)) {
                  setBankAccounts(parsed);
                  if (parsed.length > 0) {
                    setSelectedBankId(parsed[0].id);
                  }
                }
              } catch (err) {
                console.warn('Gagal parse bank_accounts:', err);
              }
            }
          });
        } catch (err) {
          console.warn('Gagal memuat pengaturan pembayaran:', err);
        }
      })();
    }
  }, [visible, db]);

  const handleCopyAccountNumber = (account: BankAccount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopiedBankId(account.id);
    setTimeout(() => setCopiedBankId(null), 2500);

    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
        (navigator as any).clipboard.writeText(account.account_number).catch(() => {});
      }
    } catch (_) {}

    Alert.alert(
      'Nomor Rekening Disalin',
      `Nomor Rekening ${account.bank_name.toUpperCase()}:\n${account.account_number}\na.n. ${account.account_holder}\n\nBerhasil disalin ke papan klip untuk dibagikan kepada pelanggan.`
    );
  };

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
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header Pembayaran Modern */}
          <ModalHeader
            title="Tahap Pembayaran Kasir"
            subtitle={`Pelanggan: ${customerName} • ${cart.length} menu (Meja ${tableNumber})`}
            icon="cash"
            onClose={onClose}
          />

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
                  <AppIcon
                    name="cash"
                    size={18}
                    color={paymentMethod === 'tunai' ? Colors.primaryDark : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodBtnText,
                      paymentMethod === 'tunai' && styles.methodBtnTextActive,
                    ]}
                  >
                    Tunai
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
                  <AppIcon
                    name="qris"
                    size={18}
                    color={paymentMethod === 'qris' ? Colors.primaryDark : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodBtnText,
                      paymentMethod === 'qris' && styles.methodBtnTextActive,
                    ]}
                  >
                    QRIS
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
                  <AppIcon
                    name="bank"
                    size={18}
                    color={paymentMethod === 'transfer' ? Colors.primaryDark : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodBtnText,
                      paymentMethod === 'transfer' && styles.methodBtnTextActive,
                    ]}
                  >
                    Transfer
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
            ) : paymentMethod === 'qris' ? (
              <View style={styles.rightPane}>
                {qrisImagePath ? (
                  <View style={styles.qrisActiveCard}>
                    <View style={styles.qrisHeaderRow}>
                      <Badge label="📱 QRIS STATIS RESMI" variant="info" size="sm" />
                      <Text style={styles.qrisStoreLabel}>{storeName}</Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setQrisFullScreenVisible(true)}
                      style={styles.qrisImageContainer}
                    >
                      <Image
                        source={{ uri: qrisImagePath }}
                        style={styles.qrisImageDisplay}
                        resizeMode="contain"
                      />
                      <View style={styles.zoomHintBadge}>
                        <AppIcon name="search" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.zoomHintText}>Ketuk untuk Layar Penuh</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.qrisGuidanceBox}>
                      <Text style={styles.qrisGuidanceAmount}>
                        Tagihan: <Text style={{ color: Colors.primaryDark }}>{formatRupiahDisplay(total)}</Text>
                      </Text>
                      <Text style={styles.qrisGuidanceDesc}>
                        Pelanggan dapat melakukan scan menggunakan BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay & Dana.
                      </Text>
                    </View>

                    <Button
                      title="Tampilkan QRIS Layar Penuh (Untuk Pelanggan)"
                      variant="outline"
                      size="sm"
                      onPress={() => setQrisFullScreenVisible(true)}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                ) : (
                  <View style={styles.qrisMissingCard}>
                    <AppIcon name="alert-circle" size={44} color={Colors.warning} style={{ marginBottom: 10 }} />
                    <Text style={styles.qrisMissingTitle}>Foto QRIS Toko Belum Diunggah</Text>
                    <Text style={styles.qrisMissingDesc}>
                      Pemilik toko belum mengatur gambar barcode QRIS. Buka menu Pengaturan &gt; Pembayaran QRIS Toko untuk mengunggah gambar QRIS.
                    </Text>
                    <View style={styles.qrisMissingTipBox}>
                      <Text style={styles.qrisMissingTipText}>
                        Info Kasir: Pelanggan tetap dapat melakukan pembayaran jika kasir menyediakan stiker QRIS fisik. Tekan tombol Selesaikan Pembayaran setelah verifikasi.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // Transfer
              <View style={styles.rightPane}>
                <View style={styles.transferPaneHeader}>
                  <Text style={styles.transferTitle}>PILIH REKENING TUJUAN TRANSFER</Text>
                  <Text style={styles.transferSubtitle}>
                    Tunjukkan nomor rekening berikut kepada pelanggan:
                  </Text>
                </View>

                {bankAccounts.length > 0 ? (
                  <ScrollView
                    style={styles.bankAccountsList}
                    contentContainerStyle={styles.bankAccountsListContent}
                  >
                    {bankAccounts.map((account) => {
                      const isSelected = selectedBankId === account.id;
                      const isCopied = copiedBankId === account.id;

                      return (
                        <TouchableOpacity
                          key={account.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setSelectedBankId(account.id);
                          }}
                          style={[
                            styles.bankSelectCard,
                            isSelected && styles.bankSelectCardActive,
                          ]}
                        >
                          <View style={styles.bankSelectHeader}>
                            <Badge
                              label={account.bank_name.toUpperCase()}
                              variant={isSelected ? 'success' : 'info'}
                              size="sm"
                            />
                            {isSelected && (
                              <Badge label="✓ Terpilih" variant="success" size="sm" />
                            )}
                          </View>

                          <View style={styles.bankNumberRow}>
                            <Text style={styles.bankSelectNumber} selectable>
                              {account.account_number}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleCopyAccountNumber(account)}
                              style={[
                                styles.copyBtn,
                                isCopied && styles.copyBtnSuccess,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.copyBtnText,
                                  isCopied && styles.copyBtnTextSuccess,
                                ]}
                              >
                                {isCopied ? 'Tersalin' : 'Salin'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.bankSelectHolder}>
                            a.n. <Text style={{ fontWeight: '700' }}>{account.account_holder}</Text>
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <View style={styles.transferVerifyNotice}>
                      <Text style={styles.transferVerifyText}>
                        Pastikan kasir telah memverifikasi bukti transfer atau notifikasi m-Banking sebelum menyelesaikan transaksi.
                      </Text>
                    </View>
                  </ScrollView>
                ) : (
                  <View style={styles.qrisMissingCard}>
                    <AppIcon name="bank" size={44} color={Colors.textMuted} style={{ marginBottom: 10 }} />
                    <Text style={styles.qrisMissingTitle}>Belum Ada Rekening Terdaftar</Text>
                    <Text style={styles.qrisMissingDesc}>
                      Daftarkan rekening bank toko (BCA, Mandiri, BRI, dll) di menu Pengaturan &gt; Rekening Bank Toko.
                    </Text>
                    <View style={styles.qrisMissingTipBox}>
                      <Text style={styles.qrisMissingTipText}>
                        Info Kasir: Transaksi transfer tetap dapat diselesaikan dengan pencatatan manual.
                      </Text>
                    </View>
                  </View>
                )}
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

    {/* Modal QRIS Layar Penuh untuk Pelanggan */}
    <Modal
      visible={qrisFullScreenVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setQrisFullScreenVisible(false)}
    >
      <View style={styles.fullScreenOverlay}>
        <View style={styles.fullScreenCard}>
          <View style={styles.fullScreenHeader}>
            <View>
              <Text style={styles.fullScreenStoreName}>{storeName}</Text>
              <Text style={styles.fullScreenSubtitle}>Scan QRIS untuk Menyelesaikan Pembayaran</Text>
            </View>
            <TouchableOpacity
              onPress={() => setQrisFullScreenVisible(false)}
              style={styles.fullScreenCloseBtn}
            >
              <Text style={styles.fullScreenCloseBtnText}>✕ Tutup</Text>
            </TouchableOpacity>
          </View>

          {qrisImagePath && (
            <View style={styles.fullScreenImageContainer}>
              <Image
                source={{ uri: qrisImagePath }}
                style={styles.fullScreenQrisImage}
                resizeMode="contain"
              />
            </View>
          )}

          <View style={styles.fullScreenAmountBox}>
            <Text style={styles.fullScreenAmountLabel}>TOTAL PEMBAYARAN</Text>
            <Text style={styles.fullScreenAmountValue}>{formatRupiahDisplay(total)}</Text>
          </View>

          <Text style={styles.fullScreenGuideText}>
            Buka aplikasi Mobile Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, ShopeePay, Dana) lalu scan barcode QRIS di atas.
          </Text>
        </View>
      </View>
    </Modal>
  </>
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
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
  // QRIS Specific Styles
  qrisActiveCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  qrisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  qrisStoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  qrisImageContainer: {
    width: 170,
    height: 170,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  qrisImageDisplay: {
    width: '100%',
    height: '100%',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  zoomHintText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  qrisGuidanceBox: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  qrisGuidanceAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  qrisGuidanceDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  qrisMissingCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  qrisMissingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  qrisMissingDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  qrisMissingTipBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fef3c7',
    padding: 10,
  },
  qrisMissingTipText: {
    fontSize: 11,
    color: '#b45309',
    lineHeight: 15,
  },
  // Multi-Bank Transfer Styles
  transferPaneHeader: {
    marginBottom: 10,
  },
  transferTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  transferSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bankAccountsList: {
    maxHeight: 280,
  },
  bankAccountsListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  bankSelectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
  },
  bankSelectCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  bankSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bankNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bankSelectNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 1.2,
    fontFamily: 'monospace',
  },
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copyBtnSuccess: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  copyBtnTextSuccess: {
    color: '#15803d',
  },
  bankSelectHolder: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  transferVerifyNotice: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 8,
    marginTop: 6,
  },
  transferVerifyText: {
    fontSize: 11,
    color: '#15803d',
    lineHeight: 15,
  },
  // Full-Screen QRIS Modal Styles
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fullScreenCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  fullScreenHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  fullScreenStoreName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  fullScreenSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fullScreenCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  fullScreenCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  fullScreenImageContainer: {
    width: 270,
    height: 270,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fullScreenQrisImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenAmountBox: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  fullScreenAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  fullScreenAmountValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  fullScreenGuideText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

