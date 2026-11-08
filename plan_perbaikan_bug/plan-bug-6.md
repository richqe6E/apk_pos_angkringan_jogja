# Plan Perbaikan Bug 6: Gagal Upload Foto QRIS di Layar Pengaturan (IllegalStateException)

## 1. Identifikasi & Akar Masalah
- **Masalah:** Saat menekan tombol unggah gambar QRIS di tab Pengaturan (`app/(tabs)/settings.tsx`), aplikasi memunculkan dialog error:
  `Call to function 'ExponentImagePicker.launchImageLibraryAsync' has been rejected.`
  `-> Caused by: java.lang.IllegalStateException: Attempting to launch an unregistered ActivityResultLauncher with contract expo.modules.imagepicker.contracts.ImageLibraryContract...`
- **Akar Masalah:**
  - Di `app/(tabs)/settings.tsx` baris 117, fungsi `ImagePicker.launchImageLibraryAsync` dipanggil secara langsung tanpa terlebih dahulu memeriksa dan meminta izin akses media: `ImagePicker.requestMediaLibraryPermissionsAsync()`.
  - Pada Android 13+ (API 33+) dan arsitektur AndroidX pada APK standalone (Expo EAS build), mencoba meluncurkan picker galeri tanpa prapendaftaran izin/kontrak menyebabkan sistem Android menolak peluncuran intent dan melempar `IllegalStateException`.
  - Selain itu, pemanggil di layar menu (`components/menu-form-modal.tsx`) sudah mengimplementasikan pengecekan izin dan dialog pilihan Kamera vs Galeri dengan aman, sedangkan di `settings.tsx` implementasinya masih terlewat.

## 2. Batasan Kerja & Keamanan Sistem
- Penyimpanan file lokal (`saveImageLocally`) dan penyimpanan setting database `qris_image_uri` di tabel `settings` tetap dipertahankan.
- Penanganan error harus graceful menggunakan `Alert.alert` yang ramah pengguna, bukan crash tak tertangani.

## 3. Langkah Rencana Perbaikan
1. **Pemeriksaan Izin Runtime & Dialog Sumber Gambar (`app/(tabs)/settings.tsx`):**
   - Sebelum meluncurkan `ImagePicker`, sediakan opsi bagi pengguna: *"Ambil Foto QRIS dari Kamera"* atau *"Pilih Gambar dari Galeri"*.
   - Untuk Galeri:
     ```typescript
     const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
     if (!perm.granted) {
       Alert.alert('Izin Ditolak', 'Izin akses galeri diperlukan untuk memilih gambar barcode QRIS.');
       return;
     }
     const result = await ImagePicker.launchImageLibraryAsync({
       mediaTypes: ['images'],
       allowsEditing: false,
       quality: 0.85,
     });
     ```
   - Untuk Kamera:
     ```typescript
     const perm = await ImagePicker.requestCameraPermissionsAsync();
     if (!perm.granted) {
       Alert.alert('Izin Ditolak', 'Izin akses kamera diperlukan untuk memotret barcode QRIS.');
       return;
     }
     const result = await ImagePicker.launchCameraAsync({
       quality: 0.85,
       allowsEditing: false,
     });
     ```
   - Pastikan blok `try...catch...finally` selalu menyetel `setIsPickingQris(false)` agar loading state tidak menggantung jika pengguna membatalkan atau terjadi kendala.

## 4. Kriteria Verifikasi
- Pengguna dapat memilih foto QRIS dari galeri perangkat Android atau memotret QRIS secara langsung tanpa error crash.
- Gambar QRIS yang dipilih berhasil tersimpan secara lokal dan langsung tampil di preview layar pengaturan serta layar kasir.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
