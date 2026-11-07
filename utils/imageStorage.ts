import * as FileSystem from 'expo-file-system/legacy';

export type ImageFolder = 'attendance' | 'menus' | 'purchases' | 'logo';

/**
 * Menyimpan gambar foto ke direktori dokumen internal aplikasi secara permanen.
 * Terisolasi per folder dan aman dari pembersihan otomatis sistem Android.
 */
export async function saveImageLocally(
  sourceUri: string,
  folder: ImageFolder
): Promise<string> {
  if (!sourceUri) return '';

  try {
    const rawExt = sourceUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      return sourceUri;
    }

    // Jika gambar sudah tersimpan di direktori aplikasi, gunakan langsung
    if (sourceUri.startsWith(baseDir)) {
      return sourceUri;
    }

    const targetDir = `${baseDir}${folder}/`;
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
    const destinationUri = `${targetDir}${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.warn(`[saveImageLocally] Gagal menyalin berkas gambar ke ${folder}:`, error);
    return sourceUri;
  }
}

/**
 * Menghapus seluruh berkas foto absensi untuk bulan tertentu (format periodMonth: 'YYYY-MM')
 */
export async function deleteMonthlyAttendancePhotos(monthPrefix: string): Promise<number> {
  try {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) return 0;

    const targetDir = `${baseDir}attendance/`;
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) return 0;

    const files = await FileSystem.readDirectoryAsync(targetDir);
    let deletedCount = 0;

    // Filter file berdasarkan nama prefix bulan jika ada
    for (const f of files) {
      if (f.includes(monthPrefix.replace('-', '')) || f.includes(monthPrefix)) {
        await FileSystem.deleteAsync(`${targetDir}${f}`, { idempotent: true });
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (err) {
    console.warn('Gagal menghapus foto absensi bulanan:', err);
    return 0;
  }
}

