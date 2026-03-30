// claude-integration/src/tools/write-file.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export async function writeFile(filePath: string, content: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  // 安全检查
  const blockedPaths = ['/etc', '/root', '/sys', '/proc'];
  if (blockedPaths.some(blocked => absolutePath.startsWith(blocked))) {
    throw new Error('Access denied: Cannot write to system directories');
  }

  // 文件大小限制：10MB
  if (content.length > 10 * 1024 * 1024) {
    throw new Error('File size exceeds 10MB limit');
  }

  try {
    await fs.writeFile(absolutePath, content, 'utf-8');
    return `Successfully wrote ${content.length} bytes to ${filePath}`;
  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}
