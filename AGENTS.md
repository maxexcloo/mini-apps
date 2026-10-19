# Minilab

- Keep each app in `apps/<name>`: a single-page `index.html`, a small `server.mjs`
  only when needed, and native Kubernetes resources beside it: `deploy.yaml` holds
  the resources and `kustomization.yaml` mounts the assets. Static apps need no
  npm package, Docker build or app Mise task. Prefer standard upstream runtimes
  and minimal deployment config; avoid generators, build scripts, task wrappers
  and alternate packaging. Substantial services, such as Actual Up, belong in
  their own repositories.
- Name the Namespace after the retained deployment name and include
  `components/app`; it sets the shared app-template chart and derives the other
  resources' namespaces, the HelmRelease name, release name and `nameOverride`,
  and the NetworkPolicy name and pod selector. Generators run after components,
  so each `configMapGenerator` keeps its own `namespace`. Write `app` as the
  placeholder HelmRelease and NetworkPolicy name.
- Set the Namespace's `app.excloo.dev/name` label once and include
  `components/routes`; it owns the private gateway and mini app domain and
  derives `<name>.mini.excloo.com`. Mini apps use only this hostname; cluster app
  aliases belong to Kubelab. Select apps in `clusters/syd/kustomization.yaml`;
  Kubelab reconciles only `clusters/syd`.
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
  SYD's `public-direct` gateway, `websecuredirect` listener, public-access
  namespace and route labels, and unproxied ExternalDNS records. Review live route
  changes.
- `components/routes` enables Homepage discovery in the `Mini Apps` group,
  prefixes each route's `gethomepage.dev/name` to `Mini: <App>` and links the
  safe landing URL derived from the route; never publish editing capabilities or
  list names.
  Probe a capability-free `/health` endpoint.
- Keep storage, secrets and network access isolated. Credentials stay server-side
  through ExternalSecrets that reference 1Password items by title. Flux postBuild
  substitution applies to ConfigMaps, so disable it on code ConfigMaps to keep
  JavaScript template literals such as `${name}` intact.
- Kubelab's `apps/overlays/syd/mini-apps.yaml` sets the `mini-apps`
  Kustomization's shared substitution variables: `REDLIB_URL` (Redlib's public
  origin, replaced from its route in the overlay's `kustomization.yaml`) and
  `REDLIB_CHECK_URL` (its in-cluster service). Add shared variables there. Apps
  have no setting defaults or fallbacks: a missing or empty variable, which is
  how Flux leaves a missing substitution, must stop startup with its name. Derive
  setting values that duplicate a manifest field, such as a port, with an app
  replacement.
- Preserve deployed namespaces, release names, PVCs and old URLs during source
  cleanups. SQLite apps use one replica with `Recreate` and keep live data off
  NFS. Take a consistent backup before changing storage or data ownership.
- Redlib Multi keeps its secret-link model and retains its existing SQLite format,
  SHA-256 keys and revisions; never discard unidentified saved lists. Mixed-case
  names fold into lowercase keys: opening or listing `Foo` merges its legacy
  record into `foo` (subreddit union, newer revision) and removes the old key.
- Traefik's JSON access logs record request paths, including Redlib Multi's editing
  URLs. This is accepted while the app is private; revisit it before publishing
  any secret-link app.
- Open a PR and merge into `main`; Flux deploys it directly. Ordinary mini apps
  have no Actions workflow or separate deploy branch. A GitHub AI connection may
  submit PRs without Kubernetes credentials, but must respect PR review and the
  existing credential integration. Source changes must update hashed ConfigMap
  references or an immutable image. Run data tests directly with `node --test` and
  render affected Kustomizations with `kubectl kustomize`.
