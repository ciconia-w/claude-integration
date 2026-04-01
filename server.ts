import express from 'express';
import { spawn } from 'child_process';
import { SkillManager } from './src/skill-manager';
import { MCPManager } from './src/mcp-manager';
import { CronManager } from './src/cron-manager';
import { FileManager } from './src/file-manager';
import { formatSSE } from './src/sse-formatter';
import {
  buildCliArgs,
  findTranscriptFile,
  resolveCliRuntime,
} from './src/cli-runtime';
import {
  getDefaultSettings,
  mergeSettings,
  normalizeSettings,
  type IntegrationSettings,
} from './src/settings';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const app = express();
const PORT = process.env.PORT || 8001;
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const LOCAL_CONFIG_DIR = path.join(os.homedir(), '.claude-integration');
const SETTINGS_FILE = path.join(LOCAL_CONFIG_DIR, 'settings.json');
const LEGACY_SETTINGS_FILE = path.join(SESSIONS_DIR, 'settings.json');

interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  lastMessage?: string;
  messageCount: number;
  transcriptPath?: string;
  transcriptRoot?: string;
  workingDirectory?: string;
  runtimeCommand?: string;
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function loadSettingsFromDisk(): IntegrationSettings {
  const settingsPath = fs.existsSync(SETTINGS_FILE)
    ? SETTINGS_FILE
    : fs.existsSync(LEGACY_SETTINGS_FILE)
      ? LEGACY_SETTINGS_FILE
      : null;

  if (!settingsPath) {
    return getDefaultSettings();
  }

  return normalizeSettings(readJsonFile(settingsPath));
}

function saveSettingsToDisk(payload: unknown): IntegrationSettings {
  ensureDirectory(LOCAL_CONFIG_DIR);

  // Merge with the existing file so older GUIs do not wipe the newer runtime
  // fields that are now needed to swap Claude-compatible CLIs.
  const merged = mergeSettings(loadSettingsFromDisk(), payload);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));

  return merged;
}

function loadSessionMeta(sessionId: string): SessionMeta | null {
  return readJsonFile<SessionMeta>(path.join(SESSIONS_DIR, `${sessionId}.json`));
}

function saveSessionMeta(meta: SessionMeta): void {
  fs.writeFileSync(
    path.join(SESSIONS_DIR, `${meta.id}.json`),
    JSON.stringify(meta, null, 2),
  );
}

function listSessionMeta(): SessionMeta[] {
  try {
    return fs
      .readdirSync(SESSIONS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => readJsonFile<SessionMeta>(path.join(SESSIONS_DIR, file)))
      .filter((entry): entry is SessionMeta => Boolean(entry));
  } catch {
    return [];
  }
}

function resolveTranscriptPath(
  sessionId: string,
  settings: IntegrationSettings,
  cachedPath?: string,
): string | null {
  if (cachedPath && fs.existsSync(cachedPath)) {
    return cachedPath;
  }

  return findTranscriptFile(sessionId, settings.runtime.transcriptRoot);
}

function readTranscriptMessages(transcriptPath: string): unknown[] {
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
  const messages: unknown[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      messages.push(JSON.parse(line));
    } catch {
      // Ignore malformed lines so one bad entry does not break history loading.
    }
  }

  return messages;
}

function extractAssistantText(message: unknown): string {
  if (
    !message ||
    typeof message !== 'object' ||
    !Array.isArray((message as { content?: unknown[] }).content)
  ) {
    return '';
  }

  return (message as { content: Array<{ type?: string; text?: string }> }).content
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('');
}

ensureDirectory(SESSIONS_DIR);
ensureDirectory(LOCAL_CONFIG_DIR);

app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  const settings = loadSettingsFromDisk();
  const runtime = resolveCliRuntime(settings);

  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage().rss,
    runtime: {
      command: runtime.command,
      launchArgs: runtime.launchArgs,
      workingDirectory: runtime.workingDirectory,
      transcriptRoot: runtime.transcriptRoot,
    },
  });
});

app.get('/sessions/list', (_req, res) => {
  res.json(listSessionMeta());
});

app.get('/sessions/:id/messages', (req, res) => {
  const settings = loadSettingsFromDisk();
  const meta = loadSessionMeta(req.params.id);
  const transcriptPath = resolveTranscriptPath(
    req.params.id,
    settings,
    meta?.transcriptPath,
  );

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(readTranscriptMessages(transcriptPath));
});

