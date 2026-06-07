import { configOrchestrator } from '../index.js';
import { mapMachineError } from './errors.js';
import { buildMachineEnvelope, writeMachinePayload } from './runtime.js';

export class MachineConfigOrchestrator {
  async get(): Promise<void> {
    try {
      const snapshot = await configOrchestrator.getMachineSnapshot();
      writeMachinePayload(buildMachineEnvelope('machine config get', snapshot));
    } catch (error) {
      const mapped = mapMachineError('machine config get', error);
      writeMachinePayload(mapped.payload);
      process.exitCode = mapped.exitCode;
    }
  }
}

export const machineConfigOrchestrator = new MachineConfigOrchestrator();
