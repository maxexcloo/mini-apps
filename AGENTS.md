# Mini Apps

## Applications

- Keep each app's source and native workload configuration in `apps/<name>`.
  Keep app resources together in `deploy.yaml`; use a native
  `kustomization.yaml` for composition and hashed asset ConfigMaps. Cluster selection belongs in `clusters/<cluster>`. Avoid a custom app schema,
  manifest generator or shared application runtime.
- Choose the simplest suitable stack. Use static files when no backend is needed.
  Add a backend or service such as PocketBase only when its features justify it.
- Isolate app storage, secrets and network access. Keep administration private.
- Preserve app-specific data formats and existing URLs during replacement.
- Derive service URLs from owning configuration. Kubelab supplies shared cluster
  integrations and externally owned settings through the Flux entry point.
- Disable Flux substitution on ConfigMaps containing code or assets.

## New Apps

- Copy `templates/static` for a browser-only app; keep the tool in `index.html`.
  Rename `mini-tool` consistently, set the hostname in `deploy.yaml`, and select
  the directory from the destination cluster's Kustomization. Do not deploy the
  template as an example app.
- For a backend, keep its source, dependency lockfile, build and checks in the app
  directory. Use hashed ConfigMaps with a matching pinned runtime when practical;
  otherwise build and publish an immutable image before updating its pin.
- Keep access, DNS, Homepage annotations, storage and secret references beside
  their owner in `deploy.yaml`. Internal apps use the private gateway and
  `PrivateDNSRecord`; public apps follow Kubelab's public-tunnel conventions and
  require explicit route approval. Authentication is a separate app decision.
- Set Homepage's public entry URL from the route hostname with native Kustomize
  replacements; never put a secret editing URL in annotations.
- AI repository access is sufficient for routine code and manifest changes after
  cluster integration. Read this file and the app's own instructions first.
  Credentials belong in the existing External Secrets integration, never source.

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
