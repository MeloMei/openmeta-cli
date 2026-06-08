import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSkillsRoot, type SkillHost, loadCapabilityCatalog, loadCoreSkill, loadHostTemplate } from './catalog.js';

export interface RenderedSkillBundle {
  host: SkillHost;
  files: string[];
  sourceRoot: string;
}

export async function renderSkillBundle(host: SkillHost, outputDir: string): Promise<RenderedSkillBundle> {
  const targetDir = join(outputDir, host);
  mkdirSync(targetDir, { recursive: true });

  const rendered = loadHostTemplate(host)
    .replace('{{coreSkill}}', loadCoreSkill())
    .replace('{{capabilityCatalog}}', loadCapabilityCatalog());
  const skillPath = join(targetDir, 'skill.md');
  writeFileSync(skillPath, rendered, 'utf-8');

  return {
    host,
    files: [skillPath],
    sourceRoot: getSkillsRoot(),
  };
}
