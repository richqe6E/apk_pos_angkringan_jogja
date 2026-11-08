# Temuan Bug 5: Form Catat Mutasi Buku Kas Toko Kosong Melompong

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:50 WIB
- **Halaman:** `app/(tabs)/financial.tsx` (Keuangan) & `components/cash-entry-modal.tsx`
- **File Bukti:** `.user_uploaded/media_1794106229562_afccfc9e.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Deskripsi Masalah & Narasi Pengguna
1. **Form Input Mutasi Kas Tidak Muncul:**
   - Saat tombol `+ Catat Kas` ditekan, modal *Catat Mutasi Buku Kas Toko* muncul di layar tetapi isi formulir (pilihan Kas Keluar / Kas Masuk, klasifikasi Laba Rugi PnL, pilihan kategori preset, input nominal uang, dan catatan) hilang sama sekali.
   - Yang terlihat pada modal hanyalah judul header dan tombol footer (*Batal* / *Simpan Transaksi Kas*).

## Catatan Investigasi Awal
- Pola ini identik dengan Bug 1 (`purchase-form-modal.tsx`) dan Bug 2 (`reward-tier-modal.tsx`).
- Penyebab utama di React Native Android:
  - Kontainer `modalBox` memiliki style `maxHeight: '90%'` (tanpa `height` atau `minHeight`), lalu komponen anak `<ScrollView style={{ flex: 1 }}>` menghitung tinggi yang tersedia sebagai 0px, sehingga seluruh isi form terkompresi hilang.
  - Solusi sistemik: Ganti struktur layout modal dengan `height: '80%'` / `minHeight: 400` atau gunakan `KeyboardAvoidingView` ber-height tetap yang stabil di tablet dan HP Android, lalu audit seluruh modal lain (`monthly-cogs-modal.tsx`, `supplier-modal.tsx`, `customer-form-modal.tsx`, dll.) agar tidak ada modal yang kolaps.
