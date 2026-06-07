import { agentOrchestrator } from '../index.js';
import { mapMachineError } from './errors.js';
import { buildMachineEnvelope, writeMachinePayload } from './runtime.js';

export class MachineInboxOrchestrator {
  async execute(): Promise<void> {
    try {
      const result = await agentOrchestrator.getInboxMachineResult();
      writeMachinePayload(buildMachineEnvelope('machine inbox', result));
    } catch (error) {
      const mapped = mapMachineError('machine inbox', error);
      writeMachinePayload(mapped.payload);
      process.exitCode = mapped.exitCode;
    }
  }
}

export const machineInboxOrchestrator = new MachineInboxOrchestrator();
