import { TestDatabase } from './db.js';

export interface FileSystemSimulator {
  files: Map<string, string>; // path -> content
  deleteAsync(path: string): Promise<boolean>;
  readDirectoryAsync(dir: string): Promise<string[]>;
}

export function createFileSystemSimulator(): FileSystemSimulator;

export function deleteMonthlyAttendancePhotos(
  db: TestDatabase,
  fs: FileSystemSimulator,
  monthPrefix: string
): Promise<{ deletedFilesCount: number; dbRowsUpdated: number }>;
