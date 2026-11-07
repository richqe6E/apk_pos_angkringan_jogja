import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatRupiahDisplay, formatRupiahInput, parseRupiahInput } from '../utils/formatRupiah';
import { RewardTier, useCustomerStore } from '../stores/customerStore';

interface RewardTierModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RewardTierModal({ visible, onClose }: RewardTierModalProps) {
  const db = useSQLiteContext();
  const { rewardTiers, loadRewardTiers, addRewardTier, updateRewardTier, deleteRewardTier } = useCustomerStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tierName, setTierName] = useState('');
  const [minSpendText, setMinSpendText] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && db) {
      loadRewardTiers(db).catch((e) => console.warn('Error loading reward tiers:', e));
      resetForm();
    }
  }, [visible, db]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setTierName('');
    setMinSpendText('');
    setRewardDescription('');
  };

  const handleStartEdit = (t: RewardTier) => {
    setIsEditing(true);
    setEditingId(t.id);
    setTierName(t.tier_name);
    setMinSpendText(formatRupiahInput(t.min_spend));
    setRewardDescription(t.reward_description);
  };

  const handleMinSpendChange = (txt: string) => {
    const rawNum = parseRupiahInput(txt);
    if (rawNum === 0 && txt.trim() === '') {
      setMinSpendText('');
    } else {
      setMinSpendText(formatRupiahInput(rawNum));
    }
  };

  const handleSave = async () => {
    const trimmedTierName = tierName.trim();
    if (!trimmedTierName) {
      Alert.alert('Perhatian', 'Nama tingkatan tier reward wajib diisi.');
      return;
    }

    const minSpend = parseRupiahInput(minSpendText);
    if (minSpend <= 0) {
      Alert.alert('Perhatian', 'Ambang batas belanja minimal harus lebih dari Rp 0.');
      return;
    }

    const trimmedRewardDesc = rewardDescription.trim();
    if (!trimmedRewardDesc) {
      Alert.alert('Perhatian', 'Deskripsi hadiah reward wajib diisi.');
      return;
    }

    const isDuplicate = rewardTiers.some(
      (t) => t.tier_name.trim().toLowerCase() === trimmedTierName.toLowerCase() && t.id !== editingId
    );
    if (isDuplicate) {
      Alert.alert('Perhatian', 'Nama tingkatan reward sudah terdaftar.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateRewardTier(db, editingId, trimmedTierName, minSpend, trimmedRewardDesc);
        Alert.alert('Sukses', `Tingkatan reward ${trimmedTierName} berhasil diperbarui.`);
      } else {
        await addRewardTier(db, trimmedTierName, minSpend, trimmedRewardDesc);
        Alert.alert('Sukses', `Tingkatan reward ${trimmedTierName} berhasil ditambahkan.`);
      }
      resetForm();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (t: RewardTier) => {
    Alert.alert(
      'Hapus Tingkatan Reward?',
      `Yakin ingin menghapus tier ${t.tier_name}? Pelanggan yang telah mencapai tier ini tidak akan mendapatkan indikator tier tersebut.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRewardTier(db, t.id);
              Alert.alert('Sukses', `Tingkatan reward ${t.tier_name} berhasil dihapus.`);
              if (editingId === t.id) resetForm();
            } catch (err: any) {
              Alert.alert('Gagal Hapus', err.message);
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
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Pengaturan Multi-Tier Reward</Text>
              <Text style={styles.subtitle}>
                Atur ambang batas akumulasi belanja seumur hidup & hadiah pelanggan
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {/* Form Tambah / Edit */}
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingId ? 'Edit Tingkatan Reward' : '+ Tambah Tingkatan Reward Baru'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nama Tingkatan / Tier</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: Tier Silver / Juragan Sate"
                  placeholderTextColor={Colors.textMuted}
                  value={tierName}
                  onChangeText={setTierName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ambang Batas Belanja Minimal (Rp)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: 500.000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={minSpendText}
                  onChangeText={handleMinSpendChange}
                />
                {parseRupiahInput(minSpendText) > 0 && (
                  <Text style={styles.amountPreview}>
                    Preview: {formatRupiahDisplay(parseRupiahInput(minSpendText))}
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Deskripsi Hadiah / Reward</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: Gratis 5 Tusuk Sate Usus & Wedang Jahe"
                  placeholderTextColor={Colors.textMuted}
                  value={rewardDescription}
                  onChangeText={setRewardDescription}
                />
              </View>

              <View style={styles.formActions}>
                {editingId && (
                  <Button
                    title="Batal Edit"
                    variant="outline"
                    onPress={resetForm}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title={editingId ? 'Perbarui Tier' : 'Simpan Tier'}
                  variant="primary"
                  loading={isSaving}
                  onPress={handleSave}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>

            {/* List Tiers */}
            <Text style={styles.listTitle}>Daftar Tingkatan Reward Aktif</Text>
            {rewardTiers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Belum ada tingkatan reward yang dibuat. Silakan tambahkan tingkat pertama.
                </Text>
              </View>
            ) : (
              rewardTiers.map((t, idx) => (
                <Card key={t.id} style={styles.tierItemCard}>
                  <View style={styles.tierItemLeft}>
                    <View style={styles.tierHeader}>
                      <Badge label={`Tier ${idx + 1}`} variant="primary" />
                      <Text style={styles.tierName}>{t.tier_name}</Text>
                    </View>
                    <Text style={styles.tierMinSpend}>
                      Ambang Belanja: {formatRupiahDisplay(t.min_spend)}
                    </Text>
                    <Text style={styles.tierReward}>Hadiah: {t.reward_description}</Text>
                  </View>

                  <View style={styles.tierActions}>
                    <Button
                      title="Edit"
                      variant="outline"
                      size="sm"
                      onPress={() => handleStartEdit(t)}
                    />
                    <Button
                      title="Hapus"
                      variant="danger"
                      size="sm"
                      onPress={() => handleDelete(t)}
                    />
                  </View>
                </Card>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button title="Selesai" variant="primary" onPress={onClose} style={{ minWidth: 120 }} />
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
    maxWidth: 620,
    maxHeight: '90%',
    display: 'flex',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
    padding: 16,
    gap: 12,
  },
  formCard: {
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#ffffff',
  },
  amountPreview: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  tierItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  tierItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tierName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  tierMinSpend: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
  },
  tierReward: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tierActions: {
    flexDirection: 'row',
    gap: 6,
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

