# Temuan Bug 4: Tombol Header Absensi Kosong & Teks Tanggal "undefined, NaN undefined NaN"

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:50 WIB
- **Halaman:** `app/(tabs)/attendance.tsx` (Absensi & Manajemen Karyawan)
- **File Bukti:** `.user_uploaded/media_1794106199281_e64f6284.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Deskripsi Masalah & Narasi Pengguna
1. **Tombol Header Kanan Atas Tidak Terbaca:**
   - Di pojok kanan atas header hijau (sebelah badge jam `10:12:32 WIB`), tombol aksi hanya berupa kotak outline kosong `[          ]` tanpa teks terbaca.

2. **Judul Rincian Tanggal Rusak ("undefined, NaN undefined NaN"):**
   - Pada tab *Rekap & Riwayat*, judul kartu rekap kehadiran tertulis:
     `📅 Rincian Absensi: undefined, NaN undefined NaN`
   - Hal ini terjadi karena state tanggal terpilih (`selectedDate`) belum terinisialisasi dengan tanggal hari ini saat tab dibuka, atau pemanggilan fungsi pemformat tanggal Indonesia (`formatFullIndonesianDate`) menerima format string yang `undefined` / gagal di-parse oleh objek `Date`.

## Catatan Investigasi Awal
- Di `app/(tabs)/attendance.tsx`:
  - Periksa inisialisasi state tanggal kalender (pastikan defaultnya langsung terisi tanggal operasional aktif `getBusinessDate()` saat pertama kali dimuat).
  - Berikan pengaman (*fallback*) pada fungsi pemformat tanggal agar tidak pernah mencetak `undefined, NaN undefined NaN`.
  - Ubah warna teks tombol header kanan atas menjadi putih kontras (`#ffffff`).
