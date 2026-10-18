# Mini Apps

- Keep each app in `apps/<name>`: a single-page `index.html`, a small
  `server.mjs` only when needed, and native Kubernetes resources beside it. Avoid
  generators, build scripts, task wrappers and alternate packaging. Substantial
  services belong in their own repositories.
- Set the Namespace's `app.excloo.dev/name` label once and include
  `components/routes`; it derives `<name>.mini.excloo.com`. Mini apps use only
  this hostname; cluster app aliases belong to Kubelab. Select apps in
  `clusters/syd/kustomization.yaml`; Kubelab reconciles only `clusters/syd`.
- `clusters/syd` places every HelmRelease on `node.excloo.dev/network: external`
  nodes. A `local-path` PV is bound to the node that created it, so keep apps with
  storage on that external node and back up before changing placement.
- Choose a backend and datastore for the app's behaviour; existing Node.js/SQLite
  apps are examples, not a required stack. A backend such as PocketBase can
  replace custom auth, data APIs and file handling when that reduces the app's
  code and operational burden. Keep reusable recipes in the build skill.
- Web Awesome is the default UI: serve it locally and keep its default appearance.
  Allow native controls or another UI approach when requested or when they
  materially simplify the app; keep CSS focused on layout and operational
  feedback. The dependency-free static starter is an allowed exception.
- Private apps use the private gateway and shared wildcard DNS. Public apps use
  SYD's `public-direct` gateway, `websecuredirect` listener, public-access namespace
  and route labels, and unproxied ExternalDNS records. Review live route changes.
- Enable Homepage discovery in the `Mini Apps` group. Use the safe landing URL,
  derived from the owning route; never publish editing capabilities or list names.
  Probe a capability-free `/health` endpoint.
- Keep storage, secrets and network access isolated. Credentials stay server-side
  through ExternalSecrets that reference 1Password items by UUID. Flux postBuild
  substitution applies to ConfigMaps, so disable it on code ConfigMaps.
- Kubelab's `apps/overlays/syd/kustomization.yaml` substitutes shared variables
  into the `mini-apps` Kustomization: `REDLIB_URL` (Redlib's public origin, derived
  from its route) and `REDLIB_CHECK_URL` (its in-cluster service). Add shared
  variables there.
- Preserve deployed namespaces, release names, PVCs and old URLs during source
  cleanups. SQLite apps use one replica with `Recreate` and keep live data off
  NFS. Take a consistent backup before changing storage or data ownership.
- Reddit retains its existing SQLite format, SHA-256 keys and revisions; never
  discard unidentified saved lists. Mixed-case names fold into lowercase keys:
  opening or listing `Foo` merges its legacy record into `foo` (subreddit union,
  newer revision) and removes the old key.
- Traefik's JSON access logs record request paths, including Reddit's editing
  URLs. This is accepted while the app is private; revisit it before publishing
  any secret-link app.
- Open a PR and merge into `main`; Flux deploys it directly. Source changes must
  update hashed ConfigMap references or an immutable image. Run data tests
  directly with `node --test` and render affected Kustomizations with
  `kubectl kustomize`.
