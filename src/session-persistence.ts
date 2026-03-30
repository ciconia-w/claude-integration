// claude-integration/src/session-persistence.ts
import * as fs from 'fs';
import * as path from 'path';

interface PersistedSession {
  sessionId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  createdAt: string;
  lastUpdated: string;
}

export class SessionPersistence {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(process.cwd(), 'sessions');
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.json`);
  }

  saveSession(sessionId: string, conversationHistory: any[]): void {
    const sessionData: PersistedSession = {
      sessionId,
      conversationHistory,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    const filePath = this.getSessionFilePath(sessionId);
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    console.log('Session saved:', sessionId);
  }

  loadSession(sessionId: string): any[] | null {
    const filePath = this.getSessionFilePath(sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const sessionData: PersistedSession = JSON.parse(data);
      console.log('Session loaded:', sessionId);
      return sessionData.conversationHistory;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  deleteSession(sessionId: string): void {
    const filePath = this.getSessionFilePath(sessionId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Session deleted:', sessionId);
    }
  }

  listSessions(): string[] {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    return fs.readdirSync(this.storageDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }

  clearOldSessions(maxAgeHours: number = 24): void {
    const sessions = this.listSessions();
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    for (const sessionId of sessions) {
      const filePath = this.getSessionFilePath(sessionId);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        this.deleteSession(sessionId);
        console.log('Cleared old session:', sessionId);
      }
    }
  }
}
