import { multiredditUrl, normaliseSubreddits } from "./subreddits.mjs";

await Promise.all(
  ["wa-button", "wa-input", "wa-card", "wa-badge", "wa-checkbox"].map((name) =>
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
const selected = new Set();

function visibleSubreddits() {
  return subreddits.filter((name) =>
    name.includes(($("#filter").value || "").trim().toLowerCase()),
  );
}

function renderSelection() {
  const visible = visibleSubreddits();
  const count = visible.filter((name) => selected.has(name)).length;
  $("#select-visible").checked = visible.length > 0 && count === visible.length;
  $("#select-visible").indeterminate = count > 0 && count < visible.length;
  $("#select-visible").disabled = busy || !visible.length;
  $("#selection-count").textContent = `${selected.size} Selected`;
  $("#bulk-actions").hidden = !selected.size;
  $("#clear-selection").disabled = busy || !selected.size;
  for (const control of [
    "destination",
    "copy-selected",
    "move-selected",
    "remove-selected",
  ])
    $(`#${control}`).disabled = busy;
}

function message(text) {
  $("#status").textContent = text;
}

function hiddenLabel(text) {
  const label = document.createElement("span");
  label.className = "wa-visually-hidden";
  label.textContent = text;
  return label;
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
  for (const name of selected)
    if (!subreddits.includes(name)) selected.delete(name);
  const filtered = visibleSubreddits();
  renderSelection();
  $("#empty-list").hidden = subreddits.length > 0;
  $("#communities").replaceChildren(
    ...filtered.map((name) => {
      const row = document.createElement("li");
      const checkbox = document.createElement("wa-checkbox");
      checkbox.checked = selected.has(name);
      checkbox.disabled = busy;
      checkbox.append(hiddenLabel(`Select r/${name}`));
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(name);
        else selected.delete(name);
        renderSelection();
      });
      const link = document.createElement("a");
      link.textContent = name;
      link.href = `${redlibUrl}/r/${name}`;
      link.target = "_blank";
      link.rel = "noreferrer";
      const similar = document.createElement("wa-button");
      similar.textContent = "Similar";
      similar.appearance = "plain";
      similar.size = "small";
      similar.href = `https://anvaka.github.io/redsim/#!?q=${encodeURIComponent(name)}`;
      similar.target = "_blank";
      similar.rel = "noreferrer noopener";
      similar.append(hiddenLabel(` to r/${name}`));
      const remove = document.createElement("wa-button");
      remove.textContent = "Remove";
      remove.appearance = "plain";
      remove.size = "small";
      remove.variant = "danger";
      remove.append(hiddenLabel(` r/${name}`));
      remove.disabled = busy;
      remove.addEventListener("click", () =>
        save(subreddits.filter((value) => value !== name)),
      );
      row.append(checkbox, link, similar, remove);
      return row;
    }),
  );
}

async function request(method, body, suffix = "") {
  const response = await fetch(
    `/api/lists/${encodeURIComponent(id)}${suffix}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 409) {
      subreddits = result.subreddits;
      revision = result.revision;
      selected.clear();
    }
    throw new Error(result.error || "Unable to load your list.");
  }
  return result;
}

async function transfer(action) {
  if (busy || !selected.size) return;
  const destination = ($("#destination").value || "").trim();
  $("#destination").value = destination;
  if (
    !/^[a-zA-Z0-9_-]{1,128}$/.test(destination) ||
    destination === "health" ||
    destination === id
  ) {
    message("Choose a different valid destination list name.");
    $("#destination").focus();
    return;
  }
  busy = true;
  message("");
  $("#save-state").textContent = action === "move" ? "Moving…" : "Copying…";
  render();
  try {
    const result = await request(
      "POST",
      { action, destination, revision, subreddits: [...selected] },
      "/transfer",
    );
    subreddits = result.subreddits;
    revision = result.revision;
    selected.clear();
    $("#save-state").textContent = action === "move" ? "Moved." : "Copied.";
  } catch (error) {
    message(error.message);
    $("#save-state").textContent = "Transfer not completed. Try again.";
  } finally {
    busy = false;
    render();
  }
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
$("#select-visible").addEventListener("change", () => {
  for (const name of visibleSubreddits()) {
    if ($("#select-visible").checked) selected.add(name);
    else selected.delete(name);
  }
  render();
});
$("#clear-selection").addEventListener("click", () => {
  selected.clear();
  render();
});
$("#remove-selected").addEventListener("click", () => {
  if (selected.size) save(subreddits.filter((name) => !selected.has(name)));
});
$("#copy-selected").addEventListener("click", () => transfer("copy"));
$("#move-selected").addEventListener("click", () => transfer("move"));
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
