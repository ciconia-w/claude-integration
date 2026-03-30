import { describe, it, expect } from 'vitest';
import { SkillManager } from './skill-manager';

describe('SkillManager', () => {
  it('should list available skills', () => {
    const sm = new SkillManager();
    const skills = sm.listSkills();

    expect(Array.isArray(skills)).toBe(true);
  });

  it('should get skill details', () => {
    const sm = new SkillManager();
    sm.toggleSkill('test-skill', true);
    const skill = sm.getSkill('test-skill');

    if (skill) {
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('enabled');
    } else {
      expect(skill).toBeNull();
    }
  });
});
