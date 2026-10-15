# Mini Apps

Small self-hosted tools. Each app lives in `apps/<name>` and is published at
`https://<name>.mini.excloo.com`. Open a PR, review it and merge into `main`;
Flux deploys the change to SYD. No GitHub Actions or deployment branch is needed.

## Apps

[Reddit](apps/reddit) manages combined subreddit feeds. Each list has its own
editing URL and persistent SQLite data. Existing private links remain supported.

Edit `apps/reddit/index.html` for the interface. `server.mjs` handles its API and
SQLite database; `subreddits.mjs` contains shared parsing and recommendation
logic. Web Awesome 3.14.0 is served locally from `vendor/`, with third-party
licences included. There is no npm install or frontend build step.

To run it locally, use Node.js 24.22 or newer:

```sh
node apps/reddit/server.mjs
```

Open `http://127.0.0.1:3000`. Local data stays in the app's ignored `data/`
directory. Deployed data stays on its existing volume. Never delete that volume
when replacing the app. Optional development checks run with `mise run check`.

## Add An App

Copy `templates/static` into `apps/<name>` for a browser-only tool. Edit its HTML
and native deployment resources, then select the app in
`clusters/syd/kustomization.yaml`. Add a backend only when needed. Kubelab owns
Flux and the shared cluster integrations; app source and resources stay here.

| Access            | Gateway                                     | DNS                                                  |
| ----------------- | ------------------------------------------- | ---------------------------------------------------- |
| Private (default) | `private`, listener `websecure`             | Shared wildcard to SYD's private gateway             |
| Public            | `public-direct`, listener `websecuredirect` | Explicit unproxied app record managed by ExternalDNS |

Public routes need `gateway.excloo.dev/public-access: "true"` on their namespace
and route and `external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"`.
Both gateways use the wildcard certificate. Reachability and app authentication
are separate choices. Keep credentials in the existing secret integration.

Enable route annotations for Homepage's **Mini Apps** group and link the safe
landing page. Its app listing refreshes automatically. A repository AI connection
can submit PRs without cluster credentials; read `AGENTS.md` before editing.
Source is public; stored app data and credentials remain private.

## Licence

AGPL-3.0 — see [LICENSE](LICENSE).
