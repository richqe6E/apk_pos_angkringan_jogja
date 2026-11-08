/**
 * Helper Cerdas untuk Operasional Shift Malam Angkringan (17.30 - 01.00+ WIB).
 * Memisahkan tanggal kalender fisik dengan tanggal buku operasional (business_date).
 */

/**
 * Menghasilkan tanggal bisnis (YYYY-MM-DD).
 * Jika jam transaksi berada di antara pukul 00:00 - 05:59 dini hari,
 * maka transaksi dianggap sebagai kelanjutan sesi operasional malam hari sebelumnya.
 */
export function getBusinessDate(targetDate: Date = new Date()): string {
  const d = new Date(targetDate);
  const hour = d.getHours();

  // Jika lewat tengah malam (00.00 - 05.59), kurangi 1 hari agar masuk tanggal sesi buka kemarin sore
  if (hour < 6) {
    d.setDate(d.getDate() - 1);
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Menghasilkan format tanggal lengkap bahasa Indonesia:
 * Contoh: "Jumat, 06 November 2026"
 */
export function formatFullIndonesianDate(targetDate: Date | string = new Date()): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  let d: Date;
  if (typeof targetDate === 'string') {
    const trimmed = targetDate.trim();
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      d = new Date(y, m, day);
    } else {
      d = new Date(trimmed);
    }
  } else {
    d = targetDate;
  }

  if (!d || isNaN(d.getTime())) {
    d = new Date();
  }

  const dayName = days[d.getDay()] || 'Minggu';
  const dayNum = String(d.getDate()).padStart(2, '0');
  const monthName = months[d.getMonth()] || 'Januari';
  const year = d.getFullYear();

  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

/**
 * Menghasilkan format jam realtime:
 * Contoh: "19:45:10 WIB"
 */
export function formatRealtimeClock(targetDate: Date = new Date()): string {
  const hours = String(targetDate.getHours()).padStart(2, '0');
  const minutes = String(targetDate.getMinutes()).padStart(2, '0');
  const seconds = String(targetDate.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} WIB`;
}

/**
 * Menghitung status dan menit keterlambatan absensi karyawan (Patokan Masuk: 17.30 WIB).
 */
export function calculateAttendanceStatus(now: Date = new Date()): {
  isLate: boolean;
  lateMinutes: number;
  timeString: string;
} {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // Patokan: 17:30 = 17 * 60 + 30 = 1050 menit sejak 00:00
  const currentTotalMinutes = hours * 60 + minutes;
  const targetMinutes = 17 * 60 + 30;

  // Jika jam < 6 (dini hari), karyawan datang larut malam sekali
  if (hours < 6) {
    // 24 jam + current minutes - 17:30
    const lateMinutes = (24 * 60 + currentTotalMinutes) - targetMinutes;
    return { isLate: true, lateMinutes, timeString };
  }

  if (currentTotalMinutes > targetMinutes) {
    const lateMinutes = currentTotalMinutes - targetMinutes;
    return { isLate: true, lateMinutes, timeString };
  }

  return { isLate: false, lateMinutes: 0, timeString };
}

