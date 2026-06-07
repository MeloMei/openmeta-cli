import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SKILLS_ROOT = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), '..', 'skills');

export type SkillHost = 'claude-code' | 'openclaw';

export function getSkillsRoot(): string {
  return SKILLS_ROOT;
}

export function getSupportedSkillHosts(): SkillHost[] {
  return ['claude-code', 'openclaw'];
}

export function loadCoreSkill(): string {
  return readFileSync(join(SKILLS_ROOT, 'core', 'openmeta.md'), 'utf-8');
}

export function loadCapabilityCatalog(): string {
  return readFileSync(join(SKILLS_ROOT, 'schema', 'capability-catalog.json'), 'utf-8');
}

export function loadHostTemplate(host: SkillHost): string {
  return readFileSync(join(SKILLS_ROOT, 'templates', host, 'skill.md'), 'utf-8');
}
