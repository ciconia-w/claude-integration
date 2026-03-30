// claude-integration/src/tool-executor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutor } from './tool-executor';
import { ToolManager, registerDefaultTools } from './tool-manager';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let manager: ToolManager;

  beforeEach(() => {
    manager = new ToolManager();
    registerDefaultTools(manager);
    executor = new ToolExecutor(manager);
  });

  it('should reject invalid tool', async () => {
    const result = await executor.execute('invalid_tool', {});
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  it('should validate tool input', async () => {
    const result = await executor.execute('execute_command', { command: 'rm -rf /' });
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid input');
  });

  it('should execute list_directory tool', async () => {
    const result = await executor.execute('list_directory', { path: '.' });
    expect(result.content).toBeDefined();
  });
});
