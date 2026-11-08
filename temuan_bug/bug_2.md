# Temuan Bug 2: Form Pengaturan Multi-Tier Reward Kosong & Tombol Header Tidak Terbaca

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:49 WIB
- **Halaman:** `app/customers.tsx` (Manajemen Customer & Reward) & `components/reward-tier-modal.tsx`
- **File Bukti:** `.user_uploaded/media_1794106142867_f16bba20.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Deskripsi Masalah & Narasi Pengguna
1. **Form Multi-Tier Reward Kosong Melompong:**
   - Saat modal *Pengaturan Multi-Tier Reward* dibuka, area isi form (input nama tier, ambang batas belanja minimal, deskripsi reward, tombol simpan tier, serta daftar tingkatan reward aktif) tidak muncul sama sekali. Modal hanya menampilkan header dan tombol *"Selesai"*.
2. **Tombol Header Kanan Atas Kosong:**
   - Terlihat pada screenshot di header kanan atas halaman pelanggan, tombol di sebelah `+ Tambah Pelanggan` hanya berupa kotak outline kosong tanpa teks terbaca (seharusnya bertuliskan *"Atur Tingkatan Reward"*).

## Catatan Investigasi Awal
- Pada `components/reward-tier-modal.tsx`, periksa kontainer `modalBox` dan `ScrollView` (masalah flex/height yang menyebabkan area body terkompresi hingga 0px di Android, mirip dengan Bug 1).
- Pada `app/customers.tsx`, periksa style `headerActionBtn` dan warna teks tombol agar teks *"Atur Tingkatan Reward"* terlihat jelas dengan kontras yang tepat.
