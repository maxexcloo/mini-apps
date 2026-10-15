# Mini Apps

Small self-hosted tools, from browser-only utilities to apps with persistent data
and APIs. Describe the behaviour and audience with the shared `build-mini-app`
skill; choose a simple implementation and keep each app's data and access isolated.

## Development

Applications live in `apps/<name>`, with source and native deployment configuration
together. Each app keeps its native Kubernetes resources in `deploy.yaml`, using the shared
`bjw-s/app-template` Helm chart. A small `kustomization.yaml` includes that file and
any configuration or static assets. Each app owns its Mise checks and local usage
instructions. Cluster entry points select app directories through Kustomize.

```sh
mise run setup
mise run check
mise run smoke
mise --cd apps/redlib-multi run start
```

Install the declared tools with Mise. Shared tools such as Node and kubectl are
inherited from the global configuration. Container smoke tests need Docker and use
temporary volumes; they do not touch deployed app data.

## Publication

Open a PR, review the change and merge into `main`. Flux watches `main` and
reconciles merged changes automatically. There is no GitHub Actions pipeline,
image build or separate deployment branch for ordinary mini apps. Local tools
are available for development; the author handles relevant verification and
records the result in the PR.

Kubelab owns the Flux source, cluster selection and shared platform integrations.
This repository owns the selected mini apps' native workloads, routes and app-scoped
integrations. Plain static or dependency-free apps can mount checked-in assets
through hashed ConfigMaps into pinned upstream runtimes. Keep this repository
focused on small tools and simple backends, including apps with their own SQLite
storage. More involved services keep their own repositories, images and Kubelab
deployment; Actual Up is maintained separately.

Network exposure and application authorisation are separate choices: internal or
external routing, with public, account-based or secret-link access as appropriate.
Use existing DNS, certificates, Pocket ID and secrets integrations. Existing live
route review requirements still apply. Inspect Flux status and verify the actual
application after deployment; a merged PR alone does not prove live health.

## Add An App

Create `apps/<name>/` with its code, `deploy.yaml` and `kustomization.yaml`, then
add that directory to the chosen `clusters/<cluster>/kustomization.yaml`. Use the
[static starter](templates/static) for a single HTML file, or retain an
existing backend and its own dependencies. Static apps need no npm package or
Mise task. Optional app-level `.mise.toml` files supply meaningful checks and smoke
tests when needed.

Use `<name>.mini.excloo.com` for app hostnames, for example
`notes.mini.excloo.com`. The local check enforces one lowercase DNS label on app routes,
private DNS, Homepage links and OIDC URLs. Redlib's existing `redlib.excloo.com`
remains a compatibility exception for saved links. This naming rule does not
change whether an app is internal or external. Mini apps run on SYD. The shared
unproxied `*.mini.excloo.com` CNAME points to its private gateway, so private apps
need no individual DNS record.

| Access            | Gateway                                     | DNS                                                                             |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Private (default) | `private`, listener `websecure`             | Shared wildcard → `private.syd.excloo.dev`                                      |
| Public            | `public-direct`, listener `websecuredirect` | Explicit unproxied app record → `public.syd.excloo.dev`, managed by ExternalDNS |

For public apps, set `gateway.excloo.dev/public-access: "true"` on both the
namespace and route, and set route annotation
`external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"`. Keep the app's
`<name>.mini.excloo.com` hostname and Homepage metadata. The explicit public DNS
record overrides the private wildcard for that app. Private apps keep their
private-access namespace label and omit public-access route labels.

Both gateways serve the same `*.mini.excloo.com` Let's Encrypt certificate.
Public HTTPS connects directly to SYD and needs no Cloudflare edge certificate.
Verify wildcard certificate readiness before publication; `*.excloo.com` alone
does not cover these nested names. App authentication is independent of access.

Homepage discovers deployed apps from their enabled route annotations and lists
them in its **Mini Apps** group. The inventory refreshes every five minutes; no
separate list of app links needs maintaining.

Keep the hostname, private/public gateway, Homepage annotations, persistent storage
and secret references beside the app in `deploy.yaml`. Use native Kustomize
replacements to derive URLs from the hostname. Default to private access; a new
public route still requires review. Read secret values only inside consuming
processes through the existing credential integration.

Once cluster integration is installed, an AI connection with repository write or
PR access can author app changes and submit a PR. Merging publishes the change;
no cluster credentials are needed for routine deployments. The build skill and
repository instructions supply conventions. Source and bundled assets here are
public; stored app data and credentials remain private.

## Licence

AGPL-3.0 — see [LICENSE](LICENSE).
