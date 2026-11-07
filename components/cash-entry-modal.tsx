import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { formatRupiahDisplay, parseRupiahInput } from '../utils/formatRupiah';
import { useFinancialStore, CreateCashInput } from '../stores/financialStore';

interface CashEntryModalProps {
  visible: boolean;
  onClose: () => void;
}

const EXPENSE_PNL_CATEGORIES = [
  'Arang Batok',
  'Listrik & Air',
  'Plastik & Sedotan',
  'Gas Elpiji',
  'Es Batu',
  'Bumbu Dapur',
  'Kebersihan & Keamanan',
  'Bahan Baku / Kulakan',
  'Lain-lain',
];

const EXPENSE_NON_PNL_CATEGORIES = [
  'Setor Tunai Bank Pemilik',
  'Prive (Penarikan Pribadi Owner)',
  'Pengembalian Modal / Pinjaman',
];

const INCOME_PNL_CATEGORIES = [
  'Pendapatan Lain-lain',
  'Penjualan Limbah / Kardus',
  'Konsinyasi / Bagi Hasil',
];

const INCOME_NON_PNL_CATEGORIES = [
  'Modal Awal Kasir / Toko',
  'Tambahan Modal Pemilik',
  'Pinjaman Masuk',
];

export function CashEntryModal({ visible, onClose }: CashEntryModalProps) {
  const db = useSQLiteContext();
  const { addCashEntry } = useFinancialStore();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [affectsPnl, setAffectsPnl] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(EXPENSE_PNL_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setType('expense');
    setAffectsPnl(true);
    setSelectedCategory(EXPENSE_PNL_CATEGORIES[0]);
    setCustomCategory('');
    setAmountText('');
    setNotes('');
  };

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    if (newType === 'expense') {
      setSelectedCategory(affectsPnl ? EXPENSE_PNL_CATEGORIES[0] : EXPENSE_NON_PNL_CATEGORIES[0]);
    } else {
      setSelectedCategory(affectsPnl ? INCOME_PNL_CATEGORIES[0] : INCOME_NON_PNL_CATEGORIES[0]);
    }
  };

  const handlePnlChange = (newAffectsPnl: boolean) => {
    setAffectsPnl(newAffectsPnl);
    if (type === 'expense') {
      setSelectedCategory(newAffectsPnl ? EXPENSE_PNL_CATEGORIES[0] : EXPENSE_NON_PNL_CATEGORIES[0]);
    } else {
      setSelectedCategory(newAffectsPnl ? INCOME_PNL_CATEGORIES[0] : INCOME_NON_PNL_CATEGORIES[0]);
    }
  };

  const getAvailableCategories = () => {
    if (type === 'expense') {
      return affectsPnl ? EXPENSE_PNL_CATEGORIES : EXPENSE_NON_PNL_CATEGORIES;
    } else {
      return affectsPnl ? INCOME_PNL_CATEGORIES : INCOME_NON_PNL_CATEGORIES;
    }
  };

  const handleSubmit = async () => {
    const amount = parseRupiahInput(amountText);
    if (amount <= 0) {
      Alert.alert('Perhatian', 'Nominal kas harus lebih dari Rp 0.');
      return;
    }

    const finalCategory = customCategory.trim() || selectedCategory;
    if (!finalCategory) {
      Alert.alert('Perhatian', 'Harap pilih atau isi kategori kas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateCashInput = {
        type,
        affects_pnl: affectsPnl,
        category: finalCategory,
        amount,
        notes: notes.trim(),
      };

      await addCashEntry(db, input);
      Alert.alert(
        'Sukses',
        `Pencatatan ${type === 'expense' ? 'kas keluar' : 'kas masuk'} senilai ${formatRupiahDisplay(amount)} berhasil disimpan.`
      );
      resetForm();
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Catat Mutasi Buku Kas Toko</Text>
              <Text style={styles.subtitle}>
                Segregasi Biaya Operasional (PnL) vs Non-Operasional (Setor/Prive)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Tipe Transaksi Kas */}
            <View style={styles.section}>
              <Text style={styles.label}>Tipe Transaksi Kas *</Text>
              <View style={styles.tabTypeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]}
                  onPress={() => handleTypeChange('expense')}
                >
                  <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>
                    Kas Keluar (Beban / Pengeluaran)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]}
                  onPress={() => handleTypeChange('income')}
                >
                  <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>
                    Kas Masuk (Pemasukan / Modal)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Segregasi Pengaruh Laba Rugi (PnL) */}
            <Card style={styles.pnlCard}>
              <Text style={styles.label}>Klasifikasi Terhadap Laba Rugi (PnL) *</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={[styles.radioItem, affectsPnl && styles.radioItemSelected]}
                  onPress={() => handlePnlChange(true)}
                >
                  <View style={[styles.radioDot, affectsPnl && styles.radioDotActive]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioTitle}>
                      {type === 'expense'
                        ? 'Biaya Operasional Toko (Masuk Laba Rugi)'
                        : 'Pendapatan Operasional (Masuk Laba Rugi)'}
                    </Text>
                    <Text style={styles.radioDesc}>
                      {type === 'expense'
                        ? 'Listrik, air, arang, plastik, gas, bumbu dsb.'
                        : 'Pendapatan operasional non-transaksi kasir.'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.radioItem, !affectsPnl && styles.radioItemSelected]}
                  onPress={() => handlePnlChange(false)}
                >
                  <View style={[styles.radioDot, !affectsPnl && styles.radioDotActive]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioTitle}>
                      {type === 'expense'
                        ? 'Non-Operasional (TIDAK Mengurangi Laba Toko)'
                        : 'Non-Operasional (TIDAK Menambah Omset Penjualan)'}
                    </Text>
                    <Text style={styles.radioDesc}>
                      {type === 'expense'
                        ? 'Setor tunai bank pemilik, prive owner, titipan modal.'
                        : 'Modal awal kasir, pinjaman masuk, suntikan modal owner.'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Kategori Pilihan Preset */}
            <View style={styles.section}>
              <Text style={styles.label}>Pilih Kategori *</Text>
              <View style={styles.categoryWrap}>
                {getAvailableCategories().map((cat) => {
                  const isSelected = selectedCategory === cat && !customCategory;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setCustomCategory('');
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          isSelected && styles.categoryPillTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder="Atau ketik kategori khusus..."
                placeholderTextColor={Colors.textMuted}
                value={customCategory}
                onChangeText={setCustomCategory}
              />
            </View>

            {/* Nominal */}
            <View style={styles.section}>
              <Text style={styles.label}>Nominal Kas (Rp) *</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Contoh: 75000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={amountText}
                onChangeText={setAmountText}
              />
              {parseRupiahInput(amountText) > 0 && (
                <Text style={styles.amountPreview}>
                  {formatRupiahDisplay(parseRupiahInput(amountText))}
                </Text>
              )}
            </View>

            {/* Catatan */}
            <View style={styles.section}>
              <Text style={styles.label}>Catatan Tambahan (Opsional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Pembelian 3 karung arang batok kelapa di pasar"
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Simpan Transaksi Kas"
              variant="primary"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
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
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  tabTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  typeBtnExpense: {
    backgroundColor: '#fef2f2',
    borderColor: Colors.danger,
  },
  typeBtnIncome: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  typeBtnTextActive: {
    color: Colors.text,
  },
  pnlCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    gap: 10,
  },
  radioRow: {
    gap: 10,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#ffffff',
  },
  radioItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#f0fdf4',
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
    marginTop: 2,
  },
  radioDotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  radioTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  radioDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryPillTextActive: {
    color: Colors.primary,
    fontWeight: '700',
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
  amountInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  amountPreview: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

