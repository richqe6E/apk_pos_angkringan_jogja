# Plan Perbaikan Bug 8: Kustomisasi Bebas Nama Tipe Meja & Evaluasi Fungsi Pengelompokan

## 1. Identifikasi & Analisis Fungsi
- **Pertanyaan Pengguna:**
  *Apa fungsi tipe meja saat ini, terintegrasi dengan apa, dan tampil di mana?*
  - **Hasil Analisis Kode:**
    - Tipe meja saat ini **hanya berfungsi sebagai filter tab pengelompokan** di dalam modal *"Pilih & Kelola Meja"* (`components/table-selector-modal.tsx`) untuk menyaring daftar meja ke tab (*"Semua"*, *"Meja"*, *"Lesehan"*, dan *"Lainnya"*).
    - Tipe meja **TIDAK masuk ke database transaksi** (tabel `transactions` hanya menyimpan string `table_number`), **TIDAK dicetak di struk**, dan **TIDAK mempengaruhi laporan keuangan**.
- **Kebutuhan Pengguna:**
  - Pemilik angkringan ingin nama tipe meja bisa disesuaikan secara bebas (bukan opsi bawaan yang kaku), nilai bawaan dibiarkan kosong, dan pemilik bisa mengetik sendiri nama tipe/area (misal: "Lantai 2", "VIP", "Outdoor", "Tenda Depan", dll.) sesuai kebutuhan tata letak warung mereka.

## 2. Batasan Kerja & Keamanan Sistem
- Struktur data `CustomTable` harus tetap kompatibel dengan fungsi `JSON.parse` yang ada di database setting `pos_custom_tables`.
- Field `type` diubah tipe datanya menjadi fleksibel: `type?: string;`. Meja yang sudah ada tetap terbaca dengan baik tanpa migrasi destruktif.
- Automated tests di `test/challenger-boundaries-date-json.test.ts` dan `test/operational-stress-challenger.test.ts` harus tetap 100% lulus.

## 3. Langkah Rencana Perbaikan
1. **Pembaruan Antarmuka & Model di `components/table-selector-modal.tsx`:**
   - Ubah interface `CustomTable`:
     ```typescript
     export interface CustomTable {
       id: string;
       name: string;
       type?: string;
     }
     ```
2. **Penggantian Form Edit Tipe Meja:**
   - Hapus 3 tombol opsi kaku (*"Meja Reguler"*, *"Lesehan"*, *"Lainnya / VIP"*).
   - Ganti dengan `TextInput` teks bebas yang bersih:
     ```tsx
     <View style={styles.formGroup}>
       <Text style={styles.formLabel}>Tipe / Area Meja (Opsional)</Text>
       <TextInput
         style={styles.textInput}
         value={formTableType}
         onChangeText={setFormTableType}
         placeholder="Contoh: Lesehan, Outdoor, VIP, Lantai 2..."
         placeholderTextColor={Colors.textMuted}
       />
     </View>
     ```
   - Nilai default saat menambah meja baru dibuat string kosong `""`.
3. **Filter Tab Dinamis di Modal Kasir:**
   - Buat tab filter di modal pemilih meja otomatis mendeteksi nama-nama tipe meja unik yang ada pada daftar meja toko:
     - Selalu ada tab utama: *"Semua (Total)"*.
     - Ditambah tab untuk masing-masing tipe area unik yang diisi pemilik (misal: *"Outdoor"*, *"Lesehan"*, *"VIP"*).
     - Meja tanpa tipe akan selalu muncul pada tab *"Semua"*.

## 4. Kriteria Verifikasi
- Pemilik dapat mengetikkan nama area/tipe meja apa saja secara bebas atau membiarkannya kosong.
- Tab filter di kasir secara cerdas mengikuti kategori area meja yang dibuat oleh pemilik.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
