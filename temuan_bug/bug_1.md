# Temuan Bug 1: Form Input Pembelian Bahan Kosong & Hapus Kata "Kulakan"

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:48 WIB
- **Halaman:** `app/purchases.tsx` (Supplier & Pembelian Bahan) & `components/purchase-form-modal.tsx`
- **File Bukti:** `.user_uploaded/media_1794106112252_ca7e5a13.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Deskripsi Masalah & Narasi Pengguna
1. **Form Input Pembelian Kosong Melompong:**
   - Saat tombol `+ Catat Pembelian` ditekan, modal *Catat Pembelian Bahan* terbuka namun area isi form (pilihan supplier, nominal pembelian, metode pembayaran tunai/tempo, catatan, dan upload foto nota) tidak muncul sama sekali. Hanya terlihat header dan tombol footer (*Batal* / *Simpan Pembelian*).
2. **Permintaan Perubahan Teks:**
   - Hapus kata/tulisan **"Kulakan"** pada seluruh teks tampilan:
     - Header halaman: `"Supplier & Pembelian Bahan (Kulakan)"` $\rightarrow$ diubah menjadi `"Supplier & Pembelian Bahan"`.
     - Tab & Modal: `"Riwayat Pembelian & Kulakan"` / `"Catat Pembelian Bahan / Kulakan"` $\rightarrow$ kata "Kulakan" dihapus.

## Catatan Investigasi Awal
- Pada `components/purchase-form-modal.tsx`, periksa kontainer `modalBox` dan `ScrollView` (kemungkinan `maxHeight` / `height` atau masalah flex pada layout Android yang menyebabkan `body` kolaps menjadi tinggi 0px).
- Hapus semua kemunculan string `"Kulakan"` di `app/purchases.tsx` dan `components/purchase-form-modal.tsx`.
