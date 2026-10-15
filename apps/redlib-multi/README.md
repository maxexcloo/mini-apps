# Redlib Multi

A small app for managing combined subreddit feeds. Open the home page, choose a
**List Name** and select **Open List**. The editor opens directly at `/listname`;
existing names load their saved lists. Names are case-sensitive and accept 1–128
letters, numbers, underscores or hyphens. `health` is reserved.
The list picker remembers non-empty lists opened in this browser. Open a new name
from the home page or directly at `/listname`; a list is saved when entries are
added. Removing or moving its final entry deletes the saved list. Revision-only
metadata prevents stale editors from restoring deleted entries.

Add names, `r/` links or combined feed links. Names are lowercased, alphabetised
and deduplicated. Select individual entries or all visible entries after filtering
to remove, copy or move them to another named list. Destinations are merged without
duplicates; moves update both lists atomically. Each entry has a **Similar** link
to RedSim for related subreddits. Open or copy the combined feed
at the top of the editor. Anyone who can reach the app and knows a list name can
read and edit that list. No account or list directory is provided.

Use **Check All** to check every saved entry through Redlib, including entries
hidden by the filter. Results distinguish **Available**, **Banned**, **Private**,
**Restricted** and **Unknown**. **Unknown** means the status could not be confirmed;
failed requests and rate limits never establish a ban. **Stop Check** stops the
current pass. Checks never edit or remove entries. Results are cached for up to
15 minutes to limit upstream requests.

**Suggested Subreddits** merges related communities from every entry in the list,
excludes existing entries and ranks the top 20, with an **Add**
action. The browser downloads RedSim's public dataset and calculates suggestions
locally; list names and editing URLs are never sent. Suggestions exclude entries
already in the list. Editing continues to work if the dataset is unavailable.

## Development

Use Node.js 24.22 or newer. The UI uses Web Awesome, matching AI Control; the
server uses Node.js and SQLite without runtime dependencies.

```sh
npm ci
mise run check
mise run start
```

Open `http://127.0.0.1:3000`. Settings are `DATA_DIRECTORY` (default `./data`),
`HOST` (default `127.0.0.1`), `PORT` (default `3000`) and `REDLIB_URL` (default
`https://reddit.excloo.com`). The Redlib origin configures both individual and
combined feed links. `REDLIB_CHECK_URL` defaults to that origin and can point to
the same Redlib service's internal HTTP origin for status checks. `/health` is a
capability-free database readiness probe.

## Containers

```sh
docker compose up --build --detach
mise run smoke
```

Checks rebuild the bundled UI assets. Commit the generated files with UI changes;
CI verifies they match their sources. Third-party licences are served at
`/third-party-licences.txt`.

The container runs as UID/GID 1000 and stores data in `/data`. Compose publishes
port 3000 on localhost and keeps the database in its named volume. Do not delete
that volume when replacing the app. SQLite requires local persistent storage,
one replica and `Recreate` deployment strategy; do not use NFS.

The app lives in the shared `mini-apps` repository. Its native deployment mounts
checked-in source into a pinned Node runtime. Successful main checks advance the
`deploy` branch; Flux reconciles the code, configuration and private HTTPS route
from that exact revision. The deployment reuses the existing data volume. Kubelab
provides the cluster integration and derives `REDLIB_URL` from the Redlib route.

## Existing Lists & Recovery

Existing `/listname` and secret editing paths and the `/api/lists/<name>` API are
preserved. The app opens the same `lists.sqlite` database with its existing table,
SHA-256 list keys and revision numbers; no data conversion is needed. Concurrent
stale edits are rejected and the latest list is loaded for retry.

Back up with SQLite's online backup API, or stop the writer before copying the
whole data directory, including any WAL/SHM files. Restore while the app is
stopped and preserve UID/GID 1000 ownership. Image rollback does not reverse a
schema migration. Keep private list paths out of telemetry and reports.

## Licence

AGPL-3.0 — see [LICENSE](LICENSE).
