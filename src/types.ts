// claude-integration/src/types.ts

export interface StreamRequest {
    sessionId: string;
    conversationId: string;
    sdkSessionId?: string;
    model?: string;
    systemPrompt?: string;
    prompt: string;
    permissionMode?: 'acceptEdits' | 'plan' | 'default';
}

export interface ToolUseData {
    id: string;
    name: string;
    input: Record<string, any>;
}

export interface ToolResultData {
    tool_use_id: string;
    content: string;
    is_error: boolean;
}

export interface StatusData {
    session_id: string;
    model: string;
    tools: string[];
}

export type SSEEvent =
    | { type: 'text'; data: string }
    | { type: 'tool_use'; data: string }
    | { type: 'tool_result'; data: string }
    | { type: 'status'; data: string }
    | { type: 'error'; data: string }
    | { type: 'done'; data: string };

export interface HealthResponse {
    status: 'ok' | 'error';
    uptime: number;
    memory: number;
}
