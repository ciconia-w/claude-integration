// claude-integration/src/tool-executor.ts
import { ToolManager } from './tool-manager';
import { readFile, writeFile, listDirectory, executeCommand } from './tool-manager';

export interface ToolResult {
  content?: string;
  error?: string;
}

export class ToolExecutor {
  constructor(private toolManager: ToolManager) {}

  async execute(toolName: string, input: any): Promise<ToolResult> {
    const tool = this.toolManager.getTool(toolName);
    if (!tool) {
      return { error: `Tool '${toolName}' not found` };
    }

    // 验证输入
    if (!this.toolManager.validateToolInput(toolName, input)) {
      return { error: `Invalid input for tool '${toolName}'` };
    }

    try {
      let result: string;

      switch (toolName) {
        case 'read_file':
          result = await readFile(input.path);
          break;

        case 'write_file':
          result = await writeFile(input.path, input.content);
          break;

        case 'list_directory':
          result = await listDirectory(input.path);
          break;

        case 'execute_command':
          result = await executeCommand(input.command);
          break;

        default:
          return { error: `Tool '${toolName}' not implemented` };
      }

      return { content: result };

    } catch (error: any) {
      return { error: error.message };
    }
  }
}
