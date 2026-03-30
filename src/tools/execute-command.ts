// claude-integration/src/tools/execute-command.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function executeCommand(command: string): Promise<string> {
  // 命令白名单
  const whitelist = ['ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'date', 'whoami'];
  const cmd = command.trim().split(' ')[0];

  if (!whitelist.includes(cmd)) {
    throw new Error(`Command '${cmd}' is not allowed. Allowed: ${whitelist.join(', ')}`);
  }

  // 黑名单检查
  const blacklist = ['rm', 'dd', 'mkfs', 'format', '>', '>>', '|', '&', ';'];
  if (blacklist.some(blocked => command.includes(blocked))) {
    throw new Error('Command contains forbidden characters or operations');
  }

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    return stdout || stderr;
  } catch (error: any) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}
