import * as fs from 'fs/promises';
import * as path from 'path';

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  path: string;
}

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private skillsPath: string;

  constructor(skillsPath?: string) {
    this.skillsPath = skillsPath || path.join(process.env.HOME || '', '.claude/skills');
  }

  async loadSkills(): Promise<void> {
    try {
      const entries = await fs.readdir(this.skillsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(this.skillsPath, entry.name);
          const skill: Skill = {
            name: entry.name,
            description: '',
            enabled: true,
            path: skillPath
          };
          this.skills.set(entry.name, skill);
        }
      }
    } catch (error) {
      // Skills directory doesn't exist or can't be read
    }
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkill(name: string): Skill | null {
    return this.skills.get(name) || null;
  }

  toggleSkill(name: string, enabled: boolean): boolean {
    const skill = this.skills.get(name);
    if (skill) {
      skill.enabled = enabled;
      return true;
    }
    return false;
  }
}
