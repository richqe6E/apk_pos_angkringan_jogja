# Plan Perbaikan Bug 2: Form Multi-Tier Reward Kosong & Tombol Header Tak Terbaca

## 1. Identifikasi & Akar Masalah
- **Masalah 1:** Modal pengaturan multi-tier reward (`components/reward-tier-modal.tsx`) menampilkan dialog kosong tanpa form input, hanya menyisakan tombol *"Selesai"*.
  - **Akar Masalah:** Serupa dengan Bug 1, `styles.modalBox` hanya memiliki `maxHeight: '90%'` tanpa tinggi pasti, sedangkan child `<ScrollView style={styles.body}>` menggunakan `flex: 1`, menyebabkan collapse 0px pada layout engine Android.
- **Masalah 2:** Tombol aksi di pojok kanan atas header `app/customers.tsx` (*"Atur Tingkatan Reward"*) terlihat seperti kotak outline kosong tanpa teks yang terbaca.
  - **Akar Masalah:** Tombol menggunakan `variant="outline"` pada header bertema hijau (`Colors.primary`). Secara default, `Button` varian outline memberi warna teks `Colors.primary` (`#059669`). Teks hijau tua di atas latar header hijau tua menyebabkan teks tidak kontras dan menjadi kasat mata (invisible).

## 2. Batasan Kerja & Keamanan Sistem
- Tidak mengubah logika CRUD tier reward, validasi duplikasi, maupun tabel `customer_tiers`.
- Mempertahankan struktur komponen `Button` umum, hanya menerapkan penyesuaian kontras yang tepat untuk tombol di dalam header.

## 3. Langkah Rencana Perbaikan
1. **Perbaikan Layout Modal (`components/reward-tier-modal.tsx`):**
   - Pada `styles.modalBox`: berikan `height: '85%'`, `minHeight: 460`, dan `maxHeight: '90%'`.
   - Pastikan form tambah tier, daftar tier tersimpan, tombol edit, dan tombol hapus muncul dengan proporsi yang rapi.
2. **Perbaikan Kontras Tombol Header (`app/customers.tsx`):**
   - Tambahkan style khusus untuk tombol outline di header: border semi-transparan putih (`borderColor: 'rgba(255, 255, 255, 0.6)'`), latar belakang transparan/subtle, dan teks eksplisit warna putih terang (`textStyle={{ color: '#ffffff' }}`).
   - Terapkan pada tombol *"Atur Tingkatan Reward"*.

## 4. Kriteria Verifikasi
- Modal multi-tier reward terbuka dengan form input tier baru dan daftar tier yang sudah ada terlihat jelas.
- Tombol *"Atur Tingkatan Reward"* di pojok kanan atas header terbaca jelas dengan teks putih dan bingkai rapi.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
