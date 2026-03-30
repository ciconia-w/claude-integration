import * as fs from 'fs/promises';
import * as path from 'path';

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  env?: Record<string, string>;
  type?: string;
  url?: string;
}

export class MCPManager {
  private servers: Map<string, MCPServer> = new Map();
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.env.HOME || '', '.claude/settings.json');
  }

  async loadServers(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);

      if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          const server = serverConfig as any;
          this.servers.set(name, {
            name,
            command: server.command || '',
            args: server.args || [],
            enabled: server.enabled !== false,
            env: server.env
          });
        }
      }
    } catch (error) {
      // Config file doesn't exist or can't be read
    }
  }

  listServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  getServer(name: string): MCPServer | null {
    return this.servers.get(name) || null;
  }

  toggleServer(name: string, enabled: boolean): boolean {
    const server = this.servers.get(name);
    if (server) {
      server.enabled = enabled;
      return true;
    }
    return false;
  }

  async saveServers(): Promise<void> {
    const config: any = { mcpServers: {} };

    for (const [name, server] of this.servers.entries()) {
      config.mcpServers[name] = {
        command: server.command,
        args: server.args,
        enabled: server.enabled,
        env: server.env
      };
    }

    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}
