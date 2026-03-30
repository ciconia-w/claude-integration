import { describe, it, expect, beforeEach } from 'vitest';
import { CronManager } from './cron-manager';

describe('CronManager', () => {
  let cm: CronManager;

  beforeEach(() => {
    cm = new CronManager();
  });

  it('should create a cron task', () => {
    const id = cm.createTask('0 9 * * *', 'Test task', 'echo hello');
    expect(typeof id).toBe('string');
  });

  it('should list cron tasks', () => {
    cm.createTask('0 9 * * *', 'Task 1', 'echo 1');
    const tasks = cm.listTasks();

    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('should delete a cron task', () => {
    const id = cm.createTask('0 9 * * *', 'Task', 'echo test');
    const result = cm.deleteTask(id);

    expect(result).toBe(true);
  });
});
