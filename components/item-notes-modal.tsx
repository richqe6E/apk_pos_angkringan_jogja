import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { AppIcon } from './ui/app-icon';
import { ModalHeader } from './ui/modal-header';

interface ItemNotesModalProps {
  visible: boolean;
  itemName: string;
  initialNotes?: string;
  onClose: () => void;
  onSave: (notes: string) => void;
}

const PRESET_CHIPS = [
  'Es Sedikit',
  'Tanpa Es / Hangat',
  'Panas',
  'Manis Sedang',
  'Tanpa Gula',
  'Pedas Sedang',
  'Sangat Pedas',
  'Bungkus / Takeaway',
  'Bakar Manis',
  'Bakar Gurih',
  'Pisah Sambal',
  'Jangan Terlalu Kering',
];

export function ItemNotesModal({
  visible,
  itemName,
  initialNotes = '',
  onClose,
  onSave,
}: ItemNotesModalProps) {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (visible) {
      setNotes(initialNotes || '');
    }
  }, [visible, initialNotes]);

  const handleChipPress = (chip: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      // Toggle or append
      const parts = trimmed.split(',').map((p) => p.trim());
      if (parts.includes(chip)) {
        return parts.filter((p) => p !== chip).join(', ');
      }
      return `${trimmed}, ${chip}`;
    });
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSave(notes.trim());
    onClose();
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNotes('');
    onSave('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <ModalHeader
            title="Catatan Pesanan"
            subtitle={itemName}
            onClose={onClose}
            icon="edit"
          />

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Pilihan Cepat (Sentuh untuk memilih):</Text>
            <View style={styles.chipsContainer}>
              {PRESET_CHIPS.map((chip) => {
                const isSelected = notes.includes(chip);
                return (
                  <TouchableOpacity
                    key={chip}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => handleChipPress(chip)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Keterangan Khusus / Tambahan:</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Contoh: jangan pakai micin, kuah dipisah, dsb."
                placeholderTextColor={Colors.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {notes.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputBtn}
                  onPress={() => setNotes('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppIcon name="close" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {initialNotes.length > 0 && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <AppIcon name="trash" size={16} color={Colors.danger} />
                <Text style={styles.deleteBtnText}>Hapus</Text>
              </TouchableOpacity>
            )}

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.7}
            >
              <AppIcon name="check" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Simpan Catatan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  content: {
    padding: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  inputContainer: {
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    padding: 10,
  },
  textInput: {
    fontSize: 14,
    color: Colors.text,
    minHeight: 64,
    lineHeight: 20,
  },
  clearInputBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#f8fafc',
    gap: 10,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.danger,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#ffffff',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
