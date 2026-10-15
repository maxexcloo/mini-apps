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
  Rename `mini-tool` consistently, use `<name>.mini.excloo.com` in `deploy.yaml`, and select
  the directory from `clusters/syd/kustomization.yaml`. Do not deploy the
  template as an example app.
- For a simple backend, prefer a standard runtime and app-scoped SQLite storage.
  Keep source, dependency lockfiles and meaningful checks beside the app.
  Services with substantial dependency and operational requirements belong in
  their own repositories with normal container deployment in Kubelab.
- App entry hostnames must be one lowercase DNS label under `mini.excloo.com`.
  CI checks routes, private DNS, Homepage links and OIDC URLs after Kustomize.
  Redlib's existing `redlib.excloo.com` is the only compatibility exception.
  Keep upstream API/feed hostnames unchanged; they are not mini-app entry points.
- Keep access, DNS, Homepage annotations, storage and secret references beside
  their owner in `deploy.yaml`. Deploy mini apps to SYD. Internal apps use the
  private gateway and the shared `*.mini.excloo.com` DNS record; do not add a
  per-app `PrivateDNSRecord`. Public apps use SYD's `public-direct` gateway,
  `websecuredirect` listener, namespace and route public-access labels, and
  `external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"`. ExternalDNS
  creates the explicit public DNS override from the route. Require explicit route
  approval; authentication is a separate app decision.
- Enable Homepage discovery in the `Mini Apps` group for every app. The dashboard
  discovers deployed apps automatically; do not maintain a second app list.
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
