# Temuan Bug 9: Redesain Kartu Absensi Hari Ini (Rapi & Minimalis), Tanggal Undefined, dan Tombol Header

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 10:24 WIB
- **Halaman:** `app/(tabs)/attendance.tsx` (Tab "Absensi Hari Ini")
- **File Bukti:** `.user_uploaded/media_1794106315171_2413c1a5.png`
- **Status:** PENDING (Menampung temuan, menunggu arahan pembuatan plan dari user)

## Detail Masalah & Analisis
1. **Tata Letak Kartu Karyawan Tidak Rapi:**
   - Kartu presensi karyawan aktif (`staffCard`) memiliki tata letak kaku: teks nama karyawan, label status absen di pojok kanan atas, nomor telepon, dan tombol raksasa *"Ambil Foto & Absen Masuk"* tidak sejajar rapi (*misaligned*).
   - Pengguna meminta desain ulang yang **rapi, bersih, dan minimalis** agar nyaman dilihat dan intuitif digunakan kasir/karyawan saat operasional.
2. **Error Teks Tanggal Operasional (`undefined, NaN undefined NaN`):**
   - Di bawah judul header terdapat blok info *"TANGGAL OPERASIONAL ANGKRIKAN"* yang menampilkan teks rusak: `undefined, NaN undefined NaN`.
   - **Akar Masalah:** Di `utils/sessionHelper.ts`, fungsi `formatFullIndonesianDate` menggunakan `.replace(/-/g, '/')` yang menghasilkan format string tidak standar bagi JavaScript engine Hermes di Android (`new Date("2026/11/08")` menghasilkan `Invalid Date`), sehingga pembacaan tanggal/bulan/tahun menghasilkan `NaN` dan array index lookup menjadi `undefined`.
3. **Tombol Header Kanan Atas Tidak Terlihat Teksnya:**
   - Seperti pada modul Keuangan (Bug 3) dan Rekap Absensi (Bug 4), tombol di kanan atas header hijau hanya berupa kotak outline tanpa teks yang terbaca.

## Rencana Solusi (Ditampung)
1. **Redesain Kartu Presensi Karyawan (Rapi & Minimalis):**
   - Tata ulang komponen kartu: avatar inisial/foto karyawan yang bersih di sebelah kiri, info nama tebal dan peran/no HP di tengah, badge status kehadiran yang rapi di sudut kanan, dan tombol aksi presensi yang proporsional dan elegan di bawah atau sampingnya.
   - Pastikan kerapian padding (*white space*), sudut membulat (*border radius*), serta aksen warna status yang tenang dan minimalis.
2. **Perbaikan Parsing Tanggal di `sessionHelper.ts`:**
   - Hapus manipulasi string regex `-` ke `/` yang merusak parsing Hermes. Gunakan pemecahan langsung `split('-').map(Number)` atau parsing ISO yang kompatibel 100% di Hermes Android agar string tanggal selalu valid (`Minggu, 08 November 2026`).
3. **Kontras Tombol Header:**
   - Pastikan teks tombol di header selalu putih terang (`#ffffff`) dengan background/outline yang kontras.
