// claude-integration/src/tools/list-directory.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export async function listDirectory(dirPath: string): Promise<string> {
  const absolutePath = path.resolve(dirPath);

  try {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const result = entries.map(entry => {
      const type = entry.isDirectory() ? 'dir' : 'file';
      return `${type}: ${entry.name}`;
    });
    return result.join('\n');
  } catch (error: any) {
    throw new Error(`Failed to list directory: ${error.message}`);
  }
}
