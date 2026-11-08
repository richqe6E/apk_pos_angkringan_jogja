# Plan Perbaikan Bug 5: Form Catat Mutasi Kas Toko Kosong & Kolaps

## 1. Identifikasi & Akar Masalah
- **Masalah:** Saat tombol *"+ Catat Kas"* pada modul Keuangan ditekan, modal *"Catat Mutasi Buku Kas Toko"* (`components/cash-entry-modal.tsx`) terbuka tetapi area isian form (pilihan tipe arus kas, kategori, input nominal rupiah, dan catatan) hilang/kosong. Hanya terlihat header dan tombol *"Batal"* & *"Simpan Transaksi Kas"*.
- **Akar Masalah:**
  - Pada `styles.modalBox`, properti tinggi hanya didefinisikan dengan `maxHeight: '90%'`.
  - Di dalamnya, `<ScrollView style={styles.body}>` memiliki `flex: 1`.
  - Di Android OS, jika container induk tidak memiliki tinggi pasti (`height` atau `minHeight`), child berspesifikasi `flex: 1` akan berukuran tinggi 0px. Akibatnya seluruh elemen form kas tersembunyi.

## 2. Batasan Kerja & Keamanan Sistem
- Logika penyimpanan kasir ke tabel `cash_ledger`, segregasi PnL vs Non-PnL, dan recalculation summary keuangan tidak boleh diubah sedikit pun.
- Kategori mutasi kas yang sudah teruji (`EXPENSE_PNL_CATEGORIES`, dll.) tetap utuh.

## 3. Langkah Rencana Perbaikan
1. **Perbaikan Layout Modal (`components/cash-entry-modal.tsx`):**
   - Perbarui `styles.modalBox` dengan menambahkan:
     ```tsx
     modalBox: {
       backgroundColor: '#ffffff',
       borderRadius: 8,
       width: '100%',
       maxWidth: 620,
       height: '85%',
       minHeight: 460,
       maxHeight: '90%',
       display: 'flex',
     },
     ```
   - Pastikan `<ScrollView style={styles.body}>` memiliki batas vertikal yang jelas agar pengguna tablet dapat melihat dan menggulir seluruh form input mutasi kas dengan lancar.

## 4. Kriteria Verifikasi
- Saat tombol *"+ Catat Kas"* diklik, seluruh input form (Pengeluaran/Pemasukan, Operasional Toko / Non-Operasional, Dropdown/Pills Kategori, Nominal Rupiah dengan format otomatis, Catatan) langsung tampil lengkap.
- Pengguna dapat mengisi dan menyimpan transaksi kas ke buku kas dengan sukses.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
