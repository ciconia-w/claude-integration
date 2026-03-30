// claude-integration/src/tool-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolManager } from './tool-manager';

describe('ToolManager', () => {
  let manager: ToolManager;

  beforeEach(() => {
    manager = new ToolManager();
  });

  it('should register tool', () => {
    const tool = {
      name: 'read_file',
      description: 'Read file content',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        }
      }
    };

    manager.registerTool(tool);
    expect(manager.getTool('read_file')).toBeDefined();
  });

  it('should validate command against whitelist', () => {
    expect(manager.isCommandAllowed('ls -la')).toBe(true);
    expect(manager.isCommandAllowed('rm -rf /')).toBe(false);
  });

  it('should validate file path', () => {
    expect(manager.isPathAllowed('/home/user/file.txt')).toBe(true);
    expect(manager.isPathAllowed('/etc/passwd')).toBe(false);
  });
});