app.delete('/sessions/:id', (req, res) => {
  const settings = loadSettingsFromDisk();
  const metaPath = path.join(SESSIONS_DIR, `${req.params.id}.json`);
  const transcriptPath = resolveTranscriptPath(
    req.params.id,
    settings,
    loadSessionMeta(req.params.id)?.transcriptPath,
  );

  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    fs.unlinkSync(transcriptPath);
  }

  res.json({ success: true });
});

app.patch('/sessions/:id', (req, res) => {
  const meta = loadSessionMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  if (typeof req.body.title === 'string' && req.body.title.trim()) {
    meta.title = req.body.title.trim();
  }

  saveSessionMeta(meta);
  res.json(meta);
});

const fileManager = new FileManager();

app.get('/files', async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    if (!dirPath || typeof dirPath !== 'string') {
      res.status(400).json({ error: 'Path required' });
      return;
    }

    const list = await fileManager.listDirectory(dirPath);
    res.json(list.map(file => ({ ...file, type: file.isDirectory ? 'directory' : 'file' })));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.get('/files/read', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'Path required' });
      return;
    }

    res.json({ content: await fileManager.readFile(filePath) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

const skillManager = new SkillManager();
skillManager.loadSkills();

app.get('/skills', (_req, res) => {
  res.json(skillManager.listSkills());
});

app.get('/skills/:name', (req, res) => {
  const skill = skillManager.getSkill(req.params.name);
  if (!skill) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(skill);
});

app.post('/skills/:name/toggle', (req, res) => {
  const ok = skillManager.toggleSkill(req.params.name, req.body.enabled);
  if (!ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ success: true });
});

const mcpManager = new MCPManager();
mcpManager.loadServers();

app.get('/mcp', (_req, res) => {
  res.json(mcpManager.listServers());
});

app.get('/mcp/:name', (req, res) => {
  const server = mcpManager.getServer(req.params.name);
  if (!server) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json(server);
});

app.post('/mcp/:name/toggle', async (req, res) => {
  const ok = mcpManager.toggleServer(req.params.name, req.body.enabled);
  if (!ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  await mcpManager.saveServers();
  res.json({ success: true });
});

const cronManager = new CronManager();
cronManager.loadTasks();

app.get('/cron', (_req, res) => {
  res.json(cronManager.listTasks());
});

app.post('/cron', async (req, res) => {
  const { schedule, name, command } = req.body;
  if (!schedule || !name || !command) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }

  const id = cronManager.createTask(schedule, name, command);
  await cronManager.saveTasks();
  res.json({ id, success: true });
});

app.delete('/cron/:id', async (req, res) => {
  const ok = cronManager.deleteTask(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  await cronManager.saveTasks();
  res.json({ success: true });
});

app.post('/cron/:id/toggle', async (req, res) => {
  const ok = cronManager.toggleTask(req.params.id, req.body.enabled);
  if (!ok) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  await cronManager.saveTasks();
  res.json({ success: true });
});

app.get('/settings', (_req, res) => {
  res.json(loadSettingsFromDisk());
});

app.post('/settings', (req, res) => {
  const settings = saveSettingsToDisk(req.body);
  res.json({ success: true, settings });
});

app.post('/stream', (req, res) => {
  const message =
    typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const requestedSessionId =
    typeof req.body?.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : undefined;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const settings = loadSettingsFromDisk();
  const runtime = resolveCliRuntime(settings);
  const existingMeta = requestedSessionId
    ? loadSessionMeta(requestedSessionId)
    : null;
  const args = buildCliArgs(
    message,
    requestedSessionId,
    runtime,
    settings.provider.model || undefined,
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const proc = spawn(runtime.command, args, {
    env: runtime.env,
    cwd: runtime.workingDirectory,
  });

  let lineBuffer = '';
  let currentSessionId = requestedSessionId;
  let sentTerminalEvent = false;
  let streamedAssistantText = false;
  let stderrBuffer = '';
  const activeTools = new Map<number, { id: string; name: string }>();

  res.on('close', () => {
    if (proc.exitCode === null && !proc.killed) {
      proc.kill();
    }
  });

  proc.stdout.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const event = JSON.parse(line) as Record<string, any>;

        if (event.type === 'system' && event.subtype === 'init') {
          if (typeof event.session_id === 'string') {
            currentSessionId = event.session_id;
          }
          continue;
        }

        if (event.type === 'stream_event') {
          const streamEvent = event.event;

          if (
            streamEvent?.type === 'content_block_start' &&
            streamEvent.content_block?.type === 'tool_use'
          ) {
            activeTools.set(streamEvent.index, {
              id: streamEvent.content_block.id,
              name: streamEvent.content_block.name,
            });
            res.write(
              formatSSE(
                'tool_use',
                JSON.stringify({
                  id: streamEvent.content_block.id,
                  name: streamEvent.content_block.name,
                  status: 'started',
                }),
              ),
            );
            continue;
          }

          if (
            streamEvent?.type === 'content_block_stop' &&
            activeTools.has(streamEvent.index)
          ) {
            const tool = activeTools.get(streamEvent.index)!;
            activeTools.delete(streamEvent.index);
            res.write(
              formatSSE(
                'tool_use',
                JSON.stringify({
                  id: tool.id,
                  name: tool.name,
                  status: 'completed',
                }),
              ),
            );
            continue;
          }

          if (
            streamEvent?.type === 'content_block_delta' &&
            streamEvent.delta?.type === 'text_delta' &&
            typeof streamEvent.delta.text === 'string'
          ) {
            streamedAssistantText = true;
            res.write(formatSSE('text', streamEvent.delta.text));
          }

          continue;
        }

        if (event.type === 'assistant') {
          const fallbackText = extractAssistantText(event.message);
          if (fallbackText && !streamedAssistantText) {
            streamedAssistantText = true;
            res.write(formatSSE('text', fallbackText));
          }
          continue;
        }

        if (event.type === 'result') {
          const resultSessionId =
            typeof event.session_id === 'string' ? event.session_id : currentSessionId;

          if (event.is_error) {
            const messageText =
              typeof event.result === 'string' && event.result.trim()
                ? event.result
                : stderrBuffer.trim() || 'Claude CLI returned an error.';
            res.write(formatSSE('error', messageText));
          }

          if (resultSessionId && !sentTerminalEvent) {
            currentSessionId = resultSessionId;

            const transcriptPath = resolveTranscriptPath(
              resultSessionId,
              settings,
              existingMeta?.transcriptPath,
            );

            const meta: SessionMeta = {
              id: resultSessionId,
              title: existingMeta?.title || message.slice(0, 60).trim() || 'New Chat',
              createdAt: existingMeta?.createdAt || new Date().toISOString(),
              lastMessage: message.slice(0, 100),
              messageCount: (existingMeta?.messageCount || 0) + 1,
              transcriptPath: transcriptPath || undefined,
              transcriptRoot: runtime.transcriptRoot,
              workingDirectory: runtime.workingDirectory,
              runtimeCommand: runtime.command,
            };

            saveSessionMeta(meta);
            res.write(
              formatSSE('done', JSON.stringify({ sessionId: resultSessionId })),
            );
            sentTerminalEvent = true;
          }
        }
      } catch {
        // Skip malformed NDJSON lines from the CLI stream.
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    const output = chunk.toString();
    stderrBuffer += output;
    console.error('[claude stderr]', output);
  });

  proc.on('close', code => {
    if (!sentTerminalEvent) {
      if (currentSessionId) {
        const transcriptPath = resolveTranscriptPath(
          currentSessionId,
          settings,
          existingMeta?.transcriptPath,
        );

        const meta: SessionMeta = {
          id: currentSessionId,
          title: existingMeta?.title || message.slice(0, 60).trim() || 'New Chat',
          createdAt: existingMeta?.createdAt || new Date().toISOString(),
          lastMessage: message.slice(0, 100),
          messageCount: (existingMeta?.messageCount || 0) + 1,
          transcriptPath: transcriptPath || undefined,
          transcriptRoot: runtime.transcriptRoot,
          workingDirectory: runtime.workingDirectory,
          runtimeCommand: runtime.command,
        };

        saveSessionMeta(meta);
        res.write(
          formatSSE('done', JSON.stringify({ sessionId: currentSessionId })),
        );
      } else if (code !== 0 || stderrBuffer.trim()) {
        res.write(
          formatSSE(
            'error',
            stderrBuffer.trim() || `Claude CLI exited with code ${code ?? 1}.`,
          ),
        );
      }
    }

    res.end();
  });

  proc.on('error', error => {
    res.write(formatSSE('error', error.message));
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Claude Desktop backend running on port ${PORT}`);
});

export default app;
