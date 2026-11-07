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
import { formatRupiahInput, parseRupiahInput } from '../utils/formatRupiah';

interface QuickEditProductModalProps {
  visible: boolean;
  menu: MenuItem | null;
  onClose: () => void;
}

export function QuickEditProductModal({
  visible,
  menu,
  onClose,
}: QuickEditProductModalProps) {
  const db = useSQLiteContext();
  const { quickEditMenu, deleteMenu } = useMenuStore();

  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [stockText, setStockText] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (menu) {
      setName(menu.name);
      setPriceText(formatRupiahInput(menu.price));
      setStockText(String(menu.stock || 0));
    }
  }, [menu]);

  if (!menu) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama menu tidak boleh kosong.');
      return;
    }

    const price = parseRupiahInput(priceText);
    if (price <= 0) {
      Alert.alert('Perhatian', 'Harga jual harus lebih besar dari 0.');
      return;
    }

    const stock = parseInt(stockText, 10) || 0;

    setIsSubmitting(true);
    try {
      await quickEditMenu(db, menu.id, price, stock, name.trim());
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Gagal', err?.message || 'Gagal memperbarui menu');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Menu',
      `Yakin ingin menghapus menu "${menu.name}" dari katalog?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenu(db, menu.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Gagal', err?.message || 'Gagal menghapus menu');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Card style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.title}>Edit Cepat Menu</Text>
              <Text style={styles.subtitle}>Ubah nama, harga, atau stok langsung di kasir</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nama Menu</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Nasi Kucing Sambal Teri"
              placeholderTextColor={Colors.placeholder}
            />

            <Text style={styles.label}>Harga Jual (Rp)</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              value={priceText}
              onChangeText={(txt) => setPriceText(formatRupiahInput(txt))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.placeholder}
            />

            <View style={styles.stockRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Jumlah Sisa Stok</Text>
                <Text style={styles.stockDesc}>
                  {menu.track_stock === 1 ? 'Stok terlacak otomatis' : 'Menu tidak dibatasi stok (unlimited)'}
                </Text>
              </View>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const current = parseInt(stockText, 10) || 0;
                    setStockText(String(Math.max(0, current - 5)));
                  }}
                >
                  <Text style={styles.stepperBtnText}>-5</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.stockInput}
                  value={stockText}
                  onChangeText={(txt) => setStockText(txt.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const current = parseInt(stockText, 10) || 0;
                    setStockText(String(current + 5));
                  }}
                >
                  <Text style={styles.stepperBtnText}>+5</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              title="Hapus Menu"
              variant="danger"
              size="md"
              onPress={handleDelete}
              style={{ flex: 1 }}
            />
            <Button
              title="Batal"
              variant="ghost"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title="Simpan Perubahan"
              variant="primary"
              size="md"
              loading={isSubmitting}
              onPress={handleSave}
              style={{ flex: 2 }}
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  form: {
    gap: 14,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  input: {
    height: 46,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  priceInput: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.borderLight,
    padding: 12,
    borderRadius: 6,
  },
  stockDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stepperBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stockInput: {
    width: 60,
    height: 38,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
});

