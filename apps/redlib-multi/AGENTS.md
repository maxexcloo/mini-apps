# Redlib Multi

## Compatibility

- Use lowercase list names and merge legacy case variants by union when names
  are supplied through saved browser history or existing URLs. Preserve old links
  and the `/api/lists/<name>` interface; never discard unidentified hashed records.
- Preserve `lists.sqlite`, its `lists` table and SHA-256 keys. Keep hashed aliases
  for migrated records and advance revisions to reject stale edits after merges.
- Keep the Redlib feed origin configurable through `REDLIB_URL`; Kubelab derives
  its production value from the Redlib service's owning route.
- Named lists are shared by anyone who can reach the app and knows the name.
  Do not introduce accounts or expose a directory of saved lists.
- Keep real list paths and contents out of logs, screenshots and reports.

## Delivery

- Bundle Web Awesome locally. Commit generated UI assets and third-party licences
  with their source changes; review generated asset changes before opening a PR.
- Use the shared `build-mini-app` workflow. This app owns its source and native
  workload manifests. Kubelab selects its cluster and provides shared integrations.
- Use local persistent storage for SQLite, one replica and `Recreate`.
- Run `mise run check` after code changes and `mise run smoke` for container or
  persistence changes. Test compatibility with the original database format.
