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

Push reviewed changes to `main`. CI checks applications, renders cluster entry
points and runs container smoke tests before advancing the `deploy` branch to the
same commit. Flux watches that branch and automatically reconciles changes.

Kubelab owns the Flux source, cluster selection and shared platform integrations.
This repository owns the selected mini apps' native workloads, routes and app-scoped
integrations. Plain static or dependency-free apps can mount checked-in assets
through hashed ConfigMaps into pinned upstream runtimes. Apps needing custom
images keep their build beside their source and pin the published digest.

Network exposure and application authorisation are separate choices: internal or
external routing, with public, account-based or secret-link access as appropriate.
Use existing DNS, certificates, Pocket ID and secrets integrations. Existing live
route review requirements still apply. Inspect Flux status and verify the actual
application after deployment; successful CI alone does not prove live health.

## Add An App

Create `apps/<name>/` with its code, `deploy.yaml` and `kustomization.yaml`, then
add that directory to the chosen `clusters/<cluster>/kustomization.yaml`. Use the
[static starter](templates/static) for a single HTML file, or retain an
existing backend and its own dependencies. Static apps need no npm package or
Mise task. Optional app-level `.mise.toml` files supply meaningful checks and smoke
tests when needed.

Keep the hostname, private/public gateway, Homepage annotations, persistent storage
and secret references beside the app in `deploy.yaml`. Use native Kustomize
replacements to derive URLs from the hostname. Default to private access; a new
public route still requires review. Read secret values only inside consuming
processes through the existing credential integration.

Once cluster integration is installed, an AI connection with repository write or
PR access can author app changes and use the existing pipeline. It does not need
cluster credentials for routine deployments. The build skill supplies conventions;
GitHub access alone does not give an AI that context. Branch protection and CI
remain the deployment gates. Source and bundled assets here are public; stored app
data and credentials remain private.

## Licence

AGPL-3.0 — see [LICENSE](LICENSE).
