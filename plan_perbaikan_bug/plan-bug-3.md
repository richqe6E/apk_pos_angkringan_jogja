# Plan Perbaikan Bug 3: Tombol Aksi Header Modul Keuangan Tidak Terlihat Teksnya

## 1. Identifikasi & Akar Masalah
- **Masalah:** Pada modul Laporan Keuangan & Buku Kas (`app/(tabs)/financial.tsx`), di pojok kanan atas header terdapat 3 tombol yang tampak seperti kotak kosong tanpa tulisan (*"Unduh PDF"*, *"Unduh CSV"*, *"HPP Global"*). Hanya tombol *"+ Catat Kas"* yang terlihat.
- **Akar Masalah:**
  - Ketiga tombol tersebut dikonfigurasi dengan properti `variant="outline"`.
  - Di dalam `components/ui/button.tsx`, varian outline menerapkan `color: Colors.primary` (`#059669`) dan `borderColor: Colors.primary`.
  - Karena header keuangan memiliki latar belakang hijau `Colors.primary`, teks dan garis border hijau menyatu total dengan latar belakang, sehingga teks tidak terbaca sama sekali di layar tablet.
  - Sebaliknya, tombol *"+ Catat Kas"* menggunakan varian default (`primary`) dengan teks putih sehingga tetap terlihat.

## 2. Batasan Kerja & Keamanan Sistem
- Tidak mengubah logika ekspor PDF (`exportTableToPdf`), ekspor CSV (`exportFinancialReportCsv`), maupun modal HPP Global (`monthly-cogs-modal.tsx`).
- Menjaga fungsi tombol tetap 100% aktif dan dapat ditekan.

## 3. Langkah Rencana Perbaikan
1. **Perbaikan Style Tombol Header di `app/(tabs)/financial.tsx`:**
   - Definisikan style tombol header outline yang tepat:
     ```tsx
     headerOutlineBtn: {
       borderColor: 'rgba(255, 255, 255, 0.6)',
       backgroundColor: 'rgba(255, 255, 255, 0.12)',
     },
     headerOutlineBtnText: {
       color: '#ffffff',
       fontWeight: '700',
     }
     ```
   - Terapkan `style={[styles.headerBtn, styles.headerOutlineBtn]}` dan `textStyle={styles.headerOutlineBtnText}` pada:
     - Tombol *"Unduh PDF"*
     - Tombol *"Unduh CSV"*
     - Tombol *"HPP Global"*
   - Tombol *"+ Catat Kas"* dipertahankan dengan style solid yang menonjol sebagai Call-to-Action utama.

## 4. Kriteria Verifikasi
- Pada header modul keuangan, teks *"Unduh PDF"*, *"Unduh CSV"*, dan *"HPP Global"* terbaca tajam dan jelas berwarna putih dengan bingkai elegan.
- Saat tombol ditekan, dialog export PDF/CSV dan modal HPP Global tetap berfungsi sempurna.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
