// claude-integration/server.ts
import express from 'express';
import { spawn } from 'child_process';
import { SkillManager } from './src/skill-manager';
import { MCPManager } from './src/mcp-manager';
import { CronManager } from './src/cron-manager';
import { FileManager } from './src/file-manager';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const PORT = process.env.PORT || 8001;
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');

// Find the claude binary (support NVM installations)
function findClaude(): string {
  const candidates = [
    process.env.CLAUDE_BIN,
    '/home/aaa/.config/nvm/versions/node/v22.22.0/bin/claude',
    process.env.HOME + '/.config/nvm/versions/node/v22.22.0/bin/claude',
    'claude', // fallback to PATH
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (p === 'claude') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'claude';
}
const CLAUDE_BIN = findClaude();
console.log('Using claude binary:', CLAUDE_BIN);

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// ── SSE helper ──────────────────────────────────────────────────
function formatSSE(type: string, data: string): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

// ── Session metadata helpers ─────────────────────────────────────
interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  lastMessage?: string;
  messageCount: number;
}

function loadSessionMeta(sessionId: string): SessionMeta | null {
  const file = path.join(SESSIONS_DIR, sessionId + '.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

function saveSessionMeta(meta: SessionMeta): void {
  fs.writeFileSync(
    path.join(SESSIONS_DIR, meta.id + '.json'),
    JSON.stringify(meta, null, 2)
  );
}

// ── Health ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

// ── Sessions list ────────────────────────────────────────────────
app.get('/sessions/list', (_req, res) => {
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const sessions = files
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean);
    res.json(sessions);
  } catch { res.json([]); }
});

app.get('/sessions/:id/messages', (req, res) => {
  const messagesPath = path.join(process.env.HOME || '', '.claude/projects/-home-aaa', req.params.id + '.jsonl');
  if (!fs.existsSync(messagesPath)) { res.status(404).json({ error: 'Not found' }); return; }
  const lines = fs.readFileSync(messagesPath, 'utf-8').split('\n').filter(Boolean);
  const messages = lines.map(line => JSON.parse(line));
  res.json(messages);
});

app.delete('/sessions/:id', (req, res) => {
  const metaPath = path.join(SESSIONS_DIR, req.params.id + '.json');
  const messagesPath = path.join(process.env.HOME || '', '.claude/projects/-home-aaa', req.params.id + '.jsonl');
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  if (fs.existsSync(messagesPath)) fs.unlinkSync(messagesPath);
  res.json({ success: true });
});

app.patch('/sessions/:id', (req, res) => {
  const meta = loadSessionMeta(req.params.id);
  if (!meta) { res.status(404).json({ error: 'Not found' }); return; }
  if (req.body.title) meta.title = req.body.title;
  saveSessionMeta(meta);
  res.json(meta);
});

// ── File operations ──────────────────────────────────────────────
const fileManager = new FileManager();

