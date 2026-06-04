# Repository Analysis Design

## Goal

Add a repository-first contribution flow for projects that do not have a suitable GitHub issue. The first version should analyze a target GitHub repository, generate structured improvement suggestions, let the user pick one, and reuse the existing patch and PR draft pipeline.

## Command

Add:

```bash
openmeta analyze --repo <owner/name-or-github-url>
```

Supported repository values match the existing `--repo` parsing: `owner/name`, `https://github.com/owner/name`, and `git@github.com:owner/name.git`.

## Behavior

1. Validate GitHub and LLM providers with the same config path used by `agent`.
2. Prepare a local workspace for the target repository.
3. Build a repository analysis context from top-level files, candidate files, snippets, detected validation commands, and repo memory.
4. Ask the LLM for 3-5 structured improvement suggestions.
5. Show the ranked suggestions and allow the user to select one in interactive mode.
6. Convert the selected suggestion into a synthetic ranked issue so existing patch draft, optional implementation draft, validation, and PR draft logic can be reused later.
7. First implementation produces repository analysis artifacts and a patch/PR draft for the selected suggestion. Direct PR publication remains a follow-up unless explicitly wired through an existing safe path.

## Data Shape

The LLM returns a structured envelope:

```ts
{
  version: '1',
  kind: 'repository_suggestion_list',
  status: 'success' | 'needs_review',
  data: {
    suggestions: RepositoryImprovementSuggestion[]
  }
}
```

Each suggestion includes title, summary, rationale, target files, proposed changes, validation plan, risks, estimated workload, and PR potential score.

## Architecture

- Keep `src/commands/analyze.ts` thin.
- Add orchestration in `src/orchestration/analyze.ts`.
- Extend `src/contracts/agent-contracts.ts` with the new structured output schema.
- Extend `src/services/llm.ts` with `analyzeRepository(...)`.
- Extend `src/services/workspace.ts` with repository-level workspace preparation that does not require a real issue.
- Extend `src/services/content.ts` with repository analysis markdown rendering.

The first implementation should share code with existing agent services rather than duplicating patch generation, validation command detection, or LLM parsing.

## Testing

Add focused tests for:

- Parsing and normalizing repository suggestion envelopes.
- LLM request generation for repository analysis.
- Repository-level workspace preparation without a real issue.
- Markdown rendering for repository analysis artifacts.
- CLI command registration/help for `openmeta analyze`.

Full verification before commit:

```bash
bun test
bun run typecheck
bun run build
```
