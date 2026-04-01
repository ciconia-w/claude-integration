import { describe, expect, it } from 'vitest';
import { getDefaultSettings, mergeSettings } from './settings';

describe('settings', () => {
  it('preserves runtime fields when older clients save provider-only settings', () => {
    const current = mergeSettings(getDefaultSettings(), {
      runtime: {
        command: 'node',
        launchArgs: ['D:/tools/claude-js/dist/cli.js'],
        workingDirectory: 'D:/workspace',
        transcriptRoot: 'D:/workspace/.claude/projects',
      },
    });

    const updated = mergeSettings(current, {
      provider: {
        model: 'claude-sonnet-4-6',
      },
    });

    expect(updated.provider.model).toBe('claude-sonnet-4-6');
    expect(updated.runtime.command).toBe('node');
    expect(updated.runtime.launchArgs).toEqual(['D:/tools/claude-js/dist/cli.js']);
  });
});
