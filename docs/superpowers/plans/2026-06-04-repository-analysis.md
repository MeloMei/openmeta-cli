# Repository Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `openmeta analyze --repo <repository>` to generate LLM-backed contribution suggestions from repository code when no issue exists.

**Architecture:** Add a thin command and a focused analyzer orchestration path. Reuse repo parsing, workspace cloning, LLM structured output parsing, content rendering, and existing patch/PR draft generators where possible.

**Tech Stack:** Bun, Commander, TypeScript, Zod, OpenAI-compatible chat completions, existing OpenMeta service layer.

---

### Task 1: Structured Suggestion Contract

**Files:**
- Modify: `src/contracts/agent-contracts.ts`
- Modify: `src/types/agent.types.ts`
- Modify: `test/llm.test.ts`

- [x] Write a failing test that parses a `repository_suggestion_list` envelope and deduplicates/validates suggestions.
- [x] Add `RepositoryImprovementSuggestionSchema` and `RepositorySuggestionListEnvelopeSchema`.
- [x] Export `RepositoryImprovementSuggestion` and structured result types.
- [x] Run `bun test test/llm.test.ts`.

### Task 2: LLM Repository Analysis

**Files:**
- Modify: `src/infra/prompt-templates.ts`
- Modify: `src/services/llm.ts`
- Modify: `test/llm.test.ts`

- [x] Write a failing test for `LLMService.analyzeRepository(...)` that verifies repository context and streaming/reasoning options still flow through `chat(...)`.
- [x] Add `REPOSITORY_ANALYSIS_PROMPT` and repair prompt.
- [x] Implement `analyzeRepository(repoFullName, workspace, memory)`.
- [x] Run `bun test test/llm.test.ts`.

### Task 3: Repository Workspace Context

**Files:**
- Modify: `src/services/workspace.ts`
- Modify: `test/workspace.test.ts`

- [x] Write a failing test for preparing a repository workspace without a real issue object.
- [x] Add `prepareRepositoryWorkspace(repoFullName, memory, runChecks, executionMode)`.
- [x] Share clone/default-branch/test-command logic with `prepareWorkspace(...)`.
- [x] Rank repo analysis candidate files using README/config/source/test path signals and repo memory.
- [x] Run `bun test test/workspace.test.ts`.

### Task 4: Artifact Rendering

**Files:**
- Modify: `src/services/content.ts`
- Modify: `test/content.test.ts`

- [x] Write a failing test for repository analysis markdown output.
- [x] Add `formatRepositoryAnalysisMarkdown(repoFullName, workspace, suggestions, selectedSuggestion?)`.
- [x] Include target files, proposed changes, validation plan, risks, and selected marker.
- [x] Run `bun test test/content.test.ts`.

### Task 5: Analyze Command and Orchestration

**Files:**
- Create: `src/commands/analyze.ts`
- Create: `src/orchestration/analyze.ts`
- Modify: `src/commands/index.ts`
- Modify: `src/cli.ts`
- Modify: `src/orchestration/index.ts`
- Modify: `test/agent-run.test.ts` or add `test/analyze-run.test.ts`

- [x] Write a failing command/orchestration test for `openmeta analyze --repo owner/name`.
- [x] Implement provider validation and workspace preparation.
- [x] Generate suggestions and render artifacts.
- [x] Select the highest-score suggestion in headless mode; prompt in interactive mode if existing prompt helpers support it.
- [x] Convert the selected suggestion into a synthetic ranked issue and generate patch/PR drafts.
- [x] Run targeted analyze tests.

### Task 6: Verification and PR Update

**Files:**
- No new code unless verification finds a defect.

- [x] Run `bun test`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run build`.
- [ ] Commit only repository analysis files, excluding untracked `AGENTS.md`.
- [ ] Push `codex/agent-targeting-llm-options` to the fork so PR #38 updates.
