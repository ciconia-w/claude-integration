import { describe, it, expect, beforeEach } from 'vitest';
import { StatsManager } from './stats-manager';

describe('StatsManager', () => {
  let statsManager: StatsManager;

  beforeEach(() => {
    statsManager = new StatsManager();
  });

  it('should record API usage', () => {
    statsManager.recordUsage('session-1', 100, 200);
    const stats = statsManager.getSessionStats('session-1');

    expect(stats).not.toBeNull();
    expect(stats!.inputTokens).toBe(100);
    expect(stats!.outputTokens).toBe(200);
    expect(stats!.totalTokens).toBe(300);
    expect(stats!.requestCount).toBe(1);
  });

  it('should return global stats', () => {
    statsManager.recordUsage('session-1', 100, 200);
    statsManager.recordUsage('session-2', 50, 100);

    const global = statsManager.getGlobalStats();
    expect(global.totalTokens).toBe(450);
    expect(global.requestCount).toBe(2);
  });
});
