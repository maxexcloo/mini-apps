# Mini Apps

## Applications

- Keep each app's source and native workload configuration in `apps/<name>`.
  Cluster selection belongs in `clusters/<cluster>`. Avoid a custom app schema,
  manifest generator or shared application runtime.
- Choose the simplest suitable stack. Use static files when no backend is needed.
  Add a backend or service such as PocketBase only when its features justify it.
- Isolate app storage, secrets and network access. Keep administration private.
- Preserve app-specific data formats and existing URLs during replacement.
- Derive service URLs from owning configuration. Kubelab supplies shared cluster
  integrations and externally owned settings through the Flux entry point.
- Disable Flux substitution on ConfigMaps containing code or assets.

## Delivery

- `main` holds source; CI advances `deploy` only after checks and smoke tests pass.
  Never force-push `deploy` or deploy unverified source from a developer machine.
- Flux watches `deploy`; code changes must affect the pod configuration through
  hashed ConfigMap names or a newly pinned immutable image.
- Keep app resources native and use the configured `bjw-s/app-template` chart.
- Run `mise run check` after changes, and `mise run smoke` after backend,
  container or persistence changes. Render changed Helm releases separately.
- Preserve existing PVCs and take a consistent backup before changing data
  ownership. Transfer Flux ownership without pruning persistent resources.
