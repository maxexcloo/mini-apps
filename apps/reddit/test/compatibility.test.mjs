import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createApp } from "../server.mjs";
import { multiredditUrl } from "../subreddits.mjs";

test("opens an original database and merges its mixed-case identity into the lowercase list", async () => {
  const directory = mkdtempSync(join(tmpdir(), "redlib-compatibility-"));
  const database = new DatabaseSync(join(directory, "lists.sqlite"));
  database.exec(
    "CREATE TABLE lists (id TEXT PRIMARY KEY, subreddits TEXT NOT NULL, revision INTEGER NOT NULL)",
  );
  const id = "Fixture-Existing_List";
  database
    .prepare("INSERT INTO lists VALUES (?, ?, ?)")
    .run(
      createHash("sha256").update(id).digest("hex"),
      JSON.stringify(["australia", "sydney"]),
      7,
    );
  database.close();
  const server = createApp({
    dataDirectory: directory,
    redlibUrl: "https://feed.example",
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const first = await (await fetch(`${base}/api/lists/${id}`)).json();
    assert.deepEqual(first, {
      subreddits: ["australia", "sydney"],
      revision: 8,
    });
    assert.equal((await fetch(`${base}/${id}`)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/config`)).json(), {
      redlibUrl: "https://feed.example",
    });
    assert.equal(
      multiredditUrl(first.subreddits, "https://feed.example"),
      "https://feed.example/r/australia+sydney",
    );
    assert.deepEqual(
      await (await fetch(`${base}/api/lists/fixture-existing_list`)).json(),
      { subreddits: ["australia", "sydney"], revision: 8 },
    );
    const update = await fetch(`${base}/api/lists/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subreddits: ["melbourne"], revision: 8 }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), {
      subreddits: ["melbourne"],
      revision: 9,
    });
    const home = await (await fetch(base)).text();
    assert.match(home, /List Name/);
    assert.match(home, /Open List/);
    assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
    assert.equal((await fetch(`${base}/lists.sqlite`)).status, 404);
    assert.equal((await fetch(`${base}/invalid/list`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { force: true, recursive: true });
  }
});

test("starts normally through a Kubernetes-style source symlink", async () => {
  const directory = mkdtempSync(join(tmpdir(), "reddit-source-"));
  const entry = join(directory, "server.mjs");
  symlinkSync(fileURLToPath(new URL("../server.mjs", import.meta.url)), entry);
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      DATA_DIRECTORY: join(directory, "data"),
      HOST: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "ignore",
  });
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 30 && child.exitCode === null; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(300),
        });
        healthy = response.ok;
        if (healthy) break;
      } catch {}
      await setTimeout(100);
    }
    assert.ok(
      healthy,
      `Symlinked server did not start (exit ${child.exitCode}).`,
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, "exit");
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
