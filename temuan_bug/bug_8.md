# Temuan Bug 8: Kustomisasi Bebas Tipe Meja & Evaluasi Fungsi Pengelompokan

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:51 WIB
- **Halaman:** `components/table-selector-modal.tsx` (Dialog Edit & Tambah Meja di Layar Kasir)
- **File Bukti:** `.user_uploaded/media_1794106295819_8c33777d.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Analisis Fungsi Tipe Meja Saat Ini
1. **Fungsi dan Integrasi Tipe Meja:**
   - Pada kode saat ini, *Tipe Meja* **hanya berfungsi sebagai filter tab pengelompokan visual** di dalam modal pemilih meja (menyaring tampilan kartu meja ke tab *"Semua"*, *"Meja"*, *"Lesehan"*, dan *"Lainnya"*).
   - Tipe meja **TIDAK masuk ke database transaksi** (tabel `transactions` hanya menyimpan kolom `table_number`), **TIDAK dicetak di struk kasir/dapur**, dan **TIDAK mempengaruhi laporan keuangan**.
2. **Kelemahan Implementasi Saat Ini:**
   - Pilihan tipe meja dikunci kaku (*hardcoded*) ke 3 pilihan: `Meja Reguler`, `Lesehan`, dan `Lainnya / VIP`. Pemilik warung/angkringan tidak bisa membuat kategori area sendiri (misal: "Lantai 2", "Outdoor", "Tenda Depan", "VIP AC").

## Arahan Pengguna & Rencana Solusi (Ditampung)
1. **Hilangkan Pilihan Kaku:** Hapus 3 tombol opsi kaku (`Meja Reguler`, `Lesehan`, `Lainnya / VIP`).
2. **Input Teks Bebas & Bawaan Kosong:**
   - Jadikan tipe/area meja berupa input teks bebas (*custom area/tipe*) dengan nilai bawaan kosong (*opsional*).
   - Pemilik bisa mengetik nama tipe/area sesuai tata letak warung mereka (misalnya: "Lesehan Depan", "Outdoor", "Teras", dll.).
3. **Tab Filter Dinamis:**
   - Tab filter di dalam modal pemilih meja akan otomatis membentuk tab sesuai nama-nama tipe meja unik yang dibuat oleh pemilik, sehingga kasir dapat memfilter meja per area secara dinamis.
