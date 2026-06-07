import { Command } from 'commander';
import {
  machineConfigOrchestrator,
  machineDoctorOrchestrator,
  machineInboxOrchestrator,
  machineProofOfWorkOrchestrator,
  machineProviderOrchestrator,
  machineRunsOrchestrator,
} from '../orchestration/machine/index.js';

export function registerMachineCommand(program: Command): void {
  const machine = program
    .command('machine')
    .description('Stable JSON-first automation surface');

  machine
    .command('doctor')
    .description('Inspect local prerequisites and return machine-readable diagnostics')
    .action(() => machineDoctorOrchestrator.execute());

  const config = machine
    .command('config')
    .description('Machine-safe configuration access');

  config
    .command('get')
    .description('Read a masked machine-safe configuration snapshot')
    .action(() => machineConfigOrchestrator.get());

  const provider = machine
    .command('provider')
    .description('Machine-safe provider profile management');

  provider
    .command('use <name>')
    .description('Switch to a saved provider profile and return machine-readable state')
    .action((name: string) => machineProviderOrchestrator.use(name));

  machine
    .command('runs [id]')
    .description('Machine-safe run history access')
    .option('--limit <count>', 'Number of runs to show', '10')
    .action((id: string | undefined, options: { limit?: string }) => machineRunsOrchestrator.show(id, options));

  machine
    .command('inbox')
    .description('Machine-safe drafted opportunity list')
    .action(() => machineInboxOrchestrator.execute());

  machine
    .command('pow')
    .description('Machine-safe proof-of-work list')
    .action(() => machineProofOfWorkOrchestrator.execute());
}
