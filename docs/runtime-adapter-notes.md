# CLI Runtime Adapter Notes

This branch adds a thin adapter layer so the backend can keep its current
HTTP/SSE contract while swapping the underlying Claude-compatible CLI.

## Why this exists

- The original backend hard-coded `claude` and a single transcript path.
- We want to experiment with other Claude-style runtimes such as `claude-js`
  or `node dist/cli.js` wrappers without changing the desktop front end.
- The desktop/web UIs still expect the same SSE event family:
  `text`, `tool_use`, `done`, and `error`.

## What changed

- `src/settings.ts`
  - Normalizes persisted settings.
  - Adds a `runtime` section with:
    - `command`
    - `launchArgs`
    - `workingDirectory`
    - `transcriptRoot`
  - Merges new saves into the existing settings file so older UIs do not erase
    runtime fields.
- `src/cli-runtime.ts`
  - Resolves the active CLI command.
  - Builds non-interactive CLI args.
  - Finds transcript files recursively by `sessionId`.
- `server.ts`
  - Uses the runtime adapter instead of a hard-coded `claude` binary.
  - Reads and writes merged settings.
  - Maps CLI NDJSON back into the existing SSE contract.
  - Stores `transcriptPath` in session metadata once known.
- `public/index.html`
  - Adds runtime settings inputs for command, args, workdir, and transcript root.
- `vitest.config.ts`
  - Excludes `dist/` from test discovery so compiled CommonJS test files do not
    get executed by Vitest a second time.

## Expected settings shape

```json
{
  "autoApprove": false,
  "provider": {
    "endpoint": "",
    "apiKey": "",
    "model": "claude-sonnet-4-6"
  },
  "runtime": {
    "command": "node",
    "launchArgs": ["D:/path/to/claude-code/dist/cli.js"],
    "workingDirectory": "D:/workspace",
    "transcriptRoot": "C:/Users/you/.claude/projects"
  }
}
```

## Things to watch next

- `public/index.html` still contains legacy mojibake text in parts of the UI.
  This branch intentionally did not rewrite the whole file, only the settings
  and adapter-related logic.
- The Qt desktop app in the separate `claude-desktop` repo does not yet expose
  these new runtime fields in its native settings panel. The embedded web UI
  does.
- If a new CLI emits slightly different NDJSON event shapes, adapt the parsing
  in `server.ts` while keeping the outward SSE events stable.
