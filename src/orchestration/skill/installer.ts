import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { renderSkillBundle } from './renderer.js';
import type { SkillHost } from './catalog.js';

export interface SkillInstallResult {
  host: SkillHost;
  installed: boolean;
  installPath?: string;
  exportedFiles: string[];
  manualInstructions?: string;
}

function resolveDefaultInstallPath(host: SkillHost): string | null {
  if (host === 'claude-code') {
    return join(homedir(), '.claude', 'skills', 'openmeta');
  }

  if (host === 'openclaw') {
    return join(homedir(), '.openclaw', 'skills', 'openmeta');
  }

  return null;
}

export async function installSkillBundle(host: SkillHost): Promise<SkillInstallResult> {
  const installPath = resolveDefaultInstallPath(host);
  if (!installPath) {
    return {
      host,
      installed: false,
      exportedFiles: [],
      manualInstructions: `Unsupported skill host: ${host}`,
    };
  }

  mkdirSync(installPath, { recursive: true });
  const rendered = await renderSkillBundle(host, installPath);

  return {
    host,
    installed: existsSync(installPath),
    installPath,
    exportedFiles: rendered.files,
  };
}

export function getInstallTarget(host: SkillHost): string | null {
  return resolveDefaultInstallPath(host);
}
