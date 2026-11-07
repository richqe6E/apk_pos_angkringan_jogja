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
import { Employee, useEmployeeStore } from '../stores/employeeStore';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface EmployeeModalProps {
  visible: boolean;
  employee: Employee | null;
  onClose: () => void;
}

export function EmployeeModal({ visible, employee, onClose }: EmployeeModalProps) {
  const db = useSQLiteContext();
  const { addEmployee, updateEmployee, deleteEmployee } = useEmployeeStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setPhone(employee.phone || '');
    } else {
      setName('');
      setPhone('');
    }
  }, [employee, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama karyawan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (employee) {
        await updateEmployee(db, employee.id, name.trim(), phone.trim());
      } else {
        await addEmployee(db, name.trim(), phone.trim());
      }
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Gagal', err?.message || 'Gagal menyimpan data karyawan.');
    }
  };

  const handleDelete = () => {
    if (!employee) return;
    Alert.alert(
      'Hapus Karyawan',
      `Yakin ingin menghapus ${employee.name} dari daftar karyawan? Seluruh riwayat absensi terkait akan ikut terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmployee(db, employee.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Gagal', err?.message || 'Gagal menghapus karyawan');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {employee ? 'Edit Data Karyawan' : 'Daftarkan Karyawan Baru'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nama Lengkap Karyawan *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Budi Santoso"
              placeholderTextColor={Colors.placeholder}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Nomor WhatsApp / HP (Opsional)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Contoh: 0812-3456-7890"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <View style={styles.actions}>
            {employee && (
              <Button
                title="Hapus"
                variant="danger"
                size="md"
                onPress={handleDelete}
                style={{ flex: 1 }}
              />
            )}
            <Button
              title="Batal"
              variant="ghost"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title={employee ? 'Simpan' : 'Daftarkan'}
              variant="primary"
              size="md"
              loading={isSubmitting}
              onPress={handleSave}
              style={{ flex: 1.5 }}
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
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  closeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
});

