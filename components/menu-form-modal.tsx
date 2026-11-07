import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../constants/theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { formatRupiahDisplay, parseRupiahInput } from '../utils/formatRupiah';
import { MenuItem, useMenuStore } from '../stores/menuStore';
import { saveImageLocally } from '../utils/imageStorage';

interface MenuFormModalProps {
  visible: boolean;
  menuItem: MenuItem | null;
  onClose: () => void;
}

export function MenuFormModal({ visible, menuItem, onClose }: MenuFormModalProps) {
  const db = useSQLiteContext();
  const { categories, addMenu, updateMenu } = useMenuStore();

  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [trackStock, setTrackStock] = useState(false);
  const [stockText, setStockText] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (menuItem) {
      setName(menuItem.name);
      setPriceText(menuItem.price.toString());
      setSelectedCatId(menuItem.category_id);
      setTrackStock(menuItem.track_stock === 1);
      setStockText(menuItem.stock.toString());
      setBarcode(menuItem.barcode || '');
      setPhotoUri(menuItem.image_path || null);
    } else {
      setName('');
      setPriceText('');
      setSelectedCatId(categories.length > 0 ? categories[0].id : null);
      setTrackStock(false);
      setStockText('0');
      setBarcode('');
      setPhotoUri(null);
    }
  }, [menuItem, visible, categories]);

  const handlePickImage = async () => {
    Alert.alert('Foto Menu Angkringan', 'Pilih sumber gambar:', [
      {
        text: 'Buka Kamera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Izin Ditolak', 'Izin kamera diperlukan.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            setPhotoUri(res.assets[0].uri);
          }
        },
      },
      {
        text: 'Pilih dari Galeri',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Izin Ditolak', 'Izin galeri diperlukan.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            setPhotoUri(res.assets[0].uri);
          }
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama menu wajib diisi.');
      return;
    }

    const price = parseRupiahInput(priceText);
    if (price <= 0) {
      Alert.alert('Perhatian', 'Harga jual harus lebih dari Rp 0.');
      return;
    }

    const stock = trackStock ? parseInt(stockText || '0', 10) : 0;

    setIsSubmitting(true);
    try {
      let finalPhotoPath = photoUri || '';
      if (photoUri && !photoUri.startsWith('file://') && !photoUri.startsWith('/')) {
        finalPhotoPath = await saveImageLocally(photoUri, 'menus');
      }

      if (menuItem) {
        await updateMenu(db, menuItem.id, {
          name: name.trim(),
          price,
          category_id: selectedCatId,
          track_stock: trackStock ? 1 : 0,
          stock,
          barcode: barcode.trim(),
          image_path: finalPhotoPath,
        });
        Alert.alert('Sukses', `Menu ${name} berhasil diperbarui.`);
      } else {
        await addMenu(db, {
          name: name.trim(),
          price,
          category_id: selectedCatId,
          track_stock: trackStock ? 1 : 0,
          stock,
          barcode: barcode.trim(),
          image_path: finalPhotoPath,
        });
        Alert.alert('Sukses', `Menu ${name} berhasil ditambahkan ke katalog.`);
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
              {menuItem ? 'Edit Menu Angkringan' : '+ Tambah Menu Baru'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Foto Menu */}
            <View style={styles.photoSection}>
              {photoUri ? (
                <View style={styles.photoPreviewBox}>
                  <Image source={{ uri: photoUri }} style={styles.photoImg} />
                  <View style={styles.photoBtns}>
                    <Button
                      title="Ganti Foto"
                      variant="outline"
                      size="sm"
                      onPress={handlePickImage}
                    />
                    <Button
                      title="Hapus"
                      variant="danger"
                      size="sm"
                      onPress={() => setPhotoUri(null)}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  title="+ Pasang Foto Menu"
                  variant="outline"
                  onPress={handlePickImage}
                />
              )}
            </View>

            {/* Nama Menu */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nama Menu Makanan / Minuman *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: Nasi Kucing Sambal Teri / Sate Usus"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Harga Jual */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Harga Jual (Rp) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Contoh: 3000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={priceText}
                onChangeText={setPriceText}
              />
              {parseRupiahInput(priceText) > 0 && (
                <Text style={styles.pricePreview}>
                  {formatRupiahDisplay(parseRupiahInput(priceText))}
                </Text>
              )}
            </View>

            {/* Kategori */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kategori Menu</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.map((c) => {
                  const isSelected = selectedCatId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.catPill, isSelected && styles.catPillActive]}
                      onPress={() => setSelectedCatId(c.id)}
                    >
                      <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Stok Management */}
            <Card style={styles.stockCard}>
              <Text style={styles.label}>Manajemen Stok Produk</Text>
              <View style={styles.stockToggleRow}>
                <TouchableOpacity
                  style={[styles.stockToggleBtn, !trackStock && styles.stockToggleBtnActive]}
                  onPress={() => setTrackStock(false)}
                >
                  <Text style={[styles.stockToggleText, !trackStock && styles.stockToggleTextActive]}>
                    Unlimited (Tanpa Batas)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.stockToggleBtn, trackStock && styles.stockToggleBtnActive]}
                  onPress={() => setTrackStock(true)}
                >
                  <Text style={[styles.stockToggleText, trackStock && styles.stockToggleTextActive]}>
                    Pantau Jumlah Stok
                  </Text>
                </TouchableOpacity>
              </View>

              {trackStock && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.subLabel}>Sisa Stok Tersedia (Porsi / Tusuk):</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: 25"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={stockText}
                    onChangeText={setStockText}
                  />
                </View>
              )}
            </Card>

            {/* Barcode / SKU */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kode Barcode / SKU (Opsional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Scan barcode atau ketik manual..."
                placeholderTextColor={Colors.textMuted}
                value={barcode}
                onChangeText={setBarcode}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={menuItem ? 'Simpan Perubahan' : 'Tambahkan Menu'}
              variant="primary"
              loading={isSubmitting}
              onPress={handleSubmit}
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
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    display: 'flex',
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
    fontSize: 18,
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
    flex: 1,
  },
  bodyContent: {
    padding: 18,
    gap: 14,
  },
  photoSection: {
    alignItems: 'center',
  },
  photoPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photoImg: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  photoBtns: {
    gap: 8,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
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
  pricePreview: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  catScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  catPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  catPillTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  stockCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  stockToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stockToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#ffffff',
  },
  stockToggleBtnActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  stockToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  stockToggleTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

