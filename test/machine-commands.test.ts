import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { Command } from 'commander';
import { registerMachineCommand } from '../src/commands/machine.js';
import * as infra from '../src/infra/index.js';
import { configOrchestrator } from '../src/orchestration/index.js';

function captureStdout(): string[] {
  const writes: string[] = [];
  spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  });
  return writes;
}

describe('machine commands', () => {
  afterEach(() => {
    mock.restore();
    process.exitCode = 0;
  });

  test('registers machine doctor and config commands', () => {
    const program = new Command();
    registerMachineCommand(program);

    const machineCommand = program.commands.find((command) => command.name() === 'machine');
    const help = machineCommand?.helpInformation() ?? '';

    expect(help).toContain('doctor');
    expect(help).toContain('config');
    expect(help).toContain('provider');
    expect(help).toContain('runs');
  });

  test('machine doctor writes only JSON to stdout', async () => {
    const writes = captureStdout();
    const program = new Command();
    registerMachineCommand(program);

    spyOn(infra.configService, 'get').mockResolvedValue({
      userProfile: { techStack: [], proficiency: 'beginner', focusAreas: [] },
      github: { pat: '', username: '', targetRepoPath: '' },
      llm: {
        provider: 'openai',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        modelName: 'gpt-4o-mini',
        apiHeaders: {},
        activeProfile: '',
        profiles: {},
      },
      automation: {
        enabled: false,
        scheduleTime: '09:00',
        timezone: 'UTC',
        contentType: 'research_note',
        scheduler: 'manual',
        minMatchScore: 70,
        skipIfAlreadyGeneratedToday: true,
      },
      commitTemplate: 'feat: {{title}}',
    });

    await program.parseAsync(['machine', 'doctor'], { from: 'user' });

    const output = writes.join('');
    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain('OpenMeta Doctor');
  });

  test('machine config get writes a masked JSON snapshot', async () => {
    const writes = captureStdout();
    const program = new Command();
    registerMachineCommand(program);

    spyOn(configOrchestrator, 'getMachineSnapshot').mockResolvedValue({
      userProfile: { techStack: [], proficiency: 'beginner', focusAreas: [] },
      github: { username: 'octocat', pat: '***oken', targetRepoPath: '' },
      llm: {
        provider: 'openai',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: '***-key',
        modelName: 'gpt-4o-mini',
        apiHeaders: {},
        activeProfile: '',
        savedProfiles: [],
      },
      automation: {
        enabled: false,
        scheduleTime: '09:00',
        timezone: 'UTC',
        contentType: 'research_note',
        scheduler: 'manual',
        minMatchScore: 70,
        skipIfAlreadyGeneratedToday: true,
      },
      commitTemplate: 'feat: {{title}}',
    });

    await program.parseAsync(['machine', 'config', 'get'], { from: 'user' });

    const output = JSON.parse(writes.join(''));
    expect(output.command).toBe('machine config get');
    expect(output.data.github.pat).toBe('***oken');
  });
});
