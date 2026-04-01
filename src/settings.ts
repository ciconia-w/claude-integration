import * as os from 'os';
import * as path from 'path';

export interface ProviderSettings {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface RuntimeSettings {
  command: string;
  launchArgs: string[];
  workingDirectory: string;
  transcriptRoot: string;
}

export interface IntegrationSettings {
  autoApprove: boolean;
  provider: ProviderSettings;
  runtime: RuntimeSettings;
}

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function expandHomePath(value: string): string {
  if (!value) {
    return value;
  }

  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function normalizeStringList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [...fallback];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [...fallback];
  }

  if (trimmed.startsWith('[')) {
    try {
      return normalizeStringList(JSON.parse(trimmed), fallback);
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

export function getDefaultSettings(): IntegrationSettings {
  return {
    autoApprove: false,
    provider: {
      endpoint: '',
      apiKey: '',
      model: '',
    },
    runtime: {
      command: '',
      launchArgs: [],
      workingDirectory: os.homedir(),
      transcriptRoot: path.join(os.homedir(), '.claude', 'projects'),
    },
  };
}

export function mergeSettings(
  current: IntegrationSettings,
  incoming: unknown,
): IntegrationSettings {
  const payload = isRecord(incoming) ? incoming : {};
  const provider = isRecord(payload.provider) ? payload.provider : {};
  const runtime = isRecord(payload.runtime) ? payload.runtime : {};

  return {
    autoApprove:
      typeof payload.autoApprove === 'boolean'
        ? payload.autoApprove
        : current.autoApprove,
    provider: {
      endpoint: normalizeString(provider.endpoint, current.provider.endpoint),
      apiKey: normalizeString(provider.apiKey, current.provider.apiKey),
      model: normalizeString(provider.model, current.provider.model),
    },
    runtime: {
      command: normalizeString(
        runtime.command ?? runtime.binaryPath ?? runtime.cliCommand,
        current.runtime.command,
      ),
      launchArgs: normalizeStringList(
        runtime.launchArgs ?? runtime.commandArgs ?? runtime.binaryArgs,
        current.runtime.launchArgs,
      ),
      workingDirectory: expandHomePath(
        normalizeString(
          runtime.workingDirectory ?? runtime.cwd,
          current.runtime.workingDirectory,
        ),
      ),
      transcriptRoot: expandHomePath(
        normalizeString(
          runtime.transcriptRoot ?? runtime.transcriptDir,
          current.runtime.transcriptRoot,
        ),
      ),
    },
  };
}

export function normalizeSettings(input: unknown): IntegrationSettings {
  return mergeSettings(getDefaultSettings(), input);
}
