# Temuan Bug 7: Penghapusan Tombol/Tautan "Buka Form Lengkap" di Quick Edit Kasir

## Informasi Temuan
- **Tanggal/Waktu Ditemukan:** 2026-11-08 09:51 WIB
- **Halaman:** `app/transaksi.tsx` (Layar Kasir) & `components/quick-edit-modal.tsx`
- **File Bukti:** `.user_uploaded/media_1794106277045_1f94aaaa.png`
- **Status:** PENDING (Menunggu seluruh bug terkumpul sebelum pembuatan plan)

## Penjelasan Fungsi & Arahan Pengguna
1. **Fungsi Asal Tombol:**
   - Tombol tautan `⚙️ Buka Form Lengkap (Kategori, Foto, Barcode)` sebelumnya dibuat untuk mengalihkan kasir dari dialog cepat ke modal form penuh (untuk mengganti kategori, foto, dan barcode produk). Tombol ini **bukan** untuk menambah produk baru.
2. **Arahan Pengguna:**
   - Tombol/tautan tersebut membingungkan dan tidak diperlukan di alur kasir.
   - **Tindakan:** Hapus/hilangkan tombol tautan *"Buka Form Lengkap"* tersebut dari modal dialog edit cepat kasir, sehingga tampilan tetap bersih, fokus, dan ringkas (hanya nama, harga, stepper stok `-5 / -1 / +1 / +5`, tombol Simpan, dan tombol Hapus Menu).

## Catatan Investigasi Awal
- Pada `components/quick-edit-modal.tsx`:
  - Hapus elemen TouchableOpacity dan teks `⚙️ Buka Form Lengkap (Kategori, Foto, Barcode)`.
  - Hapus state dan callback `onOpenFullForm` yang tidak lagi digunakan agar kode bersih (*lean*).
