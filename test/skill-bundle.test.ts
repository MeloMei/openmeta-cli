import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import packageJson from '../package.json';
import { getSupportedSkillHosts, renderSkillBundle } from '../src/orchestration/skill/index.js';

let tempRoot = '';

describe('skill bundle rendering', () => {
  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'openmeta-skill-bundle-'));
  });

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  test('renders claude-code and openclaw bundles from one canonical spec', async () => {
    expect(getSupportedSkillHosts()).toEqual(['claude-code', 'openclaw']);

    const claude = await renderSkillBundle('claude-code', tempRoot);
    const openclaw = await renderSkillBundle('openclaw', tempRoot);

    expect(readFileSync(claude.files[0]!, 'utf-8')).toContain('openmeta machine doctor');
    expect(readFileSync(claude.files[0]!, 'utf-8')).toContain('openmeta machine agent');
    expect(readFileSync(openclaw.files[0]!, 'utf-8')).toContain('openmeta machine doctor');
    expect(readFileSync(openclaw.files[0]!, 'utf-8')).toContain('openmeta machine agent');
  });
});

describe('package files', () => {
  test('publishes skill assets with the CLI binary', () => {
    expect(packageJson.files).toContain('bin/openmeta.js');
    expect(packageJson.files).toContain('skills');
  });
});
