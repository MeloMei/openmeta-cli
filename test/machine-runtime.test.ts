import { describe, expect, test } from 'bun:test';
import { buildMachineEnvelope, mapMachineError } from '../src/orchestration/machine/index.js';

describe('machine runtime', () => {
  test('builds a success envelope with command, version, timestamp, and data', () => {
    const envelope = buildMachineEnvelope('machine doctor', { ready: true });

    expect(envelope.version).toBe(1);
    expect(envelope.command).toBe('machine doctor');
    expect(envelope.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(envelope.data).toEqual({ ready: true });
  });

  test('maps invalid argument failures to exit code 2 and INVALID_ARGUMENT', () => {
    const mapped = mapMachineError('machine config set', new Error('llm.stream must be a boolean value.'));

    expect(mapped.exitCode).toBe(2);
    expect(mapped.payload.error.code).toBe('INVALID_ARGUMENT');
  });
});