app.get('/files', async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    if (!dirPath || typeof dirPath !== 'string') { res.status(400).json({ error: 'Path required' }); return; }
    res.json(await fileManager.listDirectory(dirPath));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/files/read', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') { res.status(400).json({ error: 'Path required' }); return; }
    res.json({ content: await fileManager.readFile(filePath) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Skills ───────────────────────────────────────────────────────
const skillManager = new SkillManager();
skillManager.loadSkills();

app.get('/skills', (_req, res) => res.json(skillManager.listSkills()));

app.get('/skills/:name', (req, res) => {
  const skill = skillManager.getSkill(req.params.name);
  if (!skill) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(skill);
});

app.post('/skills/:name/toggle', (req, res) => {
  const ok = skillManager.toggleSkill(req.params.name, req.body.enabled);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

// ── MCP ──────────────────────────────────────────────────────────
const mcpManager = new MCPManager();
mcpManager.loadServers();

app.get('/mcp', (_req, res) => res.json(mcpManager.listServers()));

app.get('/mcp/:name', (req, res) => {
  const server = mcpManager.getServer(req.params.name);
  if (!server) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(server);
});

app.post('/mcp/:name/toggle', async (req, res) => {
  const ok = mcpManager.toggleServer(req.params.name, req.body.enabled);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  await mcpManager.saveServers();
  res.json({ success: true });
});

// ── Cron ─────────────────────────────────────────────────────────
const cronManager = new CronManager();
cronManager.loadTasks();

app.get('/cron', (_req, res) => res.json(cronManager.listTasks()));

app.post('/cron', async (req, res) => {
  const { schedule, name, command } = req.body;
  if (!schedule || !name || !command) { res.status(400).json({ error: 'Missing fields' }); return; }
  const id = cronManager.createTask(schedule, name, command);
  await cronManager.saveTasks();
  res.json({ id, success: true });
});

app.delete('/cron/:id', async (req, res) => {
  const ok = cronManager.deleteTask(req.params.id);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  await cronManager.saveTasks();
  res.json({ success: true });
});

app.post('/cron/:id/toggle', async (req, res) => {
  const ok = cronManager.toggleTask(req.params.id, req.body.enabled);
  if (!ok) { res.status(404).json({ error: 'Not found' }); return; }
  await cronManager.saveTasks();
  res.json({ success: true });
});

// ── Settings ─────────────────────────────────────────────────────
const SETTINGS_FILE = path.join(SESSIONS_DIR, 'settings.json');

app.get('/settings', (_req, res) => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    res.json({ autoApprove: false, provider: { endpoint: '', apiKey: '', model: '' } });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')));
});

app.post('/settings', (req, res) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// ── Stream (claude CLI) ──────────────────────────────────────────
app.post('/stream', (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const existingMeta = sessionId ? loadSessionMeta(sessionId) : null;

  const args: string[] = [
    '-p', message,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
  ];
  if (sessionId) {
    args.push('--resume', sessionId);
  }

  const proc = spawn(CLAUDE_BIN, args, {
    env: process.env,
    cwd: process.env.HOME || '/tmp',
  });

  let lineBuffer = '';
  let currentSessionId = sessionId as string | undefined;
  const activeTools = new Map<number, { name: string; id: string }>();

  proc.stdout.on('data', (data: Buffer) => {
    lineBuffer += data.toString();
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);

        if (ev.type === 'system' && ev.subtype === 'init') {
          currentSessionId = ev.session_id;

        } else if (ev.type === 'stream_event') {
          const e = ev.event;

          if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
            activeTools.set(e.index, { name: e.content_block.name, id: e.content_block.id });
            res.write(formatSSE('tool_use', JSON.stringify({
              name: e.content_block.name,
              id: e.content_block.id,
              status: 'started',
            })));

          } else if (e.type === 'content_block_stop' && activeTools.has(e.index)) {
            const tool = activeTools.get(e.index)!;
            activeTools.delete(e.index);
            res.write(formatSSE('tool_use', JSON.stringify({
              name: tool.name,
              id: tool.id,
              status: 'completed',
            })));

          } else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
            res.write(formatSSE('text', e.delta.text));
          }

        } else if (ev.type === 'result' && currentSessionId) {
          const meta: SessionMeta = {
            id: currentSessionId,
            title: existingMeta?.title || message.substring(0, 60).trim(),
            createdAt: existingMeta?.createdAt || new Date().toISOString(),
            lastMessage: message.substring(0, 100),
            messageCount: (existingMeta?.messageCount || 0) + 1,
          };
          saveSessionMeta(meta);
          res.write(formatSSE('done', JSON.stringify({ sessionId: currentSessionId })));
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  });

  proc.stderr.on('data', (data: Buffer) => {
    console.error('[claude stderr]', data.toString());
  });

  proc.on('close', (_code) => {
    res.end();
  });

  proc.on('error', (err) => {
    res.write(formatSSE('error', err.message));
    res.end();
  });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Claude Desktop backend running on port ${PORT}`);
});

export default app;
