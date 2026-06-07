import { describe, expect, test } from 'bun:test';
import { Command } from 'commander';
import { registerSkillCommand } from '../src/commands/skill.js';

describe('registerSkillCommand', () => {
  test('registers skill bundle management commands', () => {
    const program = new Command();
    registerSkillCommand(program);

    const skillCommand = program.commands.find((command) => command.name() === 'skill');
    const help = skillCommand?.helpInformation() ?? '';

    expect(help).toContain('list');
    expect(help).toContain('export');
    expect(help).toContain('install');
    expect(help).toContain('doctor');
  });
});
