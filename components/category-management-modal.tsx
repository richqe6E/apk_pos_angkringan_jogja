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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ModalHeader } from './ui/modal-header';
import { useMenuStore, Category } from '../stores/menuStore';

interface CategoryManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCategory?: (categoryId: number | null) => void;
}

export function CategoryManagementModal({
  visible,
  onClose,
  onSelectCategory,
}: CategoryManagementModalProps) {
  const db = useSQLiteContext();
  const { categories, menus, addCategory, updateCategory, deleteCategory } = useMenuStore();

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      Alert.alert('Perhatian', 'Nama kategori wajib diisi.');
      return;
    }

    const isDuplicate = categories.some(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      Alert.alert('Perhatian', `Kategori "${trimmed}" sudah ada.`);
      return;
    }

    setIsAdding(true);
    try {
      const newId = await addCategory(db, trimmed);
      setNewCategoryName('');
      setIsAdding(false);
      onSelectCategory?.(newId);
    } catch (err: any) {
      setIsAdding(false);
      Alert.alert('Gagal Menambahkan', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      Alert.alert('Perhatian', 'Nama kategori wajib diisi.');
      return;
    }

    const isDuplicate = categories.some(
      (c) => c.id !== id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      Alert.alert('Perhatian', `Kategori "${trimmed}" sudah ada.`);
      return;
    }

    setIsUpdating(true);
    try {
      await updateCategory(db, id, trimmed);
      setEditingId(null);
      setEditingName('');
      setIsUpdating(false);
    } catch (err: any) {
      setIsUpdating(false);
      Alert.alert('Gagal Mengubah', err?.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleDeleteCategory = (category: Category) => {
    const count = menus.filter((m) => m.category_id === category.id).length;
    const warningMsg = count > 0
      ? `Kategori "${category.name}" memiliki ${count} menu.\nMenghapus kategori ini akan mengubah menu-menu tersebut menjadi tanpa kategori. Lanjutkan?`
      : `Yakin ingin menghapus kategori "${category.name}"?`;

    Alert.alert('Hapus Kategori', warningMsg, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(db, category.id);
          } catch (err: any) {
            Alert.alert('Gagal Menghapus', err?.message || 'Terjadi kesalahan sistem.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalBox}>
            {/* Header Modal Modern */}
            <ModalHeader
              title="Kelola Kategori Menu"
              subtitle={`Tambah, ubah nama, atau hapus kategori (${categories.length} kategori)`}
              icon="tag"
              onClose={onClose}
            />

            {/* Input Tambah Kategori Baru */}
            <View style={styles.addSection}>
              <TextInput
                style={styles.addInput}
                placeholder="Nama kategori baru (contoh: Nasi Bakar)..."
                placeholderTextColor={Colors.textMuted}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <Button
                title="+ Tambah"
                variant="primary"
                size="sm"
                loading={isAdding}
                onPress={handleAddCategory}
                style={styles.addBtn}
              />
            </View>

            {/* Daftar Kategori */}
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              {categories.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Belum ada kategori menu.</Text>
                </View>
              ) : (
                categories.map((cat) => {
                  const productCount = menus.filter((m) => m.category_id === cat.id).length;
                  const isBeingEdited = editingId === cat.id;

                  if (isBeingEdited) {
                    return (
                      <View key={cat.id} style={styles.editRow}>
                        <TextInput
                          style={styles.editInput}
                          value={editingName}
                          onChangeText={setEditingName}
                          autoFocus
                          placeholder="Nama kategori..."
                          placeholderTextColor={Colors.textMuted}
                        />
                        <View style={styles.editRowActions}>
                          <Button
                            title="Batal"
                            variant="outline"
                            size="sm"
                            onPress={handleCancelEdit}
                          />
                          <Button
                            title="Simpan"
                            variant="primary"
                            size="sm"
                            loading={isUpdating}
                            onPress={() => handleSaveEdit(cat.id)}
                          />
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={cat.id} style={styles.categoryRow}>
                      <View style={styles.categoryInfo}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Badge
                          label={`${productCount} menu`}
                          variant={productCount > 0 ? 'neutral' : 'warning'}
                          size="sm"
                        />
                      </View>

                      <View style={styles.actionButtons}>
                        <Button
                          title="Ubah"
                          variant="outline"
                          size="sm"
                          onPress={() => handleStartEdit(cat)}
                          style={styles.actionBtn}
                        />
                        <Button
                          title="Hapus"
                          variant="danger"
                          size="sm"
                          onPress={() => handleDeleteCategory(cat)}
                          style={styles.actionBtn}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Button title="Tutup" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    width: '100%',
    maxWidth: 520,
    height: '80%',
    maxHeight: '90%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    height: '100%',
    maxHeight: '100%',
    display: 'flex',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b5563',
  },
  addSection: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  addBtn: {
    minWidth: 90,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    minWidth: 60,
  },
  editRow: {
    padding: 12,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 10,
  },
  editInput: {
    height: 42,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: Colors.text,
  },
  editRowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#ffffff',
  },
});
