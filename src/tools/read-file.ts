// claude-integration/src/tools/read-file.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export async function readFile(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  // 安全检查：不允许读取系统敏感文件
  const blockedPaths = ['/etc/passwd', '/etc/shadow', '/root'];
  if (blockedPaths.some(blocked => absolutePath.startsWith(blocked))) {
    throw new Error('Access denied: Cannot read system files');
  }

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return content;
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}
