# Temuan Bug 3: Tiga Tombol Aksi di Pojok Kanan Atas Halaman Keuangan Tidak Terlihat

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:49 WIB
- **Halaman:** `app/(tabs)/financial.tsx` (Laporan Keuangan & Buku Kas)
- **File Bukti:** `.user_uploaded/media_1794106177884_77da0b58.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Deskripsi Masalah & Narasi Pengguna
1. **Tombol Header Kanan Atas Transparan/Tidak Terbaca:**
   - Di pojok kanan atas header hijau halaman Keuangan, terlihat 3 buah kotak tombol outline kosong `[   ] [   ] [   ]` yang teks labelnya sama sekali tidak kelihatan, hanya tombol paling kanan `[ + Catat Kas ]` yang terlihat jelas.
   - Ketiga tombol tersebut sebenarnya adalah tombol aksi:
     - Input HPP Global Bulanan
     - Unduh Laporan PDF
     - Ekspor CSV Buku Kas

2. **Pola Masalah Sistemik (Warna Teks Tombol Header):**
   - Masalah ini berkorelasi langsung dengan temuan pada Bug 2 (halaman Pelanggan) dan Bug 1 (halaman Supplier).
   - Seluruh tombol dengan `variant="outline"` yang diletakkan di dalam header hijau (`Colors.primary`) menggunakan warna teks default yang tidak kontras (gelap atau putih transparan) sehingga teksnya tidak terbaca dan hanya menyisakan bingkai kotak kosong di layar Android.

## Catatan Investigasi Awal
- Periksa `app/(tabs)/financial.tsx`, `app/customers.tsx`, `app/purchases.tsx`, `app/(tabs)/explore.tsx`, dan `app/(tabs)/history.tsx`.
- Berikan styling khusus pada tombol aksi header atau tambahkan prop/style warna teks putih eksplisit (`color: '#ffffff'`, `borderColor: 'rgba(255, 255, 255, 0.4)'`) agar seluruh label tombol header di semua modul terbaca jelas dan konsisten.
