# Plan Perbaikan Bug 7: Hapus Tautan "Buka Form Lengkap" di Quick Edit Menu

## 1. Identifikasi & Akar Masalah
- **Masalah:** Pada modal *"Quick Edit Menu"* (`components/quick-edit-modal.tsx`), terdapat tombol/tautan teks *"⚙️ Buka Form Lengkap (Kategori, Foto, Barcode)"*.
  - Pengguna mengonfirmasi bahwa tautan tersebut membingungkan dan tidak diperlukan di layar kasir cepat, karena penambahan/pengeditan menu utama sudah memiliki form modal tersendiri di tab Menu.
  - Sesuai prinsip *Ponytail / Lazy Senior Dev*, elemen berlebih yang membingungkan dan tidak diinginkan pengguna harus dihilangkan.

## 2. Batasan Kerja & Keamanan Sistem
- Tidak menghapus fitur esensial dari Quick Edit: pengeditan cepat nama menu, harga jual, penyesuaian stok porsi (+/- stepper), tombol hapus menu, dan simpan.
- Komponen `MenuFormModal` di tab Menu tetap berjalan utuh untuk manajemen katalog lengkap.

## 3. Langkah Rencana Perbaikan
1. **Pembersihan Elemen di `components/quick-edit-modal.tsx`:**
   - Hapus blok tautan:
     ```tsx
     {/* Opsi Edit Lengkap */}
     {onOpenFullEdit && (
       <TouchableOpacity
         style={styles.fullEditLink}
         onPress={() => {
           onClose();
           onOpenFullEdit();
         }}
       >
         <Text style={styles.fullEditText}>⚙️ Buka Form Lengkap (Kategori, Foto, Barcode)</Text>
       </TouchableOpacity>
     )}
     ```
   - Hapus style yang tidak terpakai lagi: `fullEditLink` dan `fullEditText`.
   - Prop `onOpenFullEdit?: () => void` dapat dipertahankan sebagai opsional tanpa efek samping, atau dihapus jika tidak ada pemanggil yang memerlukannya.

## 4. Kriteria Verifikasi
- Tampilan dialog *"Quick Edit Menu"* menjadi ringkas, fokus hanya pada perubahan nama, harga, stepper stok, tombol hapus, dan tombol simpan.
- Tidak ada tombol atau tautan *"Buka Form Lengkap"*.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
