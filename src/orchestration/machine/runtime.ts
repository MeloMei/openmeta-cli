import type { MachineEnvelope, MachineErrorCode, MachineErrorEnvelope } from './types.js';

function now(): string {
  return new Date().toISOString();
}

export function buildMachineEnvelope<T>(command: string, data: T): MachineEnvelope<T> {
  return {
    version: 1,
    command,
    timestamp: now(),
    data,
  };
}

export function buildMachineErrorEnvelope(
  command: string,
  code: MachineErrorCode,
  message: string,
  details?: unknown,
): MachineErrorEnvelope {
  return {
    version: 1,
    command,
    timestamp: now(),
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

export function writeMachinePayload(payload: MachineEnvelope<unknown> | MachineErrorEnvelope): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
