import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAllDocuments } from "yaml";

const release = parseAllDocuments(readFileSync("deploy.yaml", "utf8"))
  .map((document) => document.toJSON())
  .find((resource) => resource.kind === "HelmRelease");
const { repository, tag } =
  release.spec.values.controllers["actual-up"].containers["actual-up"].image;
const run = (...args) =>
  execFileSync(
    "docker",
    [
      "run",
      "--cap-drop=ALL",
      "--network=none",
      "--platform=linux/amd64",
      "--read-only",
      "--rm",
      "--security-opt=no-new-privileges",
      "--tmpfs",
      "/tmp",
      "--volume",
      `${resolve("runtime")}:/app/dist:ro`,
      `${repository}:${tag}`,
      ...args,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

// The pinned image supplies dependencies; only compiled app assets are mounted.
const metadata = JSON.parse(
  run(
    "node",
    "--input-type=module",
    "-e",
    'import{readFileSync}from"node:fs";console.log(JSON.stringify(JSON.parse(readFileSync("/app/package.json","utf8")).dependencies))',
  ),
);
assert.deepEqual(
  metadata,
  JSON.parse(readFileSync("package.json", "utf8")).dependencies,
  "Dependency changes require a matching pinned runtime image.",
);
assert.match(run("node", "dist/cli.js", "--help"), /actual-up/);
run(
  "node",
  "--input-type=module",
  "-e",
  `
  import assert from "node:assert/strict";
  import { spawn } from "node:child_process";
  import { writeFileSync } from "node:fs";
  writeFileSync("/tmp/smoke.yaml", JSON.stringify({
    version: 1, settingsFile: "/tmp/settings.json",
    actual: { cacheDirectory: "/tmp/actual-cache", serverUrl: "https://actual.invalid" },
    mappings: [], schedule: { enabled: false },
    server: { host: "127.0.0.1", port: 3000 }, up: { connections: [] },
  }));
  const service = spawn("node", ["dist/cli.js", "--config", "/tmp/smoke.yaml", "serve"], {
    env: { ...process.env, ACTUAL_UP_USERNAME: "smoke", ACTUAL_UP_PASSWORD: "smoke-only",
      ACTUAL_UP_ENCRYPTION_KEY: "smoke-only-encryption-key-never-used-for-data" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const stopped = new Promise(resolve => service.once("exit", resolve));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch("http://127.0.0.1:3000/readyz")).ok) { ready = true; break; }
      } catch {}
      if (service.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Compiled app did not become ready");
    assert.equal((await fetch("http://127.0.0.1:3000/livez")).status, 200);
    const page = await fetch("http://127.0.0.1:3000/", { redirect: "manual" });
    assert.ok([302, 303, 401].includes(page.status), "App must require authentication");
    const login = await fetch("http://127.0.0.1:3000/login");
    assert.match(await login.text(), /Actual Up/);
    assert.equal((await fetch("http://127.0.0.1:3000/assets/style.css")).status, 200);
  } finally { service.kill("SIGTERM"); await stopped; }
`,
);
console.log(
  "Pinned runtime, compiled CLI, health and authentication passed with dummy settings and no network.",
);
