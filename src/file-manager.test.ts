import { describe, it, expect } from 'vitest';
import { FileManager } from './file-manager';
import * as path from 'path';

describe('FileManager', () => {
  it('should list directory contents', async () => {
    const fm = new FileManager();
    const files = await fm.listDirectory('.');

    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should read file content', async () => {
    const fm = new FileManager();
    const content = await fm.readFile('package.json');

    expect(content).toContain('name');
  });
});
