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
import { Supplier, usePurchaseStore } from '../stores/purchaseStore';

interface SupplierModalProps {
  visible: boolean;
  supplier: Supplier | null;
  onClose: () => void;
}

export function SupplierModal({ visible, supplier, onClose }: SupplierModalProps) {
  const db = useSQLiteContext();
  const { suppliers, addSupplier, updateSupplier } = usePurchaseStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setPhone(supplier.phone || '');
    } else {
      setName('');
      setPhone('');
    }
  }, [supplier, visible]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Perhatian', 'Nama supplier wajib diisi.');
      return;
    }

    const isDuplicate = suppliers.some(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase() && s.id !== supplier?.id
    );
    if (isDuplicate) {
      Alert.alert('Perhatian', 'Nama supplier sudah terdaftar.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (supplier) {
        await updateSupplier(db, supplier.id, trimmedName, phone.trim());
        Alert.alert('Sukses', `Data supplier ${trimmedName} berhasil diperbarui.`);
      } else {
        await addSupplier(db, trimmedName, phone.trim());
        Alert.alert('Sukses', `Supplier ${trimmedName} berhasil didaftarkan.`);
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
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
            <Text style={styles.title}>
              {supplier ? 'Edit Data Supplier' : '+ Tambah Supplier Baru'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Supplier / Toko Grosir *</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Grosir Telur Pak Slamet / Pasar Beringharjo"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nomor Telepon / WhatsApp (Opsional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: 0812-3456-7890"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={supplier ? 'Perbarui' : 'Simpan Supplier'}
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
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 480,
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
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
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
    padding: 18,
    gap: 14,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

