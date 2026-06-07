import { providerOrchestrator } from '../index.js';
import { mapMachineError } from './errors.js';
import { buildMachineEnvelope, writeMachinePayload } from './runtime.js';

export class MachineProviderOrchestrator {
  async use(name: string): Promise<void> {
    try {
      const result = await providerOrchestrator.useProfile(name);
      writeMachinePayload(buildMachineEnvelope('machine provider use', result));
    } catch (error) {
      const mapped = mapMachineError('machine provider use', error);
      writeMachinePayload(mapped.payload);
      process.exitCode = mapped.exitCode;
    }
  }
}

export const machineProviderOrchestrator = new MachineProviderOrchestrator();
