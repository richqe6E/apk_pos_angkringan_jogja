# Temuan Bug 6: Error "unregistered ActivityResultLauncher" Saat Upload Foto QRIS di Pengaturan

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:51 WIB
- **Halaman:** `app/(tabs)/settings.tsx` (Pengaturan & Preferensi Sistem - Section QRIS Toko)
- **File Bukti:** `.user_uploaded/media_1794106249530_5688bdf7.png`
- **Pesan Error:**
  ```text
  Gagal Memilih Foto
  Call to function 'ExponentImagePicker.launchImageLibraryAsync' has been rejected.
  → Caused by: java.lang.IllegalStateException: Attempting to launch an unregistered ActivityResultLauncher with contract expo.modules.imagepicker.contracts.ImageLibraryContract and input ImageLibraryContractOptions... You must ensure the ActivityResultLauncher is registered before calling launch()
  ```
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Mengapa Hal Ini Bisa Terjadi? (Analisis Penyebab Teknis)
1. **Tidak Ada Permintaan Izin Akses Runtime (`requestMediaLibraryPermissionsAsync`):**
   - Di `app/(tabs)/settings.tsx` baris 114–121, fungsi `handlePickQrisImage` langsung memanggil `ImagePicker.launchImageLibraryAsync()` tanpa terlebih dahulu memeriksa atau meminta izin ke sistem Android via `ImagePicker.requestMediaLibraryPermissionsAsync()`.
2. **Mekanisme AndroidX `ActivityResultLauncher` pada Android 13/14+ (API 33+):**
   - Pada arsitektur Expo SDK 52 di Android modern, Android OS mewajibkan izin media (`READ_MEDIA_IMAGES`) terdaftar dan diverifikasi pada siklus hidup (*lifecycle*) Activity sebelum memicu kontrak `ImageLibraryContract`.
   - Ketika fungsi pemilih galeri ditembak langsung saat izin runtime belum siap, Android Activity melempar `IllegalStateException` karena ActivityResultLauncher belum ter-register saat eksekusi `launch()`.
   - Sebaliknya, pada `menu-form-modal.tsx`, pemanggilan galeri berjalan aman karena diawali dengan `await ImagePicker.requestMediaLibraryPermissionsAsync()`.

## Catatan Solusi Awal (Ditampung)
- Di `app/(tabs)/settings.tsx`:
  1. Tambahkan pengecekan dan permintaan izin eksplisit sebelum membuka galeri:
     ```ts
     const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
     if (!perm.granted) {
       Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin akses galeri untuk memilih foto QRIS.');
       return;
     }
     ```
  2. Sediakan dialog pilihan: **"Pilih dari Galeri"** atau **"Ambil Foto dengan Kamera"** (lengkap dengan izin kamera `requestCameraPermissionsAsync`), sehingga pemilik toko bisa langsung memotret stiker barcode QRIS fisik di meja kasir maupun memilih screenshot e-wallet.
