/**
 * Helper simulating physical attendance photo storage and deletion logic.
 * Follows PRD R2 requirements for physical file deletion + DB clearing.
 */
export function createFileSystemSimulator() {
  const files = new Map();

  return {
    files,
    async deleteAsync(filePath) {
      if (files.has(filePath)) {
        files.delete(filePath);
        return true;
      }
      return false; // idempotent
    },
    async readDirectoryAsync(dir) {
      const result = [];
      for (const key of files.keys()) {
        if (key.startsWith(dir)) {
          result.push(key.slice(dir.length));
        }
      }
      return result;
    },
  };
}

export async function deleteMonthlyAttendancePhotos(db, fs, monthPrefix) {
  // 1. Query physical file paths for that month from DB
  const rows = await db.getAllAsync(
    `SELECT id, check_in_photo FROM attendance WHERE business_date LIKE ? AND check_in_photo != ''`,
    [`${monthPrefix}%`]
  );

  let deletedCount = 0;
  for (const row of rows) {
    if (row.check_in_photo) {
      const ok = await fs.deleteAsync(row.check_in_photo);
      if (ok) deletedCount++;
    }
  }

  // 2. Clear database paths so records don't point to dangling deleted files
  const updateRes = await db.runAsync(
    `UPDATE attendance SET check_in_photo = '' WHERE business_date LIKE ?`,
    [`${monthPrefix}%`]
  );

  return {
    deletedFilesCount: deletedCount,
    dbRowsUpdated: updateRes.changes,
  };
}
