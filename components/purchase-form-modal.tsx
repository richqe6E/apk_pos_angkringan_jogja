import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { pickImageFromGallery, takePhotoFromCamera } from '../utils/imagePickerHelper';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AppIcon } from './ui/app-icon';
import { ModalHeader } from './ui/modal-header';
import { formatRupiahDisplay, formatRupiahInput, parseRupiahInput } from '../utils/formatRupiah';
import { Supplier, usePurchaseStore, CreatePurchaseInput } from '../stores/purchaseStore';
import { SupplierModal } from './supplier-modal';

interface PurchaseFormModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PurchaseFormModal({ visible, onClose }: PurchaseFormModalProps) {
  const db = useSQLiteContext();
  const { suppliers, loadSuppliers, recordPurchase } = usePurchaseStore();

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [totalAmountText, setTotalAmountText] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'tempo'>('cash');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDateString, setDueDateString] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  useEffect(() => {
    if (visible && db) {
      loadSuppliers(db).catch((e) => console.warn('Error loading suppliers:', e));
    }
  }, [visible, db]);

  const resetForm = () => {
    setSelectedSupplier(null);
    setTotalAmountText('');
    setPaymentType('cash');
    setHasDueDate(false);
    setDueDateString('');
    setNotes('');
    setPhotoUri(null);
  };

  const handleSetQuickDueDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDueDateString(`${y}-${m}-${day}`);
    setHasDueDate(true);
  };

  const handleTotalAmountChange = (txt: string) => {
    const rawNum = parseRupiahInput(txt);
    if (rawNum === 0 && txt.trim() === '') {
      setTotalAmountText('');
    } else {
      setTotalAmountText(formatRupiahInput(rawNum));
    }
  };

  const handlePickImage = () => {
    Alert.alert('Foto Bukti Nota', 'Pilih sumber gambar nota pembelian:', [
      {
        text: 'Buka Kamera',
        onPress: () => {
          setTimeout(async () => {
            const uri = await takePhotoFromCamera();
            if (uri) {
              setPhotoUri(uri);
            }
          }, 150);
        },
      },
      {
        text: 'Pilih dari Galeri',
        onPress: () => {
          setTimeout(async () => {
            const uri = await pickImageFromGallery();
            if (uri) {
              setPhotoUri(uri);
            }
          }, 150);
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      Alert.alert('Perhatian', 'Harap pilih supplier atau toko tempat pembelian.');
      return;
    }

    const totalAmount = parseRupiahInput(totalAmountText);
    if (totalAmount <= 0) {
      Alert.alert('Perhatian', 'Nominal pembelian harus lebih dari Rp 0.');
      return;
    }

    if (paymentType === 'tempo' && hasDueDate && !dueDateString.trim()) {
      Alert.alert('Perhatian', 'Harap pilih atau isi tanggal jatuh tempo (contoh: YYYY-MM-DD).');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreatePurchaseInput = {
        supplier_id: selectedSupplier.id,
        supplier_name: selectedSupplier.name,
        total_amount: totalAmount,
        payment_type: paymentType,
        has_due_date: paymentType === 'tempo' && hasDueDate,
        due_date: paymentType === 'tempo' && hasDueDate ? dueDateString.trim() : null,
        receipt_photo_uri: photoUri || undefined,
        notes: notes.trim(),
      };

      await recordPurchase(db, input);
      Alert.alert(
        'Sukses',
        `Pembelian dari ${selectedSupplier.name} senilai ${formatRupiahDisplay(totalAmount)} berhasil dicatat.`
      );
      resetForm();
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Mencatat Pembelian', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalBox}>
          {/* Header Modal Modern */}
          <ModalHeader
            title="Catat Pembelian Bahan"
            subtitle="Pengeluaran kas tunai & buku hutang tempo supplier"
            icon="cart"
            onClose={onClose}
          />

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* Pilihan Supplier */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.label}>Pilih Supplier / Toko Grosir *</Text>
                <TouchableOpacity onPress={() => setShowSupplierModal(true)}>
                  <Text style={styles.linkText}>+ Supplier Baru</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.supplierScroll}>
                {suppliers.length === 0 ? (
                  <Text style={styles.emptySupplierText}>
                    Belum ada data supplier. Klik "+ Supplier Baru" di atas.
                  </Text>
                ) : (
                  suppliers.map((s) => {
                    const isSelected = selectedSupplier?.id === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSelectedSupplier(s)}
                        style={[styles.supplierPill, isSelected && styles.supplierPillSelected]}
                      >
                        <Text style={[styles.supplierPillText, isSelected && styles.supplierPillTextSelected]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Nominal Pembelian */}
            <View style={styles.section}>
              <Text style={styles.label}>Total Nominal Pembelian (Rp) *</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Contoh: 150.000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={totalAmountText}
                onChangeText={handleTotalAmountChange}
              />
              {parseRupiahInput(totalAmountText) > 0 && (
                <Text style={styles.amountPreview}>
                  {formatRupiahDisplay(parseRupiahInput(totalAmountText))}
                </Text>
              )}
            </View>

            {/* Metode Pembayaran */}
            <View style={styles.section}>
              <Text style={styles.label}>Metode Pembayaran *</Text>
              <View style={styles.paymentTypeRow}>
                <TouchableOpacity
                  style={[styles.paymentTypeBtn, paymentType === 'cash' && styles.paymentTypeBtnActive]}
                  onPress={() => setPaymentType('cash')}
                >
                  <Text style={[styles.paymentTypeText, paymentType === 'cash' && styles.paymentTypeTextActive]}>
                    Tunai / Cash Langsung
                  </Text>
                  <Text style={styles.paymentTypeDesc}>Langsung memotong kas operasional toko</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.paymentTypeBtn, paymentType === 'tempo' && styles.paymentTypeBtnActive]}
                  onPress={() => setPaymentType('tempo')}
                >
                  <Text style={[styles.paymentTypeText, paymentType === 'tempo' && styles.paymentTypeTextActive]}>
                    Tempo / Hutang Supplier
                  </Text>
                  <Text style={styles.paymentTypeDesc}>Tercatat di buku hutang sampai dilunasi</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Opsi Jatuh Tempo (Hanya untuk Tempo) */}
            {paymentType === 'tempo' && (
              <Card style={styles.tempoConfigCard}>
                <Text style={styles.label}>Fleksibilitas Jatuh Tempo</Text>

                <View style={styles.tempoRadioRow}>
                  <TouchableOpacity
                    style={[styles.radioItem, !hasDueDate && styles.radioItemSelected]}
                    onPress={() => {
                      setHasDueDate(false);
                      setDueDateString('');
                    }}
                  >
                    <View style={[styles.radioCircle, !hasDueDate && styles.radioCircleActive]} />
                    <Text style={styles.radioLabel}>Tidak Ada Jatuh Tempo (Santai)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.radioItem, hasDueDate && styles.radioItemSelected]}
                    onPress={() => setHasDueDate(true)}
                  >
                    <View style={[styles.radioCircle, hasDueDate && styles.radioCircleActive]} />
                    <Text style={styles.radioLabel}>Ada Jatuh Tempo</Text>
                  </TouchableOpacity>
                </View>

                {hasDueDate && (
                  <View style={styles.dueDateBox}>
                    <Text style={styles.inputSubLabel}>Pilih Batas Waktu Cepat:</Text>
                    <View style={styles.quickDateRow}>
                      <TouchableOpacity
                        style={styles.quickDatePill}
                        onPress={() => handleSetQuickDueDate(3)}
                      >
                        <Text style={styles.quickDateText}>+3 Hari</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickDatePill}
                        onPress={() => handleSetQuickDueDate(7)}
                      >
                        <Text style={styles.quickDateText}>+7 Hari (1 Mgg)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickDatePill}
                        onPress={() => handleSetQuickDueDate(14)}
                      >
                        <Text style={styles.quickDateText}>+14 Hari (2 Mgg)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickDatePill}
                        onPress={() => handleSetQuickDueDate(30)}
                      >
                        <Text style={styles.quickDateText}>+30 Hari (1 Bln)</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.inputSubLabel, { marginTop: 8 }]}>
                      Tanggal Jatuh Tempo (YYYY-MM-DD):
                    </Text>
                    <TextInput
                      style={styles.dateInput}
                      placeholder="Contoh: 2026-11-20"
                      placeholderTextColor={Colors.textMuted}
                      value={dueDateString}
                      onChangeText={setDueDateString}
                    />
                  </View>
                )}
              </Card>
            )}

            {/* Catatan / Keterangan */}
            <View style={styles.section}>
              <Text style={styles.label}>Keterangan Barang / Catatan</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Contoh: Beras Rojo Lele 25kg, Telur 10kg, Minyak Goreng 2 jerigen"
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            {/* Foto Nota Supplier */}
            <View style={styles.section}>
              <Text style={styles.label}>Foto Bukti Nota Supplier (Opsional)</Text>
              {photoUri ? (
                <View style={styles.photoPreviewBox}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  <View style={styles.photoActions}>
                    <Button
                      title="Ganti Foto"
                      variant="outline"
                      size="sm"
                      onPress={handlePickImage}
                    />
                    <Button
                      title="Hapus"
                      variant="danger"
                      size="sm"
                      onPress={() => setPhotoUri(null)}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  title="Ambil Foto Nota Pembelian"
                  variant="outline"
                  onPress={handlePickImage}
                />
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Simpan Pembelian"
              variant="primary"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Supplier Modal */}
      <SupplierModal
        visible={showSupplierModal}
        supplier={null}
        onClose={() => setShowSupplierModal(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 620,
    height: '85%',
    minHeight: 460,
    maxHeight: '90%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b5563',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    gap: 16,
  },
  section: {
    gap: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  supplierScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  supplierPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  supplierPillSelected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  supplierPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  supplierPillTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  emptySupplierText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  amountInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  amountPreview: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  paymentTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentTypeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  paymentTypeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  paymentTypeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentTypeTextActive: {
    color: Colors.primary,
  },
  paymentTypeDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  tempoConfigCard: {
    padding: 12,
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
    borderWidth: 1,
    gap: 10,
  },
  tempoRadioRow: {
    flexDirection: 'row',
    gap: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioItemSelected: {},
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  radioCircleActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  dueDateBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fef08a',
  },
  inputSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  quickDatePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  dateInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  notesInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
  },
  photoPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  photoPreview: {
    width: 70,
    height: 70,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  photoActions: {
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

