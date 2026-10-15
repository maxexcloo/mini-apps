import { multiredditUrl, normaliseSubreddits } from "./subreddits.mjs";

await Promise.all(
  ["wa-button", "wa-input", "wa-card", "wa-badge"].map((name) =>
    customElements.whenDefined(name),
  ),
);
document.addEventListener("gesturestart", (event) => event.preventDefault(), {
  passive: false,
});

const $ = (selector) => document.querySelector(selector);
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let preferredTheme;
try {
  preferredTheme = localStorage.getItem("theme");
} catch {
  // The system theme still works when browser storage is unavailable.
}
function applyTheme() {
  const dark =
    preferredTheme === "dark" || (!preferredTheme && systemTheme.matches);
  document.documentElement.classList.toggle("wa-dark", dark);
  document.documentElement.classList.toggle("wa-light", !dark);
  $("#theme").textContent = dark ? "Light Mode" : "Dark Mode";
}
$("#theme").addEventListener("click", () => {
  preferredTheme = document.documentElement.classList.contains("wa-dark")
    ? "light"
    : "dark";
  try {
    localStorage.setItem("theme", preferredTheme);
  } catch {
    // Keep the selection for this page when browser storage is unavailable.
  }
  applyTheme();
});
systemTheme.addEventListener("change", applyTheme);
applyTheme();
const id = location.pathname.slice(1);
let subreddits = [];
let revision = 0;
let busy = true;
let redlibUrl;

function message(text) {
  $("#status").textContent = text;
}

function render() {
  const url = multiredditUrl(subreddits, redlibUrl);
  $("#feed").hidden = !url;
  $("#feed").href = url || "#";
  $("#feed").textContent = url || "";
  $("#empty-feed").hidden = Boolean(url);
  $("#copy-feed").disabled = !url;
  $("#add-button").disabled = busy;
  $("#count").textContent = String(subreddits.length);
  const filtered = subreddits.filter((name) =>
    name.includes(($("#filter").value || "").trim().toLowerCase()),
  );
  $("#empty-list").hidden = subreddits.length > 0;
  $("#communities").replaceChildren(
    ...filtered.map((name) => {
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.textContent = name;
      link.href = `${redlibUrl}/r/${name}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      const remove = document.createElement("wa-button");
      remove.textContent = "Remove";
      remove.appearance = "plain";
      remove.size = "small";
      remove.variant = "danger";
      remove.setAttribute("aria-label", `Remove r/${name}`);
      remove.disabled = busy;
      remove.addEventListener("click", () =>
        save(subreddits.filter((value) => value !== name)),
      );
      row.append(link, remove);
      return row;
    }),
  );
}

async function request(method, body) {
  const response = await fetch(`/api/lists/${encodeURIComponent(id)}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 409) {
      subreddits = result.subreddits;
      revision = result.revision;
    }
    throw new Error(result.error || "Unable to load your list.");
  }
  return result;
}

async function save(next) {
  if (busy) return;
  busy = true;
  message("");
  $("#save-state").textContent = "Saving…";
  render();
  let saved = false;
  try {
    const result = await request("PUT", { revision, subreddits: next });
    subreddits = result.subreddits;
    revision = result.revision;
    $("#save-state").textContent = "Saved.";
    saved = true;
  } catch (error) {
    message(error.message);
    $("#save-state").textContent = "Not saved. Try again.";
  } finally {
    busy = false;
    render();
  }
  return saved;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    message("Link copied.");
  } catch {
    message("Select and copy the link.");
  }
}

$("#list-name").addEventListener("input", () => {
  const input = $("#list-name");
  input.value = (input.value || "").trim();
  input.setCustomValidity("");
});
$("#open-list").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = ($("#list-name").value || "").trim();
  if (name === "health") {
    $("#list-name").setCustomValidity(
      "This name is reserved. Choose another list name.",
    );
    $("#list-name").reportValidity();
    return;
  }
  location.assign(`/${name}`);
});
$("#copy-editor").addEventListener("click", () => copy(location.href));
$("#copy-feed").addEventListener("click", () =>
  copy(multiredditUrl(subreddits, redlibUrl)),
);
$("#filter").addEventListener("input", render);
$("#add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  try {
    const additions = normaliseSubreddits($("#subreddits").value || "");
    if (!additions.length) throw new Error("Enter at least one subreddit.");
    const next = [...new Set([...subreddits, ...additions])].sort();
    if (next.length === subreddits.length) {
      message("Already in this list.");
      return;
    }
    if (await save(next)) $("#subreddits").value = "";
  } catch (error) {
    message(error.message);
  }
});

if (!id) {
  $("#welcome").hidden = false;
} else if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
  message(
    "Use a single path containing letters, numbers, underscores or hyphens.",
  );
} else {
  $("#list-title").textContent = id;
  $("#editor").hidden = false;
  render();
  try {
    const configuration = await fetch("/api/config");
    if (!configuration.ok)
      throw new Error("Unable to load the feed configuration.");
    redlibUrl = (await configuration.json()).redlibUrl;
    const result = await request("GET");
    subreddits = result.subreddits;
    revision = result.revision;
    busy = false;
    $("#save-state").textContent = revision
      ? "Saved."
      : "Add a subreddit to save this list.";
  } catch (error) {
    message(error.message);
    $("#save-state").textContent = "Reload to try again.";
  }
  render();
}
