import { describe, it, expect } from 'vitest';
import { MCPManager } from './mcp-manager';

describe('MCPManager', () => {
  it('should list MCP servers', () => {
    const mm = new MCPManager();
    const servers = mm.listServers();

    expect(Array.isArray(servers)).toBe(true);
  });

  it('should toggle server status', () => {
    const mm = new MCPManager();
    const result = mm.toggleServer('test-server', false);

    expect(typeof result).toBe('boolean');
  });
});
