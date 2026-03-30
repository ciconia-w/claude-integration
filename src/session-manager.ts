// claude-integration/src/session-manager.ts
import { ClaudeClient } from './claude-client';
import { ToolDefinition } from './tool-manager';
import { SessionPersistence } from './session-persistence';
import { v4 as uuidv4 } from 'uuid';

interface Session {
  id: string;
  client: ClaudeClient;
  createdAt: Date;
  title?: string;
  lastMessage?: string;
  messageCount?: number;
}

interface SessionConfig {
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  persistSessions?: boolean;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: SessionConfig;
  private persistence: SessionPersistence | null = null;

  constructor(config?: SessionConfig) {
    this.config = {
      baseURL: config?.baseURL || 'https://api.anthropic.com',
      model: config?.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config?.maxTokens || 4096,
      persistSessions: config?.persistSessions !== false
    };

    if (this.config.persistSessions) {
      this.persistence = new SessionPersistence();
      console.log('Session persistence enabled');
    }
  }

  createSession(apiKey: string, tools: ToolDefinition[] = [], sessionId?: string): string {
    const id = sessionId || uuidv4();
    const client = new ClaudeClient(
      apiKey,
      tools,
      this.config.baseURL,
      this.config.model,
      this.config.maxTokens
    );

    // Try to load existing session history
    if (this.persistence && sessionId) {
      const history = this.persistence.loadSession(sessionId);
      if (history) {
        client.loadConversationHistory(history);
        console.log('Restored session from disk:', sessionId);
      }
    }

    this.sessions.set(id, {
      id,
      client,
      createdAt: new Date(),
      messageCount: 0
    });

    return id;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  saveSession(sessionId: string): void {
    if (!this.persistence) return;

    const session = this.sessions.get(sessionId);
    if (session) {
      const history = session.client.getConversationHistory();
      this.persistence.saveSession(sessionId, history);
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.persistence) {
      this.persistence.deleteSession(sessionId);
    }
  }

  listPersistedSessions(): string[] {
    if (!this.persistence) return [];
    return this.persistence.listSessions();
  }

  clearOldSessions(maxAgeHours: number = 24): void {
    if (this.persistence) {
      this.persistence.clearOldSessions(maxAgeHours);
    }
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}
