import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { useTransactionStore } from '../stores/transactionStore';
import { withSqliteRetry } from '../services/database';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { formatRupiahDisplay } from '../utils/formatRupiah';

interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  total_spent: number;
  total_visits: number;
  eligible_reward?: string | null;
}

interface CustomerSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CustomerSelectorModal({ visible, onClose }: CustomerSelectorModalProps) {
  const db = useSQLiteContext();
  const { customerId, setCustomer } = useTransactionStore();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomerList = async () => {
    try {
      const rows = await withSqliteRetry(() =>
        db.getAllAsync<any>('SELECT * FROM customers ORDER BY id ASC')
      );

      // Ambil seluruh tingkatan reward
      const rewards = await withSqliteRetry(() =>
        db.getAllAsync<any>('SELECT * FROM rewards ORDER BY min_spend DESC')
      );

      const list: CustomerRecord[] = (rows || []).map((c) => {
        let eligible: string | null = null;
        if (c.id > 1) {
          const match = (rewards || []).find((r) => (c.total_spent || 0) >= r.min_spend);
          if (match) eligible = match.tier_name;
        }
        return {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          total_spent: c.total_spent || 0,
          total_visits: c.total_visits || 0,
          eligible_reward: eligible,
        };
      });

      setCustomers(list);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  useEffect(() => {
    if (visible) {
      loadCustomerList();
      setShowAddForm(false);
    }
  }, [visible]);

  const handleSelect = (c: CustomerRecord) => {
    setCustomer(c.id, c.name, c.total_spent, c.eligible_reward);
    onClose();
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim()) {
      Alert.alert('Perhatian', 'Nama customer wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await withSqliteRetry(() =>
        db.runAsync(
          'INSERT INTO customers (name, phone, total_spent, total_visits) VALUES (?, ?, 0, 0)',
          [newName.trim(), newPhone.trim()]
        )
      );
      const newId = res.lastInsertRowId;
      setCustomer(newId, newName.trim(), 0, null);
      setNewName('');
      setNewPhone('');
      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      Alert.alert('Gagal', err?.message || 'Gagal menyimpan customer');
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.title}>Pilih Pelanggan / Member</Text>
              <Text style={styles.subtitle}>
                Akumulasi belanja seumur hidup & pemenuhan hadiah reward
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!showAddForm ? (
            <>
              {/* Search & Add Bar */}
              <View style={styles.topBar}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Cari nama atau nomor HP..."
                  placeholderTextColor={Colors.placeholder}
                />
                <Button
                  title="+ Member Baru"
                  variant="outline"
                  size="md"
                  onPress={() => setShowAddForm(true)}
                />
              </View>

              {/* List Customer */}
              <ScrollView style={{ maxHeight: 360 }}>
                {filtered.map((c) => {
                  const isSelected = customerId === c.id;
                  const isUmum = c.id === 1;

                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.customerCard, isSelected && styles.customerCardActive]}
                      onPress={() => handleSelect(c)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[styles.customerName, isSelected && styles.customerNameActive]}>
                            {c.name}
                          </Text>
                          {isUmum ? (
                            <Badge label="Default" variant="neutral" size="sm" />
                          ) : (
                            c.eligible_reward && (
                              <Badge label={c.eligible_reward} variant="success" size="sm" />
                            )
                          )}
                        </View>
                        {!isUmum && (
                          <Text style={styles.customerSub}>
                            {c.phone ? `${c.phone} • ` : ''}
                            Total Belanja: {formatRupiahDisplay(c.total_spent)} ({c.total_visits} kunjungan)
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Text style={styles.selectedCheck}>Terpilih ✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            /* Form Tambah Member Baru */
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Daftarkan Member Baru</Text>
              <Text style={styles.label}>Nama Lengkap Pelanggan *</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Contoh: Mas Budi Santoso"
                placeholderTextColor={Colors.placeholder}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>Nomor WhatsApp / HP (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                placeholder="Contoh: 0812-9876-5432"
                placeholderTextColor={Colors.placeholder}
              />

              <View style={styles.formActions}>
                <Button
                  title="Kembali"
                  variant="ghost"
                  size="md"
                  onPress={() => setShowAddForm(false)}
                />
                <Button
                  title="Simpan & Pilih Member"
                  variant="primary"
                  size="md"
                  loading={isSaving}
                  onPress={handleCreateCustomer}
                />
              </View>
            </View>
          )}
        </Card>
      </View>
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
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
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
  topBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  customerCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  customerNameActive: {
    color: Colors.primaryDark,
  },
  customerSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  selectedCheck: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  formContainer: {
    paddingVertical: 10,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
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
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
});

