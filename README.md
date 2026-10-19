# Minilab

Small self-hosted tools. Each app lives in `apps/<name>` and is published at
`https://<name>.mini.excloo.com`. Open a PR, review it and merge into `main`;
Flux deploys the change to SYD. No GitHub Actions or deployment branch is needed.

## Apps

[Redlib Multi](apps/redlib-multi) manages combined subreddit feeds. Each list has
its own editing URL and persistent SQLite data. Lists saved under the former
`reddit` hostname open at the same path on `redlib-multi`. Editing URLs are
secret links that appear in Kubelab's Traefik access logs; this is an accepted
risk because the app is private.

Edit `apps/redlib-multi/index.html` for the interface. `server.mjs` handles its API and
SQLite database; `subreddits.mjs` contains shared parsing and recommendation
logic. Web Awesome 3.14.0 is served locally from `vendor/`, with third-party
licences included. There is no npm install or frontend build step.

To run it locally, use Node.js 26.12 or newer:

```sh
REDLIB_URL=https://your-redlib.example node apps/redlib-multi/server.mjs
```

Set `REDLIB_URL` to your Redlib origin, including its scheme and any port.
`REDLIB_CHECK_URL`, `DATA_DIRECTORY`, `HOST` and `PORT` are optional locally;
an empty value is rejected.
Open `http://127.0.0.1:3000`. Local data stays in the app's ignored `data/`
directory. Deployed data stays on its existing volume. Never delete that volume
when replacing the app. Run the data tests with `node --test`.

## Add An App

Copy `templates/static` into `apps/<name>` for a browser-only tool. Rename its
Namespace, `app.excloo.dev/name` label and ConfigMap generator, edit its HTML
and native deployment resources, then select the app in
`clusters/syd/kustomization.yaml`. `components/app` derives the remaining
Kubernetes names from the Namespace. Add a backend only when needed. Kubelab owns
Flux and the shared cluster integrations; app source and resources stay here.

| Access            | Gateway                                     | DNS                                                  |
| ----------------- | ------------------------------------------- | ---------------------------------------------------- |
| Private (default) | `private`, listener `websecure`             | Shared wildcard to SYD's private gateway             |
| Public            | `public-direct`, listener `websecuredirect` | Explicit unproxied app record managed by ExternalDNS |

Public routes need `gateway.excloo.dev/public-access: "true"` on their namespace
and route and `external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"`.
Both gateways use the wildcard certificate. Reachability and app authentication
are separate choices. Keep credentials in the existing secret integration.

`components/routes` lists each app in Homepage's **Mini Apps** group as
`Mini: <App>` and links the safe landing page; set the app's description, icon
and display name on its route. Its app listing refreshes
automatically. A repository AI connection can submit PRs without cluster
credentials; read `AGENTS.md` before editing.
Source is public; stored app data and credentials remain private.

## Update Web Awesome

The checked-in bundle needs no build step at runtime. To regenerate it, run the
following from the repository root; dependencies and the entrypoint stay in a
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
import "@awesome.me/webawesome/dist/components/select/select.js";
EOF
"$vendor_work/node_modules/.bin/esbuild" "$vendor_work/entry.mjs" \
  --banner:js="// Web Awesome $webawesome_version. See third-party-licences.txt for licences." \
  --bundle --format=esm --legal-comments=eof \
  --metafile="$vendor_work/bundle.json" --minify \
  --outfile=apps/redlib-multi/vendor/ui.mjs --target=es2022
```

This regenerates `ui.mjs` and `ui.css`. Review the dependency inputs in
`$vendor_work/bundle.json` and refresh `vendor/third-party-licences.txt` from the
included packages' licence files when dependencies change. Keep
`webawesome_version` in sync with the version under Apps. Run `node --test`,
render `clusters/syd`, and check the page in a browser for component loading and Content Security Policy errors before
merging. Remove the temporary directory when finished.

## Licence

AGPL-3.0 — see [LICENSE](LICENSE).
