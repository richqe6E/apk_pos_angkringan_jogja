# Plan Perbaikan Bug 9: Redesain Kartu Absensi Hari Ini (Rapi & Minimalis), Tanggal Rusak, dan Tombol Header

## 1. Identifikasi & Akar Masalah
- **Masalah 1:** Tampilan kartu absensi karyawan pada tab *"Absensi Hari Ini"* (`app/(tabs)/attendance.tsx`) terkesan tidak rapi, teks nama/badge status/nomor HP tidak sejajar di setiap sudut, dan tombol presensi *"Ambil Foto & Absen Masuk"* terlalu besar dan kaku. Pengguna menginginkan desain yang **rapi, bersih, dan minimalis**.
- **Masalah 2:** Kartu informasi tanggal operasional angkringan di bawah header menampilkan error teks:
  `TANGGAL OPERASIONAL ANGKRIKAN` -> `undefined, NaN undefined NaN`.
  - **Akar Masalah:** Format `formatFullIndonesianDate(businessDate)` di `utils/sessionHelper.ts` rusak di mesin Hermes Android karena manipulasi regex `-` ke `/` yang menghasilkan `Invalid Date`.
- **Masalah 3:** Tombol pojok kanan atas header absensi (*"Tambah Karyawan"*) tidak terbaca teksnya (outline transparan).

## 2. Batasan Kerja & Keamanan Sistem
- Tidak mengubah alur kerja absensi foto kamera (`AttendanceCameraModal`), pencatatan jam masuk/pulang, toleransi keterlambatan 17.30 WIB, maupun penutupan sesi operasional toko (`closeOperatingSession`).
- Penyimpanan database tabel `attendance` dan `employees` tetap 100% konsisten.

## 3. Langkah Rencana Perbaikan
1. **Redesain Kartu Presensi Karyawan (`styles.staffCard` di `app/(tabs)/attendance.tsx`):**
   - **Struktur Kartu Minimalis:**
     - Bagian Kiri: Lingkaran avatar inisial nama karyawan (atau foto check-in thumbnail mini jika sudah hadir) dengan latar warna lembut (`Colors.primarySoft`).
     - Bagian Tengah: Nama karyawan berbobot tebal (`fontWeight: '700'`), di bawahnya no telepon atau label jabatan dengan ukuran teks proporsional dan warna tenang (`Colors.textMuted`).
     - Bagian Kanan Atas: Badge status kehadiran yang rapi (*"Belum Absen"*, *"Tepat Waktu"*, *"Terlambat X mnt"*).
     - Bagian Bawah / Aksi:
       - Jika belum absen: Tombol aksi presensi yang proporsional (*"📷 Ambil Foto & Absen Masuk"*), dengan tinggi standar (bukan blok raksasa) dan sudut membulat yang nyaman.
       - Jika sudah absen: Ringkasan jam hadir (*"Masuk: 17.15 WIB"* | *"Status: Sedang Bertugas"* atau jam pulang) dengan indikator terkunci yang bersih.
   - **Penyelarasan Spacing:** Padding dalam kartu dibuat konsisten (14px), jarak antar kartu seimbang (`gap: 12`), dan sudut membulat kartu halus (`borderRadius: 10`).
2. **Perbaikan Teks Tanggal Operasional:**
   - Melalui perbaikan fungsi `formatFullIndonesianDate` di `utils/sessionHelper.ts` (yang juga disiapkan pada Plan Bug 4), tanggal operasional akan tampil sempurna tanpa error NaN (contoh: *"Minggu, 08 November 2026"*).
3. **Perbaikan Tombol Header Kanan Atas:**
   - Pada tombol *"Tambah Karyawan"* di header absensi, tambahkan style eksplisit:
     ```tsx
     addEmpBtnHeader: {
       borderColor: 'rgba(255, 255, 255, 0.6)',
       backgroundColor: 'rgba(255, 255, 255, 0.12)',
     },
     addEmpBtnHeaderText: {
       color: '#ffffff',
       fontWeight: '700',
     }
     ```

## 4. Kriteria Verifikasi
- Tampilan kartu karyawan di tab *"Absensi Hari Ini"* terlihat rapi, bersih, seimbang, dan modern/minimalis di layar tablet maupun smartphone.
- Blok tanggal operasional menampilkan tanggal yang valid dan terbaca jelas dalam format bahasa Indonesia.
- Tombol *"Tambah Karyawan"* di header terlihat jelas dengan teks putih.
- Seluruh flow absensi (buka kamera, jepret foto, simpan presensi) tetap berjalan 100% lancar.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
