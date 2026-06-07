# OpenMeta Machine Skill

Use OpenMeta through machine-readable commands rather than scraping human CLI output.

## Required Workflow

1. Run `openmeta machine doctor` first.
2. If doctor reports missing configuration, use `openmeta machine config set` to update config values.
3. Use `openmeta machine provider add` and `openmeta machine provider use` to save and activate LLM backends.
4. Use `openmeta machine scout` for issue discovery.
5. Use `openmeta machine analyze` for repository-first contribution analysis.
6. Use `openmeta machine agent` only when the user explicitly asks for execution.
7. Parse JSON payloads instead of prose.
8. Surface artifact paths, validation failures, and PR links back to the user.
