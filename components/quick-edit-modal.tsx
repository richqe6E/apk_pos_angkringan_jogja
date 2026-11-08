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
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { MenuItem, useMenuStore } from '../stores/menuStore';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { formatRupiahInput, parseRupiahInput, formatRupiahDisplay } from '../utils/formatRupiah';

interface QuickEditModalProps {
  visible: boolean;
  menuItem: MenuItem | null;
  onClose: () => void;
  onOpenFullEdit?: () => void;
}

export function QuickEditModal({
  visible,
  menuItem,
  onClose,
  onOpenFullEdit,
}: QuickEditModalProps) {
  const db = useSQLiteContext();
  const { quickEditMenu, deleteMenu } = useMenuStore();

  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [stock, setStock] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && menuItem) {
      setName(menuItem.name);
      setPriceText(formatRupiahInput(menuItem.price));
      setStock(menuItem.stock || 0);
      setIsSubmitting(false);
    }
  }, [visible, menuItem]);

  if (!menuItem) return null;

  const handlePriceChange = (txt: string) => {
    const raw = parseRupiahInput(txt);
    if (raw === 0 && txt.trim() === '') {
      setPriceText('');
    } else {
      setPriceText(formatRupiahInput(raw));
    }
  };

  const adjustStock = (delta: number) => {
    setStock((prev) => Math.max(0, prev + delta));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Perhatian', 'Nama menu tidak boleh kosong.');
      return;
    }

    const price = parseRupiahInput(priceText);
    if (price < 0) {
      Alert.alert('Perhatian', 'Harga jual tidak boleh negatif.');
      return;
    }

    setIsSubmitting(true);
    try {
      await quickEditMenu(db, menuItem.id, price, stock, trimmedName);
      Alert.alert('Sukses', `Menu "${trimmedName}" berhasil diperbarui.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Memperbarui', err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Menu?',
      `Apakah Anda yakin ingin menghapus "${menuItem.name}" dari katalog? Menu tidak akan muncul lagi di kasir.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Menu',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenu(db, menuItem.id);
              Alert.alert('Sukses', `Menu "${menuItem.name}" berhasil dihapus.`);
              onClose();
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err?.message || 'Terjadi kesalahan sistem.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Card style={styles.dialogBox}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogTitle}>Quick Edit Menu</Text>
              <Text style={styles.dialogSubtitle}>Ubah cepat harga, stok, atau hapus menu</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nama Menu</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Nama menu..."
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Harga Jual (Rp)</Text>
            <TextInput
              style={styles.textInput}
              value={priceText}
              onChangeText={handlePriceChange}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Sisa Stok Tersedia (Porsi / Tusuk)</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustStock(-5)}>
                <Text style={styles.stepperBtnText}>-5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustStock(-1)}>
                <Text style={styles.stepperBtnText}>-1</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.stockInput}
                value={stock.toString()}
                onChangeText={(txt) => {
                  const cleaned = txt.replace(/\D/g, '');
                  setStock(cleaned ? parseInt(cleaned, 10) : 0);
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustStock(1)}>
                <Text style={styles.stepperBtnText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustStock(5)}>
                <Text style={styles.stepperBtnText}>+5</Text>
              </TouchableOpacity>
            </View>
          </View>


          {/* Actions */}
          <View style={styles.actionRow}>
            <Button
              title="🗑️ Hapus Menu"
              variant="danger"
              size="sm"
              onPress={handleDelete}
              style={{ flex: 1 }}
            />
            <Button
              title="Simpan"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onPress={handleSave}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
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
  dialogBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 440,
    padding: 20,
    gap: 14,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  stockInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  fullEditLink: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  fullEditText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
});
