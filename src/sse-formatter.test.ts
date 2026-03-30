// claude-integration/src/sse-formatter.test.ts
import { describe, it, expect } from 'vitest';
import { formatSSE } from './sse-formatter';

describe('SSE Formatter', () => {
  it('should format text event', () => {
    const result = formatSSE('text', 'Hello World');
    expect(result).toBe('data: {"type":"text","data":"Hello World"}\n\n');
  });

  it('should format tool_use event', () => {
    const toolData = '{"id":"123","name":"read_file","input":{"path":"/test"}}';
    const result = formatSSE('tool_use', toolData);
    expect(result).toContain('"type":"tool_use"');
    expect(result).toContain('"data":');
  });

  it('should format done event', () => {
    const result = formatSSE('done', '');
    expect(result).toBe('data: {"type":"done","data":""}\n\n');
  });

  it('should format error event', () => {
    const result = formatSSE('error', 'Something went wrong');
    expect(result).toBe('data: {"type":"error","data":"Something went wrong"}\n\n');
  });
});
