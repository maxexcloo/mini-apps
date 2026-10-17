# Mini Apps

- Keep each app in `apps/<name>`. Set its Namespace's `app.excloo.dev/name` label
  once; the shared routes component derives `<name>.mini.excloo.com`. Mini apps
  use only this hostname; cluster app aliases belong to Kubelab.
  Deploy mini apps to SYD through `clusters/syd/kustomization.yaml`.
- Prefer a single HTML page. Add a small backend only when needed. Keep native
  Kubernetes resources beside the app; avoid generators, build scripts and
  alternate packaging. Substantial services belong in their own repositories.
- Choose a backend and datastore for the app's behaviour; existing Node.js/SQLite
  apps are examples, not a required stack. A backend such as PocketBase
  can replace custom auth, data APIs and file handling when that reduces the
  app's code and operational burden. Keep reusable recipes in the build skill.
- Prefer locally served Web Awesome components and their default appearance,
  matching AI Control. Allow native controls or another UI approach when requested
  or when they materially simplify the app; keep CSS focused on layout and
  operational feedback. The dependency-free static starter is an allowed exception.
- Private apps use the private gateway and shared wildcard DNS. Public apps use
  SYD's `public-direct` gateway, `websecuredirect` listener, public-access namespace
  and route labels, and unproxied ExternalDNS records. Review live route changes.
- Enable Homepage discovery in the `Mini Apps` group. Use the safe landing URL,
  derived from the owning route; never publish editing capabilities or list names.
- Keep storage, secrets and network access isolated. Credentials stay server-side
  through External Secrets. Disable Flux substitution on code ConfigMaps.
- Preserve deployed namespaces, release names, PVCs and old URLs during source
  cleanups. Reddit retains its existing SQLite format, SHA-256 keys, aliases and
  revisions; never discard unidentified saved lists. Take a consistent backup
  before changing storage or data ownership. Keep live SQLite off NFS and use one
  replica with `Recreate`.
- Open a PR, review the change and merge into `main`; Flux deploys it directly.
  Source changes must update hashed ConfigMap references or an immutable image.
  Run relevant local checks when possible and verify the deployed behaviour.
- Keep meaningful data tests, run directly with `node --test`. Render affected
  Kustomizations with `kubectl kustomize`; avoid task wrappers and build scaffolding.
