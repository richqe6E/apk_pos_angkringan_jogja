import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

/**
 * Memilih gambar dari galeri dengan fallback otomatis ke DocumentPicker jika ExponentImagePicker
 * mengalami IllegalStateException / ActivityResultLauncher issue pada vendor Android tertentu.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Ditolak', 'Izin akses galeri foto diperlukan untuk memilih gambar.');
      return null;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        legacy: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }
      return null;
    } catch (pickerErr) {
      console.warn('ImagePicker library failed, falling back to DocumentPicker:', pickerErr);
      // Fallback transparan ke DocumentPicker (Android Storage Access Framework)
      const docResult = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!docResult.canceled && docResult.assets && docResult.assets.length > 0) {
        return docResult.assets[0].uri;
      }
      return null;
    }
  } catch (err: any) {
    console.error('Error picking image from gallery:', err);
    Alert.alert('Gagal Memilih Gambar', err?.message || 'Terjadi kesalahan saat membuka galeri foto.');
    return null;
  }
}

/**
 * Mengambil foto langsung dari kamera perangkat dengan penanganan izin dan proteksi error.
 */
export async function takePhotoFromCamera(): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Ditolak', 'Izin akses kamera diperlukan untuk mengambil foto.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (err: any) {
    console.error('Error taking photo from camera:', err);
    Alert.alert('Gagal Memotret', err?.message || 'Terjadi kesalahan saat memotret menggunakan kamera.');
    return null;
  }
}
