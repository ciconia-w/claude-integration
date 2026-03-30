export interface SessionStats {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface GlobalStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  sessionCount: number;
}

export class StatsManager {
  private stats: Map<string, SessionStats> = new Map();

  recordUsage(sessionId: string, inputTokens: number, outputTokens: number): void {
    const existing = this.stats.get(sessionId);

    if (existing) {
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.totalTokens += (inputTokens + outputTokens);
      existing.requestCount += 1;
      existing.lastUsedAt = new Date();
    } else {
      this.stats.set(sessionId, {
        sessionId,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        requestCount: 1,
        createdAt: new Date(),
        lastUsedAt: new Date()
      });
    }
  }

  getSessionStats(sessionId: string): SessionStats | null {
    return this.stats.get(sessionId) || null;
  }

  getGlobalStats(): GlobalStats {
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let requestCount = 0;

    for (const stat of this.stats.values()) {
      totalTokens += stat.totalTokens;
      inputTokens += stat.inputTokens;
      outputTokens += stat.outputTokens;
      requestCount += stat.requestCount;
    }

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      requestCount,
      sessionCount: this.stats.size
    };
  }

  getAllSessionStats(): SessionStats[] {
    return Array.from(this.stats.values());
  }
}
