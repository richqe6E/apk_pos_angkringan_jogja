# Plan Perbaikan Bug 1: Form Pembelian Kosong & Hapus Kata "Kulakan"

## 1. Identifikasi & Akar Masalah
- **Masalah 1:** Saat modal dialog pencatatan pembelian bahan dibuka (`components/purchase-form-modal.tsx`), area body input form kosong/kolaps dan hanya menampilkan tombol Batal/Simpan di bagian bawah.
  - **Akar Masalah:** Pada `styles.modalBox`, hanya diset `maxHeight: '90%'` tanpa `height` atau `minHeight` eksplisit. Komponen anak `<ScrollView style={styles.body}>` memiliki `flex: 1`. Di React Native Android, `flex: 1` di dalam container tanpa tinggi pasti akan menghitung tinggi kontainer sebesar 0px, sehingga scrollview terkompresi habis.
- **Masalah 2:** Teks *"Kulakan"* masih muncul di header layar, tab, dan judul modal, padahal user meminta dihapus agar tampil lebih profesional.

## 2. Batasan Kerja & Keamanan Sistem
- **JANGAN MENGUBAH** kategori database `Pembelian Bahan/Kulakan` di `stores/purchaseStore.ts` dan tabel `cash_ledger` karena kategori backend ini diverifikasi oleh automated tests dan laporan pembukuan.
- Hanya ubah label UI user-facing sesuai permintaan pengguna.

## 3. Langkah Rencana Perbaikan
1. **Perbaikan Layout Modal (`components/purchase-form-modal.tsx`):**
   - Pada `styles.modalBox`: tambahkan `height: '85%'`, `minHeight: 460`, dan pertahankan `maxHeight: '90%'`.
   - Pastikan `<ScrollView style={styles.body}>` memiliki ruang render yang pasti sehingga input supplier, nominal, jenis pembayaran, tanggal tempo, catatan, dan foto nota muncul normal.
2. **Hapus Teks "Kulakan" pada UI User-Facing:**
   - Di `components/purchase-form-modal.tsx` (baris 173):
     - Ubah `<Text style={styles.title}>Catat Pembelian Bahan / Kulakan</Text>` menjadi `<Text style={styles.title}>Catat Pembelian Bahan</Text>`.
   - Di `app/purchases.tsx`:
     - Baris 338: Ubah header title dari `Supplier & Pembelian Bahan (Kulakan)` menjadi `Supplier & Pembelian Bahan`.
     - Baris 402: Ubah label tab dari `Riwayat Pembelian & Kulakan` menjadi `Riwayat Pembelian`.

## 4. Kriteria Verifikasi
- Buka modal pembelian bahan di Android: seluruh form input tampil lengkap dan dapat di-scroll dengan lancar.
- Teks *"Kulakan"* tidak lagi terlihat di header, tab navigasi, maupun judul modal.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
