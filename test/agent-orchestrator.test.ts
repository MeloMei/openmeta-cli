import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as infra from '../src/infra/index.js';
import { AgentOrchestrator } from '../src/orchestration/agent.js';
import { contributionPrService, gitService, githubService, inboxService, issueRankingService, llmService, proofOfWorkService } from '../src/services/index.js';
import type {
  AppConfig,
  ContributionInboxItem,
  ProofOfWorkRecord,
  RankedIssue,
  RepoWorkspaceContext,
  TestResult,
} from '../src/types/index.js';
import { createInboxItem, createPatchDraft, createProofRecord, createPullRequestDraft, createRankedIssue, createWorkspace } from './helpers/factories.js';

interface AgentOrchestratorInternals {
  validateConfig(config: AppConfig, options?: { requireLlm?: boolean }): Promise<void>;
  initializeClients(config: AppConfig, options?: { validateLlm?: boolean }): Promise<void>;
  promptForIssue(issues: RankedIssue[]): Promise<RankedIssue>;
  collectPatchDraftPaths(patchDraft: ReturnType<typeof createPatchDraft>): string[];
  normalizePatchPath(path: string): string | null;
  mergeSnippets(
    current: RepoWorkspaceContext['snippets'],
    next: RepoWorkspaceContext['snippets'],
  ): RepoWorkspaceContext['snippets'];
  uniqueStrings(values: string[]): string[];
  countValidationStates(results: TestResult[]): { passed: number; failed: number; unavailable: number };
  formatDate(value?: string): string;
  parseGitHubRepository(remoteUrl: string): { owner: string; repo: string };
  submitContributionPullRequestIfPossible(input: {
    config: AppConfig;
    allowRealPr: boolean;
    headless: boolean;
    issue: RankedIssue;
    prDraft: ReturnType<typeof createPullRequestDraft>;
    workspace: RepoWorkspaceContext;
    changedFiles: string[];
    validationResults: TestResult[];
  }): Promise<{
    branchName?: string;
    url?: string;
    number?: number;
    changedFiles: string[];
    validationResults: TestResult[];
  }>;
  publishArtifactsIfNeeded(input: {
    config: AppConfig;
    allowRealPr?: boolean;
    headless: boolean;
    dryRun?: boolean;
    issue: RankedIssue;
    patchDraftMarkdown: string;
    prDraftMarkdown: string;
    dossier: string;
    memoryMarkdown: string;
    inboxMarkdown: string;
    proofMarkdown: string;
    changedFiles: string[];
    validationResults: TestResult[];
    pullRequestUrl?: string;
  }): Promise<{ published: boolean }>;
  showInbox(): Promise<void>;
  showProofOfWork(): Promise<void>;
}

const tempDirs: string[] = [];

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    userProfile: {
      techStack: ['typescript', 'react'],
      proficiency: 'intermediate',
      focusAreas: ['frontend'],
    },
    github: {
      pat: 'ghp_test_token',
      username: 'octocat',
    },
    llm: {
      provider: 'custom',
      apiBaseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      modelName: 'test-model',
      apiHeaders: {},
    },
    automation: {
      enabled: true,
      scheduleTime: '09:00',
      timezone: 'UTC',
      contentType: 'issue-report',
      scheduler: 'manual',
      minMatchScore: 75,
      skipIfAlreadyGeneratedToday: false,
    },
    commitTemplate: 'feat: {{title}}',
    ...overrides,
  };
}

function createPublishInput(overrides: Partial<Parameters<AgentOrchestratorInternals['publishArtifactsIfNeeded']>[0]> = {}) {
  return {
    config: createConfig(),
    headless: false,
    issue: createRankedIssue({ repoFullName: 'acme/demo', number: 42 }),
    patchDraftMarkdown: '# Patch Draft',
    prDraftMarkdown: '# PR Draft',
    dossier: '# Dossier',
    memoryMarkdown: '# Memory',
    inboxMarkdown: '# Inbox',
    proofMarkdown: '# Proof',
    changedFiles: ['src/app.ts'],
    validationResults: [],
    ...overrides,
  };
}

