import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const miniHostname =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.mini\.excloo\.com$/;
// Preserve the existing editing links; this exception cannot cover another app.
const legacyHostname = "redlib.excloo.com";

export function checkHostnames(resources) {
  const errors = [];
  for (const resource of resources.filter(Boolean)) {
    const { kind, metadata = {}, spec = {} } = resource;
    const owner = `${kind}/${metadata.namespace || ""}/${metadata.name}`;
    const legacy =
      metadata.namespace === "redlib-multi" && metadata.name === "redlib-multi";
    function check(hostname, field) {
      if (
        typeof hostname !== "string" ||
        (!miniHostname.test(hostname) &&
          !(legacy && hostname === legacyHostname))
      )
        errors.push(
          `${owner} ${field}: use <name>.mini.excloo.com (got ${JSON.stringify(hostname)})`,
        );
    }
    function checkUrl(value, field) {
      if (value === undefined) return;
      try {
        check(new URL(value).hostname, field);
      } catch {
        errors.push(`${owner} ${field}: use an absolute app URL`);
      }
    }
    function route(value, field, requireHostnames = true) {
      if (value?.enabled === false) return;
      if (requireHostnames && !value?.hostnames?.length)
        errors.push(`${owner} ${field}: explicit app hostnames are required`);
      for (const hostname of value?.hostnames || [])
        check(hostname, `${field}.hostnames`);
      for (const key of ["gethomepage.dev/href", "gethomepage.dev/siteMonitor"])
        checkUrl(value?.annotations?.[key], `${field}.${key}`);
    }
    if (kind === "HelmRelease") {
      const routes = spec.values?.route || {};
      if (routes.apiVersion) route(routes, "route");
      else
        for (const [name, value] of Object.entries(routes))
          route(value, `route.${name}`);
    }
    if (kind === "HTTPRoute")
      route({ ...spec, annotations: metadata.annotations }, "spec");
    if (kind === "Ingress") {
      for (const rule of spec.rules || []) check(rule.host, "spec.rules.host");
      for (const tls of spec.tls || [])
        for (const hostname of tls.hosts || [])
          check(hostname, "spec.tls.hosts");
      route({ annotations: metadata.annotations }, "metadata", false);
    }
    if (kind === "PrivateDNSRecord") check(spec.hostname, "spec.hostname");
    if (kind === "PocketIDClient") {
      for (const url of spec.client?.callbackURLs || [])
        checkUrl(url, "spec.client.callbackURLs");
      checkUrl(spec.client?.launchURL, "spec.client.launchURL");
    }
  }
  return errors;
}

if (
  process.argv[1] &&
  pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url
) {
  for (const target of process.argv.slice(2)) {
    const manifests = execFileSync("kubectl", ["kustomize", resolve(target)], {
      encoding: "utf8",
    });
    const resources = JSON.parse(
      execFileSync("yq", ["eval-all", "--output-format=json", "[.]", "-"], {
        encoding: "utf8",
        input: manifests,
      }),
    );
    const errors = checkHostnames(resources);
    if (errors.length) {
      console.error(`${target}:\n${errors.join("\n")}`);
      process.exitCode = 1;
    }
  }
}
