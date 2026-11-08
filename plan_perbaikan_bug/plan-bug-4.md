# Plan Perbaikan Bug 4: Tanggal Undefined/NaN & Tombol Header Tak Terbaca di Modul Absensi

## 1. Identifikasi & Akar Masalah
- **Masalah 1:** Subheader pada tab Rekap & Riwayat (`app/(tabs)/attendance.tsx`) menampilkan teks tanggal yang rusak:
  `📅 Rincian Absensi: undefined, NaN undefined NaN`.
  - **Akar Masalah:**
    - Fungsi `formatFullIndonesianDate` di `utils/sessionHelper.ts` melakukan `targetDate.replace(/-/g, '/')` saat menerima string tanggal (misal `"2026-11-08"` diubah menjadi `"2026/11/08"`).
    - Format dengan garis miring `"YYYY/MM/DD"` bukan standar ECMAScript ISO-8601. Pada JavaScript engine Hermes di Android APK standalone, konstruktor `new Date("2026/11/08")` menghasilkan `Invalid Date`.
    - Ketika tanggal bernilai `Invalid Date`, method `.getDay()`, `.getDate()`, `.getMonth()`, dan `.getFullYear()` mengembalikan `NaN`. Array lookup `days[NaN]` dan `months[NaN]` bernilai `undefined`, menghasilkan string `"undefined, NaN undefined NaN"`.
- **Masalah 2:** Tombol aksi di pojok kanan atas header absensi (*"Tambah Karyawan"*) dan tombol nav di kalender (*"Bulan Ini"*) teksnya tidak terbaca / kosong.
  - **Akar Masalah:** Menggunakan `variant="outline"` di header hijau tanpa penegasan `color: '#ffffff'` pada teks tombol.

## 2. Batasan Kerja & Keamanan Sistem
- Logika shift operasional malam (`getBusinessDate`) di `utils/sessionHelper.ts` harus dipertahankan secara utuh.
- Jangan mengubah return type atau signature fungsi pembantu, agar seluruh pemanggil (`realtime-clock-badge.tsx`, `transaksi.tsx`, `attendance.tsx`) tetap kompatibel.

## 3. Langkah Rencana Perbaikan
1. **Perbaikan Fundamental pada `utils/sessionHelper.ts` (`formatFullIndonesianDate`):**
   - Hindari manipulasi string regex `-` ke `/`.
   - Gunakan parsing angka langsung yang deterministik dan tahan terhadap Hermes Android:
     ```typescript
     export function formatFullIndonesianDate(targetDate: Date | string = new Date()): string {
       const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
       const months = [
         'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
         'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
       ];

       let d: Date;
       if (typeof targetDate === 'string') {
         const parts = targetDate.trim().split('-');
         if (parts.length === 3) {
           const y = parseInt(parts[0], 10);
           const m = parseInt(parts[1], 10) - 1;
           const day = parseInt(parts[2], 10);
           d = new Date(y, m, day);
         } else {
           d = new Date(targetDate);
         }
       } else {
         d = targetDate;
       }

       if (isNaN(d.getTime())) {
         d = new Date();
       }

       const dayName = days[d.getDay()] || 'Minggu';
       const dayNum = String(d.getDate()).padStart(2, '0');
       const monthName = months[d.getMonth()] || 'Januari';
       const year = d.getFullYear();

       return `${dayName}, ${dayNum} ${monthName} ${year}`;
     }
     ```
   - Solusi ini 100% menyelesaikan masalah parsing tanggal di seluruh modul secara global.
2. **Perbaikan Tombol Header `app/(tabs)/attendance.tsx`:**
   - Tambahkan `textStyle={{ color: '#ffffff' }}` dan border putih semi-transparan pada tombol header *"Tambah Karyawan"*.

## 4. Kriteria Verifikasi
- Teks subheader absensi menampilkan tanggal resmi yang benar: contoh *"📅 Rincian Absensi: Minggu, 08 November 2026"*.
- Tidak ada lagi teks `undefined` atau `NaN` di layar absensi.
- Tombol *"Tambah Karyawan"* di pojok kanan atas terbaca jelas.
- `npx tsc --noEmit` lulus 0 error.
- Automated tests `npm test` tetap 100% pass.
