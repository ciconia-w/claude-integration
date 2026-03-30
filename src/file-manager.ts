import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export class FileManager {
  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(fullPath);

      files.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      });
    }

    return files;
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    const stats = await fs.stat(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modified: stats.mtime
    };
  }
}
