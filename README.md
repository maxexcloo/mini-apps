# Minilab

Small self-hosted tools. Each app lives in `apps/<name>` and is published at
`https://<name>.mini.excloo.com`. Open a PR, review it and merge into `main`, and
Flux deploys the change to SYD. There's no GitHub Actions workflow or deployment
branch.

## Apps

[Redlib Multi](apps/redlib-multi) manages combined subreddit feeds. Each list has
its own editing URL and persistent SQLite data. Lists saved under the old
`reddit` hostname open at the same path on `redlib-multi`. Editing URLs are
secret links, and they show up in Kubelab's Traefik access logs. I accept that
because the app is private.

Edit `apps/redlib-multi/index.html` for the interface. `server.mjs` handles the
API and SQLite database, and `subreddits.mjs` has the shared parsing and
recommendation logic. Web Awesome is served locally from `vendor/` with its
third-party licences, and its version is in the `vendor/ui.mjs` banner. There's no
npm install or frontend build step.

To run it locally, use Node.js 26.12 or newer:

```sh
DATA_DIRECTORY=apps/redlib-multi/data HOST=127.0.0.1 PORT=3000 \
  REDLIB_CHECK_URL=https://your-redlib.example REDLIB_URL=https://your-redlib.example \
  node apps/redlib-multi/server.mjs
```

Every setting is required, and a missing or empty value stops startup. Set
`REDLIB_URL` to your Redlib origin, including its scheme and any port, and
`REDLIB_CHECK_URL` to the origin the server uses for status checks. Then open
`http://127.0.0.1:3000`. Local data stays in the app's ignored `data/` directory.
Deployed data stays on its existing volume, so never delete that volume when
replacing the app. Run the data tests with `node --test`.

With the [shared Mise configuration](https://github.com/maxexcloo/dotfiles#shared-tools--tasks)
installed, `mise run check` runs the data tests, renders the deployed apps and
static template with the project `kubectl`, and checks repository formatting and
configuration. It does not deploy anything.

## Add An App

For a browser-only tool, copy `templates/static` into `apps/<name>`. Rename its
Namespace, `app.excloo.dev/name` label, and the ConfigMap generator's name and
namespace together with `persistence.static.name`, edit its HTML and
native deployment resources, then select the app in
`clusters/syd/kustomization.yaml`. `components/app` derives the other Kubernetes
names from the Namespace. Only add a backend if the app needs one. Flux and the
shared cluster integrations live in Kubelab, while app source and resources stay
here.

| Access            | Gateway                                     | DNS                                                  |
| ----------------- | ------------------------------------------- | ---------------------------------------------------- |
| Private (default) | `private`, listener `websecure`             | Shared wildcard to SYD's private gateway             |
| Public            | `public-direct`, listener `websecuredirect` | Explicit unproxied app record managed by ExternalDNS |

Public routes need `gateway.excloo.dev/public-access: "true"` on their namespace
and route, plus `external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"`.
Both gateways use the wildcard certificate. Who can reach an app and how it
authenticates are separate choices. Keep credentials in the existing secret
integration.

`components/routes` lists each app in Homepage's **Minilab** group as
`Minilab: <App>` and links its safe landing page. Set the app's description, icon
and display name on its route, and the listing refreshes automatically. An AI
connection to the repository can submit PRs without cluster credentials; read
`AGENTS.md` before editing. The source is public, but stored app data and
credentials stay private.

## Update Web Awesome

The checked-in bundle doesn't need a build step at runtime. To regenerate it, run
the following from the repository root. Dependencies and the entrypoint stay in a
temporary directory. Add or remove component imports to match the page.

```sh
webawesome_version=3.14.0
vendor_work=$(mktemp -d)
npm install --no-package-lock --prefix "$vendor_work" "@awesome.me/webawesome@$webawesome_version" esbuild@0.28.2
cat > "$vendor_work/entry.mjs" <<'EOF'
import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/card/card.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
EOF
"$vendor_work/node_modules/.bin/esbuild" "$vendor_work/entry.mjs" \
  --banner:js="// Web Awesome $webawesome_version. See third-party-licences.txt for licences." \
  --bundle --format=esm --legal-comments=eof \
  --metafile="$vendor_work/bundle.json" --minify \
  --outfile=apps/redlib-multi/vendor/ui.mjs --target=es2022
```

This regenerates `ui.mjs` and `ui.css`. Review the dependency inputs in
`$vendor_work/bundle.json`, and when dependencies change, refresh
`vendor/third-party-licences.txt` from the included packages' licence files.
Before merging, run `node --test`, render `clusters/syd` and check the page in a
browser for component loading and Content Security Policy errors. Remove the
temporary directory when you're done.

## Licence

AGPL-3.0 — see [LICENSE](LICENSE).
