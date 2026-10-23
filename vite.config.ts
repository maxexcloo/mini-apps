import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Each built file lands in a ConfigMap, which Kubernetes caps at 1 MiB.
const sizeLimit = 900 * 1024;

/** Emit the licence of every bundled package and refuse files a ConfigMap cannot hold. */
function packaging(): Plugin {
  return {
    name: "minilab-packaging",
    apply: "build",
    async generateBundle(_options, bundle) {
      const packages = new Map<string, string>();
      for (const output of Object.values(bundle))
        if (output.type === "chunk")
          for (const id of output.moduleIds) {
            const match = /^(.*\/node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(id);
            if (match) packages.set(match[2]!, match[1]!);
          }
      const entries = [
        `MantineHub shadcn theme (ui/vendor/mantinehub)\n\n${await readFile("ui/vendor/mantinehub/LICENSE", "utf8")}`,
      ];
      for (const [name, path] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
        const metadata = JSON.parse(await readFile(`${path}/package.json`, "utf8"));
        let licence: string | undefined;
        for (const file of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md"]) {
          try {
            licence = await readFile(`${path}/${file}`, "utf8");
            break;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
        // A few packages declare their licence without shipping its text.
        if (!licence && typeof metadata.license === "string")
          licence = `${metadata.license} (declared in package.json; no licence file is published)`;
        if (!licence) this.error(`Missing licence for ${name}`);
        entries.push(`${name} ${metadata.version}\n\n${licence}`);
      }
      this.emitFile({
        type: "asset",
        fileName: "third-party-licences.txt",
        source: entries.join("\n\n"),
      });
      for (const output of Object.values(bundle)) {
        const size = Buffer.byteLength(output.type === "chunk" ? output.code : output.source);
        if (size > sizeLimit)
          this.error(
            `${output.fileName} is ${Math.ceil(size / 1024)} KiB; a ConfigMap holds 1 MiB`,
          );
      }
    },
  };
}

// Build one app with `vite build --config vite.config.ts apps/<name>/web`. Fixed file names keep
// each app's ConfigMap file lists stable, and fonts are inlined so the build is four files.
export default defineConfig({
  plugins: [react(), packaging()],
  resolve: { alias: { "@ui": resolve("ui") } },
  build: {
    assetsInlineLimit: () => true,
    chunkSizeWarningLimit: sizeLimit / 1024,
    emptyOutDir: true,
    outDir: "../dist",
    rolldownOptions: { output: { assetFileNames: "app[extname]", entryFileNames: "app.js" } },
  },
});
