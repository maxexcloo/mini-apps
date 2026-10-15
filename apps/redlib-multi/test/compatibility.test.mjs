import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createApp } from "../server.mjs";
import { multiredditUrl } from "../static/subreddits.mjs";

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
