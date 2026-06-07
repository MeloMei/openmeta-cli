export type MachineErrorCode =
  | 'INVALID_ARGUMENT'
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'GITHUB_AUTH_FAILED'
  | 'LLM_AUTH_FAILED'
  | 'REPO_PREP_FAILED'
  | 'VALIDATION_FAILED'
  | 'DIRTY_WORKSPACE'
  | 'PR_CREATION_SKIPPED'
  | 'PR_CREATION_FAILED'
  | 'SKILL_HOST_UNSUPPORTED'
  | 'SKILL_INSTALL_FAILED'
  | 'INTERNAL_ERROR';

export interface MachineEnvelope<T> {
  version: 1;
  command: string;
  timestamp: string;
  data: T;
}

export interface MachineErrorEnvelope {
  version: 1;
  command: string;
  timestamp: string;
  error: {
    code: MachineErrorCode;
    message: string;
    details?: unknown;
  };
}
