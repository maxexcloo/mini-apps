import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { normaliseSubreddits } from "./subreddits.mjs";

export function subredditStatus(html, name) {
  const error = /<div id="error">\s*<h1>([^<]*)<\/h1>/.exec(html)?.[1]?.trim();
  if (error === `r/${name} has been banned from Reddit`) return "banned";
  if (error === `r/${name} is a private community`) return "private";
  if (new RegExp(`<h1>r/${name} is (?:quarantined|gated)</h1>`).test(html))
    return "restricted";
  if (!error && html.includes(`<p id="sub_name">r/${name}</p>`))
    return "available";
  return "unknown";
}

export function createApp({
  dataDirectory = process.env.DATA_DIRECTORY ||
    fileURLToPath(new URL("./data", import.meta.url)),
  redlibUrl = process.env.REDLIB_URL,
  checkUrl = process.env.REDLIB_CHECK_URL || redlibUrl,
  fetchStatus = fetch,
} = {}) {
  if (!redlibUrl) throw new Error("REDLIB_URL is required.");
  const origin = new URL(redlibUrl);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("REDLIB_URL must be an HTTP or HTTPS origin.");
  const checkOrigin = new URL(checkUrl);
  if (
    !["http:", "https:"].includes(checkOrigin.protocol) ||
    checkOrigin.username ||
    checkOrigin.password ||
    checkOrigin.pathname !== "/" ||
    checkOrigin.search ||
    checkOrigin.hash
  )
    throw new Error("REDLIB_CHECK_URL must be an HTTP or HTTPS origin.");
  const statusCache = new Map();
  let statusRequests = 0;
  mkdirSync(dataDirectory, { mode: 0o700, recursive: true });
  // Retain the original filename, schema and hashed keys for existing lists.
  const database = new DatabaseSync(resolve(dataDirectory, "lists.sqlite"));
  database.exec(
    "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, subreddits TEXT NOT NULL, revision INTEGER NOT NULL)",
  );
  const select = database.prepare(
    "SELECT subreddits, revision FROM lists WHERE id = ?",
  );
  // Keep only revision metadata for deleted lists, so stale editors cannot revive old data.
  database.exec(
    "CREATE TABLE IF NOT EXISTS deleted_lists (id TEXT PRIMARY KEY, revision INTEGER NOT NULL)",
  );
  database.exec(
    "CREATE TABLE IF NOT EXISTS list_aliases (id TEXT PRIMARY KEY, canonical_id TEXT NOT NULL)",
  );
  database.exec(
    "BEGIN IMMEDIATE; INSERT OR REPLACE INTO deleted_lists SELECT id, revision FROM lists WHERE subreddits = '[]'; DELETE FROM lists WHERE subreddits = '[]'; COMMIT",
  );
  function readList(key) {
    const row = select.get(key);
    return row
      ? { revision: row.revision, subreddits: JSON.parse(row.subreddits) }
      : {
          revision:
            database
              .prepare("SELECT revision FROM deleted_lists WHERE id = ?")
              .get(key)?.revision || 0,
          subreddits: [],
        };
  }
  function writeList(key, names, revision) {
    if (names.length) {
      database
        .prepare(
          "INSERT INTO lists (id, subreddits, revision) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET subreddits = excluded.subreddits, revision = excluded.revision",
        )
        .run(key, JSON.stringify(names), revision + 1);
      database.prepare("DELETE FROM deleted_lists WHERE id = ?").run(key);
    } else {
      database.prepare("DELETE FROM lists WHERE id = ?").run(key);
      database
        .prepare(
          "INSERT INTO deleted_lists (id, revision) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision",
        )
        .run(key, revision + 1);
    }
  }
  const listKey = (name) => createHash("sha256").update(name).digest("hex");
  function normaliseLists(names) {
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const name of names) {
        const oldKey = listKey(name);
        const key = listKey(name.toLowerCase());
        if (oldKey !== key) {
          const old = readList(oldKey);
          if (old.revision) {
            const current = readList(key);
            const merged = normaliseSubreddits(
              [...current.subreddits, ...old.subreddits].join(" "),
            );
            writeList(key, merged, Math.max(current.revision, old.revision));
            database.prepare("DELETE FROM lists WHERE id = ?").run(oldKey);
            database
              .prepare("DELETE FROM deleted_lists WHERE id = ?")
              .run(oldKey);
          }
        }
        database
          .prepare(
            "INSERT INTO list_aliases (id, canonical_id) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET canonical_id = excluded.canonical_id",
          )
          .run(oldKey, key);
        database
          .prepare(
            "INSERT OR IGNORE INTO list_aliases (id, canonical_id) VALUES (?, ?)",
          )
          .run(key, key);
      }
      database.exec("COMMIT");
    } finally {
      if (database.isTransaction) database.exec("ROLLBACK");
    }
    return [...new Set(names.map((name) => name.toLowerCase()))]
      .filter((name) => readList(listKey(name)).subreddits.length)
      .sort();
  }
  const assets = new Map(
    [
      ["/", ["index.html", "text/html; charset=utf-8"]],
      ["/vendor/ui.mjs", ["vendor/ui.mjs", "text/javascript; charset=utf-8"]],
      ["/vendor/ui.css", ["vendor/ui.css", "text/css; charset=utf-8"]],
      [
        "/third-party-licences.txt",
        ["vendor/third-party-licences.txt", "text/plain; charset=utf-8"],
      ],
      ["/subreddits.mjs", ["subreddits.mjs", "text/javascript; charset=utf-8"]],
    ].map(([path, [file, type]]) => [
      path,
      {
        content: readFileSync(new URL(file, import.meta.url)),
        type,
      },
    ]),
  );
  const html = assets.get("/").content.toString();
  const scriptHash = createHash("sha256")
    .update(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1])
    .digest("base64");
  const styleHash = createHash("sha256")
    .update(html.match(/<style>([\s\S]*?)<\/style>/)[1])
    .digest("base64");
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    // Web Awesome fetches its bundled checkbox SVGs from data URLs.
    response.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'sha256-${scriptHash}'; style-src 'self' 'sha256-${styleHash}'; connect-src 'self' data: https://anvaka.github.io/redsim/data/; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    );
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    const json = (status, value) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    try {
      const path = new URL(request.url, "http://localhost").pathname;
      if (path === "/health" && request.method === "GET") {
        database.prepare("SELECT 1").get();
        return json(200, { status: "ok" });
      }
      if (path === "/api/config" && request.method === "GET")
        return json(200, { redlibUrl: origin.origin });
      if (path === "/api/normalise-lists" && request.method === "POST") {
        if (request.headers["sec-fetch-site"] === "cross-site")
          return json(403, { error: "Cross-site writes are not allowed." });
        if (request.headers["content-type"] !== "application/json")
          return json(415, { error: "Use application/json." });
        let body = "";
        for await (const chunk of request) {
          body += chunk.toString("utf8");
          if (body.length > 150000)
            return json(413, { error: "Too many list names." });
        }
        let names;
        try {
          names = JSON.parse(body)?.names;
        } catch {
          return json(400, { error: "Invalid JSON." });
        }
        if (
          !Array.isArray(names) ||
          names.length > 1000 ||
          names.some(
            (name) =>
              typeof name !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(name),
          )
        )
          return json(400, { error: "Provide up to 1,000 valid list names." });
        return json(200, { names: normaliseLists(names) });
      }
      if (path === "/api/check" && request.method === "POST") {
        if (request.headers["sec-fetch-site"] === "cross-site")
          return json(403, { error: "Cross-site checks are not allowed." });
        if (request.headers["content-type"] !== "application/json")
          return json(415, { error: "Use application/json." });
        let body = "";
        for await (const chunk of request) {
          body += chunk.toString("utf8");
          if (body.length > 1024)
            return json(413, { error: "Check one subreddit at a time." });
        }
        let name;
        try {
          name = JSON.parse(body)?.subreddit;
        } catch {
          return json(400, { error: "Invalid JSON." });
        }
        if (typeof name !== "string" || !/^[a-z0-9_]{2,21}$/.test(name))
          return json(400, { error: "Provide a valid subreddit name." });
        const cached = statusCache.get(name);
        if (cached && cached.expires > Date.now())
          return json(200, { status: cached.status });
        if (statusRequests >= 2)
          return json(429, { error: "Checks are busy. Try again shortly." });
        statusRequests++;
        let status = "unknown";
        try {
          const upstream = await fetchStatus(
            `${checkOrigin.origin}/r/${name}?limit=1`,
            {
              headers: { "User-Agent": "Redlib-Multi/0.2.0" },
              redirect: "error",
              signal: AbortSignal.timeout(10000),
            },
          );
          if (upstream.status !== 429 && upstream.status < 500)
            status = subredditStatus(await upstream.text(), name);
        } catch {
          // A timeout, network block or upstream failure cannot establish a ban.
        } finally {
          statusRequests--;
        }
        if (statusCache.size >= 1000)
          statusCache.delete(statusCache.keys().next().value);
        statusCache.set(name, {
          status,
          expires: Date.now() + (status === "unknown" ? 60000 : 900000),
        });
        return json(200, { status });
      }
      const match = /^\/api\/lists\/([a-zA-Z0-9_-]{1,128})(\/transfer)?$/.exec(
        path,
      );
      if (match) {
        normaliseLists([match[1]]);
        const name = match[1].toLowerCase();
        const key = listKey(name);
        const current = () => readList(key);
        const transfer = Boolean(match[2]);
        if (!transfer && request.method === "GET") return json(200, current());
        if (request.method !== (transfer ? "POST" : "PUT"))
          return json(405, { error: "Method not allowed." });
        if (request.headers["sec-fetch-site"] === "cross-site")
          return json(403, { error: "Cross-site writes are not allowed." });
        if (request.headers["content-type"] !== "application/json")
          return json(415, { error: "Use application/json." });
        let length = 0;
        const chunks = [];
        for await (const chunk of request) {
          length += chunk.length;
          if (length > Math.max(65536, current().subreddits.length * 24 + 1024))
            return json(413, { error: "List is too large." });
          chunks.push(chunk);
        }
        let input;
        try {
          input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return json(400, { error: "Invalid JSON." });
        }
        if (
          !input ||
          !Number.isSafeInteger(input.revision) ||
          input.revision < 0 ||
          !Array.isArray(input.subreddits) ||
          input.subreddits.length >
            Math.max(1000, current().subreddits.length) ||
          input.subreddits.some((value) => typeof value !== "string")
        )
          return json(400, {
            error: "Provide a revision and up to 1,000 subreddit names.",
          });
        let names;
        try {
          names = normaliseSubreddits(input.subreddits.join(" "));
        } catch (error) {
          return json(400, { error: error.message });
        }
        if (names.length > Math.max(1000, current().subreddits.length))
          return json(400, { error: "Use up to 1,000 subreddits." });
        if (transfer) {
          const originalDestination =
            typeof input.destination === "string"
              ? input.destination.trim()
              : "";
          const destination = originalDestination.toLowerCase();
          if (
            !/^[a-zA-Z0-9_-]{1,128}$/.test(destination) ||
            destination === "health" ||
            destination === name
          )
            return json(400, {
              error: "Choose a different valid destination list name.",
            });
          if (!["copy", "move"].includes(input.action) || !names.length)
            return json(400, { error: "Select subreddits to copy or move." });
          normaliseLists([originalDestination]);
          database.exec("BEGIN IMMEDIATE");
          try {
            const source = current();
            if (source.revision !== input.revision)
              return json(409, {
                ...source,
                error:
                  "This list changed elsewhere. The latest list is loaded; select entries and try again.",
              });
            if (names.some((name) => !source.subreddits.includes(name)))
              return json(400, {
                error: "Select entries that belong to this list.",
              });
            const destinationKey = listKey(destination);
            const destinationList = readList(destinationKey);
            const existing = destinationList.subreddits;
            const combined = [...new Set([...existing, ...names])].sort();
            if (combined.length > 1000)
              return json(400, {
                error: "The destination would exceed 1,000 subreddits.",
              });
            if (combined.length !== existing.length)
              writeList(destinationKey, combined, destinationList.revision);
            if (input.action === "move") {
              const selected = new Set(names);
              writeList(
                key,
                source.subreddits.filter((name) => !selected.has(name)),
                source.revision,
              );
            }
            database.exec("COMMIT");
            return json(200, current());
          } finally {
            if (database.isTransaction) database.exec("ROLLBACK");
          }
        }
        database.exec("BEGIN IMMEDIATE");
        try {
          if (current().revision !== input.revision)
            return json(409, {
              ...current(),
              error:
                "This list changed elsewhere. The latest list is loaded; try your change again.",
            });
          writeList(key, names, input.revision);
          database.exec("COMMIT");
          return json(200, current());
        } finally {
          if (database.isTransaction) database.exec("ROLLBACK");
        }
      }
      if (path.startsWith("/api/"))
        return json(404, { error: "Unknown list path." });
      if (request.method !== "GET" && request.method !== "HEAD")
        return json(405, { error: "Method not allowed." });
      if (/^\/[a-zA-Z0-9_-]{1,128}$/.test(path) && !assets.has(path)) {
        normaliseLists([path.slice(1)]);
        if (path !== path.toLowerCase() && path.toLowerCase() !== "/health") {
          response.writeHead(308, {
            Location:
              path.toLowerCase() +
              new URL(request.url, "http://localhost").search,
          });
          return response.end();
        }
      }
      const asset =
        assets.get(path) ||
        (/^\/[a-zA-Z0-9_-]{1,128}$/.test(path) ? assets.get("/") : null);
      if (!asset) return json(404, { error: "Page not found." });
      response.writeHead(200, { "Content-Type": asset.type });
      response.end(request.method === "HEAD" ? undefined : asset.content);
    } catch {
      json(500, { error: "Unable to process this request." });
    }
  });
  server.on("close", () => database.close());
  return server;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.umask(0o077);
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = createApp();
  server.listen(port, host);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close());
}
