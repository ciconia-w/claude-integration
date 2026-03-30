// claude-integration/src/tool-manager.ts
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: any;
}

export class ToolManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private commandWhitelist: string[] = ['ls', 'cat', 'grep', 'find', 'pwd', 'echo'];
  private commandBlacklist: string[] = ['rm', 'dd', 'mkfs', 'format', ':(){:|:&};:'];
  private pathBlacklist: string[] = ['/etc/passwd', '/etc/shadow', '/root'];

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  isCommandAllowed(command: string): boolean {
    const cmd = command.trim().split(' ')[0];

    if (this.commandBlacklist.some(blocked => command.includes(blocked))) {
      return false;
    }

    return this.commandWhitelist.includes(cmd);
  }

  isPathAllowed(path: string): boolean {
    return !this.pathBlacklist.some(blocked => path.startsWith(blocked));
  }

  validateToolInput(toolName: string, input: any): boolean {
    const tool = this.getTool(toolName);
    if (!tool) return false;

    if (toolName === 'execute_command' && input.command) {
      return this.isCommandAllowed(input.command);
    }

    if (input.path && typeof input.path === 'string') {
      return this.isPathAllowed(input.path);
    }

    return true;
  }
}

// 导出工具实现
export { readFile } from './tools/read-file';
export { writeFile } from './tools/write-file';
export { listDirectory } from './tools/list-directory';
export { executeCommand } from './tools/execute-command';

// 注册默认工具
export function registerDefaultTools(manager: ToolManager): void {
  manager.registerTool({
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' }
      },
      required: ['path']
    }
  });

  manager.registerTool({
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  });

  manager.registerTool({
    name: 'list_directory',
    description: 'List contents of a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' }
      },
      required: ['path']
    }
  });

  manager.registerTool({
    name: 'execute_command',
    description: 'Execute a shell command (whitelist only)',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' }
      },
      required: ['command']
    }
  });
}
