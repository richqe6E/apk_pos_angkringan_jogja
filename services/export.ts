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
