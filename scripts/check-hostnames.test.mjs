import assert from "node:assert/strict";
import { test } from "node:test";
import { checkHostnames } from "./check-hostnames.mjs";

const release = (hostnames, namespace = "tool", annotations = {}) => ({
  kind: "HelmRelease",
  metadata: { name: namespace, namespace },
  spec: { values: { route: { private: { hostnames, annotations } } } },
});

test("accepts single-label mini app names and ignores unrelated backend/API origins", () => {
  const app = release([
    "notes.mini.excloo.com",
    "a.mini.excloo.com",
    "my-tool.mini.excloo.com",
  ]);
  app.spec.values.controllers = {
    app: { containers: { app: { env: { API_URL: "https://example.net" } } } },
  };
  assert.deepEqual(checkHostnames([app]), []);
});

test("rejects other domains, bare domains, nested labels, wildcard routes and invalid DNS labels", () => {
  for (const hostname of [
    "tool.excloo.com",
    "mini.excloo.com",
    "nested.tool.mini.excloo.com",
    "*.mini.excloo.com",
    "Tool.mini.excloo.com",
    "-tool.mini.excloo.com",
    "tool-.mini.excloo.com",
    "tool_name.mini.excloo.com",
    `${"a".repeat(64)}.mini.excloo.com`,
  ])
    assert.equal(checkHostnames([release([hostname])]).length, 1, hostname);
});

test("limits legacy compatibility to Redlib's existing resource identity and hostname", () => {
  assert.deepEqual(
    checkHostnames([release(["redlib.excloo.com"], "redlib-multi")]),
    [],
  );
  assert.equal(checkHostnames([release(["redlib.excloo.com"])]).length, 1);
  assert.equal(
    checkHostnames([release(["other.excloo.com"], "redlib-multi")]).length,
    1,
  );
});

test("checks native routes, DNS records, ingress, auth callbacks and Homepage links", () => {
  const resources = [
    { kind: "HTTPRoute", spec: { hostnames: ["bad.example.net"] } },
    { kind: "PrivateDNSRecord", spec: { hostname: "bad.example.net" } },
    {
      kind: "Ingress",
      spec: {
        rules: [{ host: "bad.example.net" }],
        tls: [{ hosts: ["bad.example.net"] }],
      },
    },
    {
      kind: "PocketIDClient",
      spec: {
        client: {
          callbackURLs: ["https://bad.example.net/callback"],
          launchURL: "https://bad.example.net",
        },
      },
    },
    release(["tool.mini.excloo.com"], "tool", {
      "gethomepage.dev/href": "https://bad.example.net",
    }),
    release(["tool.mini.excloo.com"], "tool", {
      "gethomepage.dev/siteMonitor": "/health",
    }),
  ];
  assert.equal(checkHostnames(resources).length, 8);
  assert.deepEqual(
    checkHostnames([
      { kind: "PrivateDNSRecord", spec: { hostname: "notes.mini.excloo.com" } },
    ]),
    [],
  );
});

test("rejects hostless routes that could expose apps under arbitrary names", () => {
  assert.equal(
    checkHostnames([
      { kind: "HTTPRoute", metadata: { name: "catch-all" }, spec: {} },
    ]).length,
    1,
  );
});
