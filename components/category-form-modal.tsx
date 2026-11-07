import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { useMenuStore } from '../stores/menuStore';

interface CategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (categoryId: number) => void;
}

export function CategoryFormModal({
  visible,
  onClose,
  onSuccess,
}: CategoryFormModalProps) {
  const db = useSQLiteContext();
  const { addCategory } = useMenuStore();

  const [categoryName, setCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setCategoryName('');
      setIsSubmitting(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      Alert.alert('Perhatian', 'Nama kategori wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newId = await addCategory(db, trimmed);
      setIsSubmitting(false);
      Alert.alert('Sukses', `Kategori "${trimmed}" berhasil ditambahkan.`);
      onSuccess?.(newId);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Gagal', err?.message || 'Gagal menambahkan kategori');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogBox}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogTitle}>Tambah Kategori Baru</Text>
              <Text style={styles.dialogSubtitle}>
                Masukkan nama kategori menu (contoh: Nasi Bakar, Wedangan):
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dialogBody}>
            <TextInput
              style={styles.textInput}
              placeholder="Nama Kategori..."
              placeholderTextColor={Colors.textMuted}
              value={categoryName}
              onChangeText={setCategoryName}
              autoFocus
            />
          </View>

          <View style={styles.dialogActions}>
            <Button
              title="Batal"
              variant="outline"
              size="sm"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title="Simpan Kategori"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onPress={handleSave}
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
  dialogBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 440,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
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
  dialogBody: {
    marginBottom: 20,
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
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
});
