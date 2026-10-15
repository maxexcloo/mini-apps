import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";

import { parse } from "yaml";

execFileSync("npm", ["run", "build"], { stdio: "inherit" });
await rm("runtime", { force: true, recursive: true });
await mkdir("runtime");
for (const file of (await readdir("dist")).sort()) {
  if (file.endsWith(".js") || file === "style.css")
    await copyFile(`dist/${file}`, `runtime/${file}`);
}

const configuration = parse(await readFile("kustomization.yaml", "utf8"));
const mounted = configuration.configMapGenerator.find(
  (generator) => generator.name === "actual-up-runtime",
).files;
assert.deepEqual(
  [...mounted].sort(),
  (await readdir("runtime")).map((file) => `runtime/${file}`).sort(),
  "Update the native runtime file list in kustomization.yaml when source modules change.",
);
