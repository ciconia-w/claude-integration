// claude-integration/src/claude-client.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeClient } from './claude-client';

describe('ClaudeClient', () => {
  let client: ClaudeClient;

  beforeEach(() => {
    const tools = [
      {
        name: 'read_file',
        description: 'Read file content',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      }
    ];
    client = new ClaudeClient('test-api-key', tools);
  });

  it('should initialize with API key and tools', () => {
    expect(client).toBeDefined();
  });

  it('should maintain conversation history', () => {
    const history = client.getConversationHistory();
    expect(history).toEqual([]);
  });

  it('should clear conversation history', () => {
    client.clearHistory();
    expect(client.getConversationHistory()).toEqual([]);
  });
});
