import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface CronTask {
  id: string;
  schedule: string;
  name: string;
  command: string;
  enabled: boolean;
  createdAt: Date;
  lastRun?: Date;
}

export class CronManager {
  private tasks: Map<string, CronTask> = new Map();
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(process.env.HOME || '', '.claude/cron-tasks.json');
  }

  async loadTasks(): Promise<void> {
    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const tasks = JSON.parse(data);

      for (const task of tasks) {
        this.tasks.set(task.id, {
          ...task,
          createdAt: new Date(task.createdAt),
          lastRun: task.lastRun ? new Date(task.lastRun) : undefined
        });
      }
    } catch (error) {
      // Storage file doesn't exist or can't be read
    }
  }

  async saveTasks(): Promise<void> {
    const tasks = Array.from(this.tasks.values());
    await fs.writeFile(this.storagePath, JSON.stringify(tasks, null, 2));
  }

  createTask(schedule: string, name: string, command: string): string {
    const id = uuidv4();
    const task: CronTask = {
      id,
      schedule,
      name,
      command,
      enabled: true,
      createdAt: new Date()
    };

    this.tasks.set(id, task);
    return id;
  }

  listTasks(): CronTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): CronTask | null {
    return this.tasks.get(id) || null;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  toggleTask(id: string, enabled: boolean): boolean {
    const task = this.tasks.get(id);
    if (task) {
      task.enabled = enabled;
      return true;
    }
    return false;
  }
}
