// claude-integration/src/sse-formatter.ts
import { SSEEvent } from './types';

export function formatSSE(type: SSEEvent['type'], data: string): string {
  const event: SSEEvent = { type, data } as SSEEvent;
  return `data: ${JSON.stringify(event)}\n\n`;
}