beforeEach(() => {
  const tempHome = mkdtempSync(join(tmpdir(), 'openmeta-agent-orchestrator-'));
  tempDirs.push(tempHome);
  process.env['HOME'] = tempHome;
});

afterEach(() => {
  mock.restore();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('AgentOrchestrator support behavior', () => {
  test('validateConfig accepts local-only scout runs without an LLM key', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;

    await expect(orchestrator.validateConfig(createConfig({
      llm: {
        provider: 'custom',
        apiBaseUrl: 'https://example.com/v1',
        apiKey: '',
        modelName: 'test-model',
        apiHeaders: {},
      },
    }), { requireLlm: false })).resolves.toBeUndefined();
  });

  test('validateConfig rejects missing GitHub credentials and required LLM credentials', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;

    await expect(orchestrator.validateConfig(createConfig({
      github: { pat: '', username: '' },
    }))).rejects.toThrow('GitHub configuration is incomplete');

    await expect(orchestrator.validateConfig(createConfig({
      llm: {
        provider: 'custom',
        apiBaseUrl: 'https://example.com/v1',
        apiKey: '',
        modelName: 'test-model',
        apiHeaders: {},
      },
    }))).rejects.toThrow('LLM API configuration is incomplete');
  });

  test('initializeClients skips LLM validation when validateLlm is false', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const githubInit = spyOn(githubService, 'initialize').mockImplementation(() => {});
    const githubValidate = spyOn(githubService, 'validateCredentials').mockResolvedValue(true);
    const llmInit = spyOn(llmService, 'initialize').mockImplementation(() => {});
    const llmValidate = spyOn(llmService, 'validateConnection').mockResolvedValue(true);
    const prInit = spyOn(contributionPrService, 'initialize').mockImplementation(() => {});

    await orchestrator.initializeClients(createConfig(), { validateLlm: false });

    expect(githubInit).toHaveBeenCalledTimes(1);
    expect(githubValidate).toHaveBeenCalledTimes(1);
    expect(prInit).toHaveBeenCalledTimes(1);
    expect(llmInit).not.toHaveBeenCalled();
    expect(llmValidate).not.toHaveBeenCalled();
  });

  test('initializeClients surfaces GitHub and LLM validation failures with clear messages', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const githubInit = spyOn(githubService, 'initialize').mockImplementation(() => {});
    const llmInit = spyOn(llmService, 'initialize').mockImplementation(() => {});
    const prInit = spyOn(contributionPrService, 'initialize').mockImplementation(() => {});

    const githubValidate = spyOn(githubService, 'validateCredentials').mockResolvedValue(false);
    await expect(orchestrator.initializeClients(createConfig())).rejects.toThrow('GitHub validation failed');
    githubValidate.mockRestore();

    spyOn(githubService, 'validateCredentials').mockResolvedValue(true);
    spyOn(llmService, 'getLastValidationError').mockReturnValue('custom detail');
    spyOn(llmService, 'validateConnection').mockResolvedValue(false);
    await expect(orchestrator.initializeClients(createConfig())).rejects.toThrow('LLM validation failed: custom detail');

    githubInit.mockRestore();
    llmInit.mockRestore();
    prInit.mockRestore();
  });

  test('promptForIssue falls back to numeric input when interactive select is unavailable', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const issues = [
      createRankedIssue({ repoFullName: 'acme/one', number: 1 }),
      createRankedIssue({ repoFullName: 'acme/two', number: 2 }),
    ];

    const selectSpy = spyOn(infra, 'selectPrompt').mockRejectedValue(new Error('tty unavailable'));
    const promptSpy = spyOn(infra, 'prompt').mockResolvedValue({ selectedIndex: '2' });

    const selected = await orchestrator.promptForIssue(issues);

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(selected.repoFullName).toBe('acme/two');
  });

  test('promptForIssue rethrows user cancellation from the interactive selector', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const issues = [createRankedIssue()];
    spyOn(infra, 'selectPrompt').mockRejectedValue(new infra.UserCancelledError());

    await expect(orchestrator.promptForIssue(issues)).rejects.toBeInstanceOf(infra.UserCancelledError);
  });

  test('normalizes patch paths, deduplicates snippets, and trims unique strings', () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const patchDraft = createPatchDraft({
      targetFiles: [
        { path: '/src/app.ts', reason: 'main file' },
        { path: ' src/app.ts ', reason: 'duplicate file' },
        { path: '../escape.ts', reason: 'invalid' },
      ],
      proposedChanges: [
        {
          title: 'Update code',
          details: 'Adjust the implementation.',
          files: ['src/app.ts', 'src/utils.ts', 'src/utils.ts'],
        },
      ],
    });

    expect(orchestrator.normalizePatchPath('/src/app.ts')).toBe('src/app.ts');
    expect(orchestrator.normalizePatchPath('../escape.ts')).toBeNull();
    expect(orchestrator.collectPatchDraftPaths(patchDraft)).toEqual(['src/app.ts', 'src/utils.ts']);
    expect(orchestrator.uniqueStrings([' one ', 'two', 'one', ''])).toEqual(['one', 'two']);
    expect(orchestrator.mergeSnippets(
      [{ path: 'src/app.ts', content: 'old' }],
      [{ path: 'src/app.ts', content: 'new' }, { path: 'src/utils.ts', content: 'util' }],
    )).toEqual([
      { path: 'src/app.ts', content: 'old' },
      { path: 'src/utils.ts', content: 'util' },
    ]);
  });

  test('formats dates, parses GitHub remotes, and counts validation states', () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;

    expect(orchestrator.formatDate('2026-06-03T10:20:30.000Z')).toBe('2026-06-03');
    expect(orchestrator.formatDate()).toBe('n/a');
    expect(orchestrator.parseGitHubRepository('git@github.com:openai/openmeta-cli.git')).toEqual({
      owner: 'openai',
      repo: 'openmeta-cli',
    });
    expect(() => orchestrator.parseGitHubRepository('https://example.com/not-github')).toThrow(
      'Unable to parse GitHub repository from remote URL',
    );
    expect(orchestrator.countValidationStates([
      { command: 'bun test', exitCode: 0, passed: true, output: 'ok' },
      { command: 'npm run lint', exitCode: 127, passed: false, output: 'command not found' },
      { command: 'pytest', exitCode: 1, passed: false, output: 'AssertionError' },
    ])).toEqual({ passed: 1, unavailable: 1, failed: 1 });
  });

  test('submitContributionPullRequestIfPossible skips when there are no changed files or drafts require review', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const issue = createRankedIssue();
    const prDraft = createPullRequestDraft();
    const workspace = createWorkspace();

    const noChanges = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: true,
      headless: false,
      issue,
      prDraft,
      workspace,
      changedFiles: [],
      validationResults: [],
    });
    expect(noChanges.changedFiles).toEqual([]);

    const reviewRequired = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: false,
      headless: false,
      issue,
      prDraft,
      workspace,
      changedFiles: ['src/app.ts'],
      validationResults: [],
    });
    expect(reviewRequired.changedFiles).toEqual(['src/app.ts']);
    expect(reviewRequired.url).toBeUndefined();
  });

  test('submitContributionPullRequestIfPossible respects headless validation failures and interactive confirmations', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const issue = createRankedIssue();
    const prDraft = createPullRequestDraft();
    const workspace = createWorkspace();

    const headlessBlocked = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: true,
      headless: true,
      issue,
      prDraft,
      workspace,
      changedFiles: ['src/app.ts'],
      validationResults: [{ command: 'pytest', exitCode: 1, passed: false, output: 'AssertionError' }],
    });
    expect(headlessBlocked.url).toBeUndefined();

    const promptSpy = spyOn(infra, 'prompt')
      .mockResolvedValueOnce({ confirmPr: false })
      .mockResolvedValueOnce({ confirmPr: true })
      .mockResolvedValueOnce({ continueWithFailures: false });

    const declined = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: true,
      headless: false,
      issue,
      prDraft,
      workspace,
      changedFiles: ['src/app.ts'],
      validationResults: [],
    });
    expect(declined.url).toBeUndefined();

    const failedValidationDeclined = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: true,
      headless: false,
      issue,
      prDraft,
      workspace,
      changedFiles: ['src/app.ts'],
      validationResults: [{ command: 'pytest', exitCode: 1, passed: false, output: 'AssertionError' }],
    });
    expect(failedValidationDeclined.url).toBeUndefined();
    expect(promptSpy).toHaveBeenCalledTimes(3);
  });

  test('submitContributionPullRequestIfPossible returns PR details on success and degrades gracefully on failure', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const issue = createRankedIssue();
    const prDraft = createPullRequestDraft();
    const workspace = createWorkspace();
    spyOn(infra, 'prompt').mockResolvedValue({ confirmPr: true });

    const submitSpy = spyOn(contributionPrService, 'submitDraftPullRequest')
      .mockResolvedValueOnce({
        branchName: 'openmeta/agent-42-branch',
        url: 'https://github.com/acme/demo/pull/42',
        number: 42,
      })
      .mockRejectedValueOnce(new Error('network problem'));

    const success = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: true,
      headless: false,
      issue,
      prDraft,
      workspace,
      changedFiles: ['src/app.ts'],
      validationResults: [],
    });
    expect(success.url).toBe('https://github.com/acme/demo/pull/42');
    expect(success.branchName).toBe('openmeta/agent-42-branch');

    const failed = await orchestrator.submitContributionPullRequestIfPossible({
      config: createConfig(),
      allowRealPr: true,
      headless: false,
      issue,
      prDraft,
      workspace,
      changedFiles: ['src/app.ts'],
      validationResults: [],
    });
    expect(failed.url).toBeUndefined();
    expect(submitSpy).toHaveBeenCalledTimes(2);
  });

  test('publishArtifactsIfNeeded returns preview data in dry-run mode and skips publish when confirmations fail', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const targetRepoPath = mkdtempSync(join(tmpdir(), 'openmeta-agent-publish-preview-'));
    tempDirs.push(targetRepoPath);

    const dryRun = await orchestrator.publishArtifactsIfNeeded(createPublishInput({
      dryRun: true,
    }));
    expect(dryRun).toEqual({ published: false });

    const promptSpy = spyOn(infra, 'prompt')
      .mockResolvedValueOnce({ confirmCommit: false })
      .mockResolvedValueOnce({ confirmCommit: true })
      .mockResolvedValueOnce({ finalConfirm: false });
    spyOn(orchestrator as object as { ensureTargetRepo: () => Promise<unknown> }, 'ensureTargetRepo').mockResolvedValue({
      path: targetRepoPath,
      owner: 'octocat',
      repo: 'openmeta-daily',
      defaultBranch: 'main',
    });

    const declinedCommit = await orchestrator.publishArtifactsIfNeeded(createPublishInput());
    expect(declinedCommit).toEqual({ published: false });

    spyOn(gitService, 'initialize').mockResolvedValue(true);
    const finalDeclined = await orchestrator.publishArtifactsIfNeeded(createPublishInput());
    expect(finalDeclined).toEqual({ published: false });
    expect(promptSpy).toHaveBeenCalledTimes(3);
  });

  test('publishArtifactsIfNeeded throws on git setup failures and reports success after publishing', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const targetRepoPath = mkdtempSync(join(tmpdir(), 'openmeta-agent-publish-target-'));
    tempDirs.push(targetRepoPath);
    const config = createConfig({
      github: {
        pat: 'ghp_test_token',
        username: 'octocat',
        targetRepoPath,
      },
    });

    const promptSpy = spyOn(infra, 'prompt')
      .mockResolvedValueOnce({ confirmCommit: true })
      .mockResolvedValueOnce({ confirmCommit: true })
      .mockResolvedValueOnce({ finalConfirm: true });

    spyOn(orchestrator as object as { ensureTargetRepo: () => Promise<unknown> }, 'ensureTargetRepo').mockResolvedValue({
      path: targetRepoPath,
      owner: 'octocat',
      repo: 'openmeta-daily',
      defaultBranch: 'main',
    });

    spyOn(gitService, 'initialize').mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    spyOn(gitService, 'writeAndPublish').mockResolvedValueOnce({
      branch: 'openmeta-artifacts',
      fileNames: ['INBOX.md'],
      filePaths: [join(targetRepoPath, 'INBOX.md')],
      pushed: true,
    });

    await expect(orchestrator.publishArtifactsIfNeeded(createPublishInput({ config }))).rejects.toThrow(
      `Failed to initialize the target repository at ${targetRepoPath}.`,
    );

    const published = await orchestrator.publishArtifactsIfNeeded(createPublishInput({
      config,
      headless: false,
      pullRequestUrl: 'https://github.com/acme/demo/pull/42',
    }));
    expect(published).toEqual({ published: true });
    expect(promptSpy).toHaveBeenCalledTimes(3);
  });

  test('showInbox and showProofOfWork render empty and populated states', async () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentOrchestratorInternals;
    const emptyStateSpy = spyOn(infra.ui, 'emptyState').mockImplementation(() => {});
    const recordListSpy = spyOn(infra.ui, 'recordList').mockImplementation(() => {});
    const heroSpy = spyOn(infra.ui, 'hero').mockImplementation(() => {});
    const statsSpy = spyOn(infra.ui, 'stats').mockImplementation(() => {});

    spyOn(inboxService, 'load')
      .mockReturnValueOnce({ items: [] })
      .mockReturnValueOnce({ items: [createInboxItem({ generatedAt: '2026-06-03T00:00:00.000Z' }) as ContributionInboxItem] });
    spyOn(proofOfWorkService, 'load')
      .mockReturnValueOnce({ records: [] })
      .mockReturnValueOnce({ records: [createProofRecord({ generatedAt: '2026-06-03T00:00:00.000Z' }) as ProofOfWorkRecord] });

    await orchestrator.showInbox();
    await orchestrator.showInbox();
    await orchestrator.showProofOfWork();
    await orchestrator.showProofOfWork();

    expect(heroSpy).toHaveBeenCalledTimes(4);
    expect(emptyStateSpy).toHaveBeenCalledTimes(2);
    expect(recordListSpy).toHaveBeenCalledTimes(2);
    expect(statsSpy).toHaveBeenCalledTimes(2);
  });

  test('scout renders an empty state when no issues meet the thresholds', async () => {
    const orchestrator = new AgentOrchestrator();
    const emptyStateSpy = spyOn(infra.ui, 'emptyState').mockImplementation(() => {});
    spyOn(infra.configService, 'get').mockResolvedValue(createConfig());
    spyOn(AgentOrchestrator.prototype as unknown as { validateConfig: AgentOrchestratorInternals['validateConfig'] }, 'validateConfig')
      .mockResolvedValue(undefined as never);
    spyOn(AgentOrchestrator.prototype as unknown as { initializeClients: AgentOrchestratorInternals['initializeClients'] }, 'initializeClients')
      .mockResolvedValue(undefined as never);
    spyOn(issueRankingService, 'loadRankedIssues').mockResolvedValue([]);

    await orchestrator.scout({ localOnly: true });

    expect(emptyStateSpy).toHaveBeenCalledWith(
      'OpenMeta Scout',
      'No issues found',
      'No issues met the current scoring thresholds.',
    );
  });
});
