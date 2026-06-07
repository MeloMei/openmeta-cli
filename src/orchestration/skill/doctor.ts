import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { getInstallTarget } from './installer.js';
import type { SkillHost } from './catalog.js';

export interface SkillDoctorResult {
  host: SkillHost;
  supported: boolean;
  installPath?: string;
  installPathExists: boolean;
  openmetaOnPath: boolean;
  nextActions: string[];
}

export async function doctorSkillBundle(host: SkillHost): Promise<SkillDoctorResult> {
  const installPath = getInstallTarget(host);
  const openmeta = spawnSync('openmeta', ['--version'], { encoding: 'utf-8' });
  const installPathExists = Boolean(installPath && existsSync(installPath));

  return {
    host,
    supported: Boolean(installPath),
    installPath: installPath || undefined,
    installPathExists,
    openmetaOnPath: !openmeta.error && openmeta.status === 0,
    nextActions: [
      ...(installPathExists ? [] : ['run_openmeta_skill_install']),
      ...(!openmeta.error && openmeta.status === 0 ? [] : ['ensure_openmeta_on_path']),
    ],
  };
}
