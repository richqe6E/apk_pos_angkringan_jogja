import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { AttendanceRecord } from '../stores/attendanceStore';

/**
 * Service untuk Export Laporan ke PDF dan CSV / Excel
 * 100% Offline via expo-print & expo-sharing
 */

export async function exportAttendanceToPdf(records: AttendanceRecord[], periodLabel: string = 'Bulan Ini') {
  if (records.length === 0) {
    throw new Error('Tidak ada data absensi untuk diexport.');
  }

  const tableRowsHtml = records
    .map(
      (r, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center;">${index + 1}</td>
        <td style="padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: 600;">${r.employee_name}</td>
        <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center;">${r.business_date}</td>
        <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center;">${r.check_in_time} WIB</td>
        <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center;">
          ${r.check_out_time ? `${r.check_out_time} WIB` : '<span style="color: #d97706;">Aktif</span>'}
        </td>
        <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center;">
          ${
            r.is_late === 1
              ? `<span style="color: #b91c1c; font-weight: 700;">Terlambat (${r.late_minutes} mnt)</span>`
              : `<span style="color: #059669; font-weight: 700;">Tepat Waktu</span>`
          }
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Rekap Absensi Karyawan - Angkringan Jogja</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
            padding: 24px;
            margin: 0;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #059669;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 20px;
            font-weight: bold;
            color: #059669;
            margin: 0;
          }
          .subtitle {
            font-size: 13px;
            color: #4b5563;
            margin-top: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background-color: #059669;
            color: #ffffff;
            font-weight: 600;
            padding: 10px;
            border: 1px solid #059669;
            text-align: center;
          }
          .footer {
            margin-top: 30px;
            font-size: 11px;
            color: #6b7280;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ANGKRINGAN JOGJA</div>
          <div class="subtitle">Laporan Rekap Absensi Karyawan (${periodLabel})</div>
          <div class="subtitle">Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">No</th>
              <th>Nama Karyawan</th>
              <th>Tanggal Operasional</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Status Kedatangan</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          Dicetak otomatis oleh Sistem POS Angkringan Jogja (Offline Mode)
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Bagikan Laporan Absensi (PDF)',
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Export Laporan Rekap Absensi 1 Bulan Penuh ke PDF
 * Lengkap dengan Kartu Statistik, Matriks Per Staf, dan Log Detail Harian
 */
export async function exportMonthlyAttendanceToPdf(
  records: AttendanceRecord[],
  monthStr: string,
  storeName: string = 'ANGKRINGAN JOGJA'
) {
  if (records.length === 0) {
    throw new Error('Tidak ada data absensi pada bulan ini untuk diexport.');
  }

  const [y, m] = monthStr.split('-').map(Number);
  const monthName = MONTH_NAMES_ID[(m || 1) - 1] || monthStr;
  const periodLabel = `${monthName} ${y}`;

  // 1. Hitung ringkasan statistik
  const totalHadir = records.length;
  const onTimeRecords = records.filter((r) => r.is_late === 0);
  const lateRecords = records.filter((r) => r.is_late === 1);
  const totalOnTime = onTimeRecords.length;
  const totalLate = lateRecords.length;
  const totalLateMinutes = records.reduce((acc, r) => acc + (r.late_minutes || 0), 0);
  const disciplineRate = totalHadir > 0 ? Math.round((totalOnTime / totalHadir) * 100) : 0;
  const uniqueDatesCount = new Set(records.map((r) => r.business_date)).size;

  // 2. Agregasi per karyawan
  const empMap: Record<
    string,
    {
      id: number;
      name: string;
      hadir: number;
      tepatWaktu: number;
      terlambat: number;
      totalMenit: number;
    }
  > = {};

  for (const r of records) {
    const key = String(r.employee_id || r.employee_name);
    if (!empMap[key]) {
      empMap[key] = {
        id: r.employee_id,
        name: r.employee_name,
        hadir: 0,
        tepatWaktu: 0,
        terlambat: 0,
        totalMenit: 0,
      };
    }
    empMap[key].hadir += 1;
    if (r.is_late === 1) {
      empMap[key].terlambat += 1;
      empMap[key].totalMenit += r.late_minutes || 0;
    } else {
      empMap[key].tepatWaktu += 1;
    }
  }

  const empSummaries = Object.values(empMap).sort((a, b) => b.hadir - a.hadir || a.name.localeCompare(b.name));

  const empSummaryRowsHtml = empSummaries
    .map(
      (emp, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; text-align: center;">${idx + 1}</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; font-weight: 600;">${emp.name}</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; text-align: center; font-weight: 700;">${emp.hadir} hari</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; text-align: center; color: #059669; font-weight: 600;">${emp.tepatWaktu}</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; text-align: center; color: ${emp.terlambat > 0 ? '#b91c1c' : '#4b5563'}; font-weight: 600;">${emp.terlambat}</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; text-align: center; color: ${emp.totalMenit > 0 ? '#b91c1c' : '#4b5563'};">${emp.totalMenit} mnt</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; text-align: center; font-weight: 700; color: ${emp.hadir > 0 && (emp.tepatWaktu / emp.hadir) >= 0.8 ? '#059669' : '#d97706'};">
          ${emp.hadir > 0 ? Math.round((emp.tepatWaktu / emp.hadir) * 100) : 0}%
        </td>
      </tr>
    `
    )
    .join('');

  // 3. Urutkan seluruh catatan harian berdasarkan tanggal naik dan jam masuk
  const sortedRecords = [...records].sort((a, b) => {
    if (a.business_date !== b.business_date) {
      return a.business_date.localeCompare(b.business_date);
    }
    return a.check_in_time.localeCompare(b.check_in_time);
  });

  const dailyRowsHtml = sortedRecords
    .map(
      (r, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${index + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${r.business_date}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; font-weight: 600;">${r.employee_name}</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">${r.check_in_time} WIB</td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">
          ${r.check_out_time ? `${r.check_out_time} WIB` : '<span style="color: #d97706;">Aktif</span>'}
        </td>
        <td style="padding: 6px 8px; border: 1px solid #e5e7eb; text-align: center;">
          ${
            r.is_late === 1
              ? `<span style="color: #b91c1c; font-weight: 700;">Terlambat (${r.late_minutes} mnt)</span>`
              : `<span style="color: #059669; font-weight: 700;">Tepat Waktu</span>`
          }
        </td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Laporan Absensi Bulanan - ${storeName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            padding: 10px;
            margin: 0;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #059669;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .title {
            font-size: 20px;
            font-weight: 800;
            color: #059669;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .subtitle {
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-top: 4px;
          }
          .meta {
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            border-left: 3px solid #059669;
            padding-left: 8px;
            margin-top: 18px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 16px;
          }
          th {
            background-color: #059669;
            color: #ffffff;
            font-weight: 700;
            padding: 8px 6px;
            border: 1px solid #059669;
            text-align: center;
          }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #e5e7eb;
            padding-top: 8px;
            font-size: 10px;
            color: #94a3b8;
            display: flex;
            justifyContent: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${storeName}</div>
          <div class="subtitle">LAPORAN REKAPITULASI ABSENSI BULANAN</div>
          <div class="meta">Periode: <strong>${periodLabel}</strong> • Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}</div>
        </div>

        <!-- 4 Kotak Ringkasan Eksekutif -->
        <table style="border: none; margin-bottom: 15px;">
          <tr>
            <td style="border: 1px solid #e2e8f0; background: #f0fdf4; padding: 10px; text-align: center; width: 25%;">
              <div style="font-size: 10px; color: #166534; font-weight: 700;">TOTAL KEHADIRAN</div>
              <div style="font-size: 18px; font-weight: 900; color: #059669;">${totalHadir} Hari</div>
              <div style="font-size: 9px; color: #4b5563;">${uniqueDatesCount} hari operasional</div>
            </td>
            <td style="border: 1px solid #e2e8f0; background: #f0fdf4; padding: 10px; text-align: center; width: 25%;">
              <div style="font-size: 10px; color: #166534; font-weight: 700;">TEPAT WAKTU</div>
              <div style="font-size: 18px; font-weight: 900; color: #059669;">${totalOnTime}</div>
              <div style="font-size: 9px; color: #4b5563;">Tingkat Disiplin: ${disciplineRate}%</div>
            </td>
            <td style="border: 1px solid #e2e8f0; background: #fef2f2; padding: 10px; text-align: center; width: 25%;">
              <div style="font-size: 10px; color: #991b1b; font-weight: 700;">TERLAMBAT</div>
              <div style="font-size: 18px; font-weight: 900; color: #dc2626;">${totalLate}</div>
              <div style="font-size: 9px; color: #dc2626;">${totalHadir > 0 ? Math.round((totalLate / totalHadir) * 100) : 0}% dari total hadir</div>
            </td>
            <td style="border: 1px solid #e2e8f0; background: #fffbeb; padding: 10px; text-align: center; width: 25%;">
              <div style="font-size: 10px; color: #92400e; font-weight: 700;">TOTAL TELAT</div>
              <div style="font-size: 18px; font-weight: 900; color: #d97706;">${totalLateMinutes} Menit</div>
              <div style="font-size: 9px; color: #92400e;">Rata-rata: ${totalLate > 0 ? Math.round(totalLateMinutes / totalLate) : 0} mnt/telat</div>
            </td>
          </tr>
        </table>

        <!-- Ringkasan Per Karyawan -->
        <div class="section-title">1. Matriks Rekapitulasi Per Staf (${empSummaries.length} Orang)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th>Nama Karyawan</th>
              <th style="width: 80px;">Total Hadir</th>
              <th style="width: 80px;">Tepat Waktu</th>
              <th style="width: 75px;">Terlambat</th>
              <th style="width: 90px;">Total Telat</th>
              <th style="width: 80px;">Disiplin</th>
            </tr>
          </thead>
          <tbody>
            ${empSummaryRowsHtml}
          </tbody>
        </table>

        <!-- Rincian Seluruh Transaksi Absensi Harian -->
        <div class="section-title">2. Log Rincian Absensi Harian (${sortedRecords.length} Catatan)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 85px;">Tanggal</th>
              <th>Nama Karyawan</th>
              <th style="width: 85px;">Jam Masuk</th>
              <th style="width: 85px;">Jam Pulang</th>
              <th style="width: 130px;">Status Kedatangan</th>
            </tr>
          </thead>
          <tbody>
            ${dailyRowsHtml}
          </tbody>
        </table>

        <table style="border: none; margin-top: 30px; font-size: 11px;">
          <tr>
            <td style="border: none; text-align: left; width: 50%;">
              <div>Disiapkan secara otomatis oleh Sistem POS</div>
              <div style="margin-top: 40px; font-weight: 700;">Admin / Kasir Toko</div>
            </td>
            <td style="border: none; text-align: right; width: 50%;">
              <div>Mengetahui & Menyetujui,</div>
              <div style="margin-top: 40px; font-weight: 700;">Owner / Pemilik Usaha</div>
            </td>
          </tr>
        </table>

        <div class="footer">
          <span>POS Angkringan Jogja • Sistem Absensi Terintegrasi</span>
          <span>Dicetak melalui expo-print offline</span>
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bagikan Laporan Absensi (${periodLabel})`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

export async function exportAttendanceToCsv(records: AttendanceRecord[], filenamePrefix: string = 'rekap_absensi') {
  if (records.length === 0) {
    throw new Error('Tidak ada data absensi untuk diexport.');
  }

  const headers = ['No', 'ID Karyawan', 'Nama Karyawan', 'Tanggal Operasional', 'Jam Masuk', 'Jam Pulang', 'Status', 'Menit Terlambat'];
  const rows = records.map((r, i) => [
    i + 1,
    r.employee_id,
    `"${r.employee_name.replace(/"/g, '""')}"`,
    r.business_date,
    `${r.check_in_time} WIB`,
    r.check_out_time ? `${r.check_out_time} WIB` : 'Aktif',
    r.is_late === 1 ? 'Terlambat' : 'Tepat Waktu',
    r.late_minutes,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}/${filenamePrefix}_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Bagikan Rekap Absensi (CSV / Excel)',
    });
  }
  return fileUri;
}

/**
 * Universal HTML Table to PDF Exporter
 */
export async function exportTableToPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  summaryLines: string[] = []
) {
  const tableHeadersHtml = headers
    .map((h) => `<th style="padding: 8px; border: 1px solid #059669; text-align: left;">${h}</th>`)
    .join('');

  const tableRowsHtml = rows
    .map(
      (row, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        ${row
          .map(
            (cell) => `<td style="padding: 8px; border: 1px solid #e5e7eb; font-size: 11px;">${cell}</td>`
          )
          .join('')}
      </tr>
    `
    )
    .join('');

  const summariesHtml = summaryLines.length > 0
    ? `<div style="margin-top: 16px; padding: 10px; background-color: #f3f4f6; border-radius: 4px; font-size: 12px; font-weight: 600;">
        ${summaryLines.map((s) => `<div>${s}</div>`).join('')}
      </div>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; padding: 24px; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; color: #059669; }
          .subtitle { font-size: 12px; color: #4b5563; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #059669; color: #ffffff; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ANGKRINGAN JOGJA</div>
          <div class="subtitle">${title} - ${subtitle}</div>
        </div>
        <table>
          <thead><tr>${tableHeadersHtml}</tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
        ${summariesHtml}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bagikan ${title} (PDF)`,
    });
  }
  return uri;
}

/**
 * Universal CSV Exporter
 */
export async function exportTableToCsv(
  filenamePrefix: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((c) => {
          const str = String(c);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    ),
  ].join('\r\n');

  const fileUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}/${filenamePrefix}_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Bagikan ${filenamePrefix} (CSV)`,
    });
  }
  return fileUri;
}
