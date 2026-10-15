import assert from "node:assert/strict";
import { test } from "node:test";
import { relatedSubreddits } from "../static/recommendations.mjs";

test("ranks related communities, merges duplicate recommendations and excludes existing or invalid names", () => {
  const labels = ["Australia", "sydney", "perth", "melbourne", "bad/name"];
  const links = Int32Array.from([
    -1,
    (3 << 8) | 1,
    (4 << 8) | 2,
    5 << 8,
    -2,
    (3 << 8) | 1,
    -4,
    1 << 8,
  ]);
  assert.deepEqual(relatedSubreddits(labels, links, ["australia", "sydney"]), [
    "melbourne",
    "perth",
  ]);
  assert.deepEqual(
    relatedSubreddits(labels, links, ["australia", "sydney"], 1),
    ["melbourne"],
  );
  assert.deepEqual(relatedSubreddits(labels, links, ["unknown"]), []);
});
