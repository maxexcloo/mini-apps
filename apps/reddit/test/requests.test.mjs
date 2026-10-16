import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../server.mjs";

test("rejects invalid JSON requests consistently while retaining endpoint limits and errors", async () => {
  const directory = mkdtempSync(join(tmpdir(), "reddit-requests-"));
  const server = createApp({
    dataDirectory: directory,
    redlibUrl: "https://feed.example",
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [path, method, limit, tooLarge, action] of [
      [
        "/api/normalise-lists",
        "POST",
        150000,
        "Too many list names.",
        "writes",
      ],
      ["/api/check", "POST", 1024, "Check one subreddit at a time.", "checks"],
      ["/api/lists/example", "PUT", 65536, "List is too large.", "writes"],
      [
        "/api/lists/example/transfer",
        "POST",
        65536,
        "List is too large.",
        "writes",
      ],
    ]) {
      for (const [body, headers, status, error] of [
        [
          "{}",
          { "Sec-Fetch-Site": "cross-site" },
          403,
          `Cross-site ${action} are not allowed.`,
        ],
        ["{}", { "Content-Type": "text/plain" }, 415, "Use application/json."],
        ["{", {}, 400, "Invalid JSON."],
        [JSON.stringify("a".repeat(limit)), {}, 413, tooLarge],
      ]) {
        const response = await fetch(base + path, {
          method,
          headers: { "Content-Type": "application/json", ...headers },
          body,
        });
        assert.equal(response.status, status, path);
        assert.deepEqual(await response.json(), { error }, path);
      }
      const response = await fetch(base + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: "null",
      });
      assert.equal(response.status, 400, path);
      assert.notEqual((await response.json()).error, "Invalid JSON.", path);
    }
    assert.deepEqual(await (await fetch(base + "/api/lists/example")).json(), {
      revision: 0,
      subreddits: [],
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { force: true, recursive: true });
  }
});
