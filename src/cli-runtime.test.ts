import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCliArgs, findTranscriptFile } from './cli-runtime';
import { mergeSettings, getDefaultSettings } from './settings';

describe('cli runtime', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds CLI args with runtime launch args, model, and resume', () => {
    const settings = mergeSettings(getDefaultSettings(), {
      runtime: {
        command: 'node',
        launchArgs: ['D:/tools/claude-js/dist/cli.js'],
      },
      provider: {
        model: 'claude-sonnet-4-6',
      },
    });

    const args = buildCliArgs(
      'hello',
      'session-123',
      {
        command: settings.runtime.command,
        launchArgs: settings.runtime.launchArgs,
        workingDirectory: settings.runtime.workingDirectory,
        transcriptRoot: settings.runtime.transcriptRoot,
        env: process.env,
      },
      settings.provider.model,
    );

    expect(args).toEqual([
      'D:/tools/claude-js/dist/cli.js',
      '-p',
      'hello',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--model',
      'claude-sonnet-4-6',
      '--resume',
      'session-123',
    ]);
  });

  it('finds transcripts recursively under the configured root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-transcripts-'));
    const nested = path.join(root, 'project-a', 'subdir');
    const transcript = path.join(nested, 'session-abc.jsonl');

    tempDirs.push(root);
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(transcript, '');

    expect(findTranscriptFile('session-abc', root)).toBe(transcript);
  });
});
