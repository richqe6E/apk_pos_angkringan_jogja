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
import { Customer, useCustomerStore } from '../stores/customerStore';

interface CustomerFormModalProps {
  visible: boolean;
  customer: Customer | null;
  onClose: () => void;
}

export function CustomerFormModal({ visible, customer, onClose }: CustomerFormModalProps) {
  const db = useSQLiteContext();
  const { addCustomer, updateCustomer } = useCustomerStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || '');
    } else {
      setName('');
      setPhone('');
    }
  }, [customer, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama pelanggan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (customer) {
        await updateCustomer(db, customer.id, name.trim(), phone.trim());
        Alert.alert('Sukses', `Data pelanggan ${name} berhasil diperbarui.`);
      } else {
        await addCustomer(db, name.trim(), phone.trim());
        Alert.alert('Sukses', `Pelanggan baru ${name} berhasil didaftarkan.`);
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
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {customer ? 'Edit Data Pelanggan' : '+ Tambah Pelanggan Baru'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.body}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Lengkap / Panggilan Pelanggan</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: Pak Budi / Mas Anto"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nomor WhatsApp / HP (Opsional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Contoh: 081234567890"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={customer ? 'Perbarui' : 'Simpan Pelanggan'}
              variant="primary"
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

