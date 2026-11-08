import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { formatRupiahDisplay, formatRupiahInput, parseRupiahInput } from '../utils/formatRupiah';
import { useFinancialStore } from '../stores/financialStore';

interface MonthlyCogsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function MonthlyCogsModal({ visible, onClose }: MonthlyCogsModalProps) {
  const db = useSQLiteContext();
  const { selectedMonth, summary, saveMonthlyCogs } = useFinancialStore();

  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountText(summary.monthlyCogs > 0 ? formatRupiahInput(summary.monthlyCogs) : '');
      setNotes(summary.monthlyCogsNotes || '');
    }
  }, [visible, summary.monthlyCogs, summary.monthlyCogsNotes]);

  const handleAmountChange = (text: string) => {
    const rawNumber = parseRupiahInput(text);
    if (rawNumber === 0 && text.trim() === '') {
      setAmountText('');
    } else {
      setAmountText(formatRupiahInput(rawNumber));
    }
  };

  const handleSave = async () => {
    const amount = parseRupiahInput(amountText);
    if (amount < 0) {
      Alert.alert('Perhatian', 'Nominal HPP tidak boleh bernilai negatif.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveMonthlyCogs(db, selectedMonth, amount, notes.trim());
      Alert.alert(
        'Sukses',
        `HPP Global periode ${selectedMonth} senilai ${formatRupiahDisplay(amount)} berhasil disimpan.`
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan.');
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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Input HPP Global Bulanan (Owner)</Text>
              <Text style={styles.subtitle}>
                Periode Bulan: {selectedMonth} (Konsep HPP Fleksibel Angkringan)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* Guide Card Opsi A */}
            <Card style={styles.guideCard}>
              <Text style={styles.guideTitle}>💡 Petunjuk Perhitungan HPP Opsi A:</Text>
              <Text style={styles.guideText}>
                Karena resep angkringan sangat bervariasi dan dinamis, pemilik cukup memasukkan total
                belanja bahan baku yang terpakai selama 1 bulan penuh:
              </Text>
              <Text style={styles.guideFormula}>
                HPP = Stok Awal Bulan + Total Pembelian Bahan - Sisa Stok Akhir Bulan
              </Text>
            </Card>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Total Nominal HPP Bahan Baku Bulan Ini (Rp) *</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Contoh: 8.500.000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={amountText}
                onChangeText={handleAmountChange}
              />
              {parseRupiahInput(amountText) > 0 ? (
                <Text style={styles.amountPreview}>
                  Preview: {formatRupiahDisplay(parseRupiahInput(amountText))}
                </Text>
              ) : (
                <Text style={styles.amountPreviewEmpty}>
                  Masukkan estimasi total belanja bahan terpakai
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Catatan Perhitungan Owner (Opsional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Contoh: Total belanja beras, ayam usus, ati ampela, wedangan, dan bahan basah pasar"
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Simpan HPP Bulanan"
              variant="primary"
              loading={isSubmitting}
              onPress={handleSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 540,
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
    maxHeight: 450,
  },
  bodyContent: {
    padding: 18,
    gap: 16,
  },
  guideCard: {
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6,
  },
  guideTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  guideText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 17,
  },
  guideFormula: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac',
    marginTop: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
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
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  amountPreview: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  amountPreviewEmpty: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

