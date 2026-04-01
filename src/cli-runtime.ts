import * as fs from 'fs';
import * as path from 'path';
import type { IntegrationSettings } from './settings';

export interface ResolvedCliRuntime {
  command: string;
  launchArgs: string[];
  workingDirectory: string;
  transcriptRoot: string;
  env: NodeJS.ProcessEnv;
}

function hasPathSeparator(value: string): boolean {
  return value.includes('/') || value.includes('\\');
}

function isLikelyPath(value: string): boolean {
  return path.isAbsolute(value) || hasPathSeparator(value) || value.endsWith('.js');
}

function getExecutableCandidates(command: string): string[] {
  if (process.platform !== 'win32') {
    return [command];
  }

  const extensions = (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .filter(Boolean);
  const hasExtension = path.extname(command) !== '';

  if (hasExtension) {
    return [command];
  }

  return [command, ...extensions.map(ext => `${command}${ext.toLowerCase()}`)];
}

function isCommandAvailable(command: string): boolean {
  if (!command) {
    return false;
  }

  if (isLikelyPath(command)) {
    return fs.existsSync(command);
  }

  const pathEntries = (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean);

  for (const dir of pathEntries) {
    for (const candidate of getExecutableCandidates(command)) {
      if (fs.existsSync(path.join(dir, candidate))) {
        return true;
      }
    }
  }

  return false;
}

function firstAvailableCommand(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (isCommandAvailable(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveCliRuntime(
  settings: IntegrationSettings,
): ResolvedCliRuntime {
  const configuredCommand =
    process.env.CLAUDE_BIN?.trim() || settings.runtime.command.trim();
  const configuredLaunchArgs =
    process.env.CLAUDE_LAUNCH_ARGS?.trim()
      ? [process.env.CLAUDE_LAUNCH_ARGS.trim()]
      : settings.runtime.launchArgs;
  const workingDirectory =
    process.env.CLAUDE_WORKDIR?.trim() || settings.runtime.workingDirectory;
  const transcriptRoot =
    process.env.CLAUDE_TRANSCRIPT_ROOT?.trim() || settings.runtime.transcriptRoot;

  const fallbackCommand =
    firstAvailableCommand(
      [configuredCommand, 'claude', 'claude-js'].filter(Boolean) as string[],
    ) ||
    configuredCommand ||
    'claude';

  const env: NodeJS.ProcessEnv = { ...process.env };

  if (settings.provider.apiKey) {
    env.ANTHROPIC_API_KEY = settings.provider.apiKey;
  }

  if (settings.provider.endpoint) {
    env.ANTHROPIC_BASE_URL = settings.provider.endpoint;
  }

  return {
    command: fallbackCommand,
    launchArgs: [...configuredLaunchArgs],
    workingDirectory,
    transcriptRoot,
    env,
  };
}

export function buildCliArgs(
  message: string,
  sessionId: string | undefined,
  runtime: ResolvedCliRuntime,
  model: string | undefined,
): string[] {
  const args = [
    ...runtime.launchArgs,
    '-p',
    message,
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
  ];

  if (model) {
    args.push('--model', model);
  }

  if (sessionId) {
    args.push('--resume', sessionId);
  }

  return args;
}

export function findTranscriptFile(
  sessionId: string,
  transcriptRoot: string,
): string | null {
  if (!sessionId || !transcriptRoot || !fs.existsSync(transcriptRoot)) {
    return null;
  }

  const targetFile = `${sessionId}.jsonl`;
  const queue = [transcriptRoot];

  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir) {
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === targetFile) {
        return fullPath;
      }
    }
  }

  return null;
}
