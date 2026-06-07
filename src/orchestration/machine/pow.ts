import { agentOrchestrator } from '../index.js';
import { mapMachineError } from './errors.js';
import { buildMachineEnvelope, writeMachinePayload } from './runtime.js';

export class MachineProofOfWorkOrchestrator {
  async execute(): Promise<void> {
    try {
      const result = await agentOrchestrator.getProofOfWorkMachineResult();
      writeMachinePayload(buildMachineEnvelope('machine pow', result));
    } catch (error) {
      const mapped = mapMachineError('machine pow', error);
      writeMachinePayload(mapped.payload);
      process.exitCode = mapped.exitCode;
    }
  }
}

export const machineProofOfWorkOrchestrator = new MachineProofOfWorkOrchestrator();
