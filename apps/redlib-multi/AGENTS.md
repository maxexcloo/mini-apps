# Redlib Multi

## Compatibility

- Keep existing named editor paths, case-sensitive list identifiers and the
  `/api/lists/<name>` interface compatible.
- Preserve `lists.sqlite`, its `lists` table, SHA-256 list keys and revisions.
- Keep the Redlib feed origin configurable through `REDLIB_URL`; Kubelab derives
  its production value from the Redlib service's owning route.
- Named lists are shared by anyone who can reach the app and knows the name.
  Do not introduce accounts or expose a directory of saved lists.
- Keep real list paths and contents out of logs, screenshots and reports.

## Delivery

- Use the shared `build-mini-app` workflow. This app owns its source and native
  workload manifests. Kubelab selects its cluster and provides shared integrations.
- Use local persistent storage for SQLite, one replica and `Recreate`.
- Run `mise run check` after code changes and `mise run smoke` for container or
  persistence changes. Test compatibility with the original database format.
