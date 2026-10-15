import { multiredditUrl, normaliseSubreddits } from "./subreddits.mjs";
import { relatedSubreddits } from "./recommendations.mjs";

await Promise.all(
  [
    "wa-button",
    "wa-input",
    "wa-card",
    "wa-badge",
    "wa-checkbox",
    "wa-select",
    "wa-option",
  ].map((name) => customElements.whenDefined(name)),
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
let recommendations;
let recommendationsLoading = false;
let recommendationsError = false;
let recommendationKey;
let suggestedNames = [];

async function loadRecommendations() {
  recommendationsLoading = true;
  recommendationsError = false;
  renderSuggestions();
  try {
    const options = {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(20000),
    };
    const [labels, links] = await Promise.all(
      ["labels.json", "links.bin"].map(async (file) => {
        const response = await fetch(
          `https://anvaka.github.io/redsim/data/${file}`,
          options,
        );
        if (!response.ok) throw new Error("Suggestions unavailable.");
        return file.endsWith("json") ? response.json() : response.arrayBuffer();
      }),
    );
    recommendations = { labels, links: new Int32Array(links) };
    recommendationKey = undefined;
  } catch {
    recommendationsError = true;
  } finally {
    recommendationsLoading = false;
    renderSuggestions();
  }
}

function renderSuggestions() {
  $("#suggestions").hidden = !subreddits.length;
  if (!subreddits.length) return;
  if (!recommendations && !recommendationsLoading && !recommendationsError) {
    loadRecommendations();
    return;
  }
  const key = subreddits.join("+");
  if (recommendations && key !== recommendationKey) {
    suggestedNames = relatedSubreddits(
      recommendations.labels,
      recommendations.links,
      subreddits,
    );
    recommendationKey = key;
  }
  $("#suggestions-state").textContent = recommendationsLoading
    ? "Finding related communities…"
    : recommendationsError
      ? "Suggestions are unavailable. Your list still works."
      : suggestedNames.length
        ? ""
        : "No related communities found.";
  $("#retry-suggestions").hidden = !recommendationsError;
  const suggestions = $("#suggested-communities");
  for (const row of [...suggestions.children]) {
    if (!suggestedNames.includes(row.dataset.name)) row.remove();
  }
  suggestedNames.forEach((name, index) => {
    let row = [...suggestions.children].find(
      (row) => row.dataset.name === name,
    );
    if (row) {
      row.querySelector("wa-button").disabled = busy;
    } else {
      row = document.createElement("li");
      row.dataset.name = name;
      const link = document.createElement("a");
      link.href = `${redlibUrl}/r/${name}`;
      link.textContent = name;
      link.target = "_blank";
      link.rel = "noreferrer";
      const add = document.createElement("wa-button");
      add.textContent = "Add";
      add.append(hiddenLabel(` r/${name}`));
      add.size = "small";
      add.disabled = busy;
      add.addEventListener("click", () =>
        save([...new Set([...subreddits, name])].sort(), {
          suggestionIndex: [...suggestions.children].indexOf(row),
        }),
      );
      row.append(link, add);
    }
    if (suggestions.children[index] !== row)
      suggestions.insertBefore(row, suggestions.children[index] || null);
  });
}
$("#retry-suggestions").addEventListener("click", loadRecommendations);
let knownLists = [];
try {
  const saved = JSON.parse(localStorage.getItem("lists") || "[]");
  if (Array.isArray(saved))
    knownLists = [
      ...new Set(
        saved.filter(
          (name) =>
            typeof name === "string" &&
            /^[a-zA-Z0-9_-]{1,128}$/.test(name) &&
            name !== "health",
        ),
      ),
    ];
} catch {
  // Saved lists still work by URL when browser storage is unavailable.
}
function rememberList(name, populated) {
  knownLists = knownLists.filter((value) => value !== name);
  if (populated) knownLists.push(name);
  knownLists.sort();
  try {
    localStorage.setItem("lists", JSON.stringify(knownLists));
  } catch {}
  renderLists();
}
function renderLists() {
  for (const selector of ["#list-picker", "#destination-picker"]) {
    const picker = $(selector);
    const names = knownLists.filter(
      (name) => selector !== "#destination-picker" || name !== id,
    );
    picker.hidden = !names.length;
    picker.replaceChildren(
      ...names.map((name) => {
        const option = document.createElement("wa-option");
        option.value = name;
        option.textContent = name;
        return option;
      }),
    );
  }
}
$("#list-picker").addEventListener("change", () => {
  if ($("#list-picker").value) location.assign(`/${$("#list-picker").value}`);
});
$("#destination-picker").addEventListener("change", () => {
  $("#destination").value = $("#destination-picker").value || "";
});
renderLists();
// Check only names this browser already knows; never enumerate other users' lists.
await Promise.all(
  knownLists.map(async (name) => {
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(name)}`);
      if (response.ok && !(await response.json()).subreddits.length)
        rememberList(name, false);
    } catch {}
  }),
);

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
    "destination-picker",
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
  renderSuggestions();
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
    rememberList(destination, true);
    rememberList(id, subreddits.length > 0);
    $("#save-state").textContent = action === "move" ? "Moved." : "Copied.";
  } catch (error) {
    message(error.message);
    $("#save-state").textContent = "Transfer not completed. Try again.";
  } finally {
    busy = false;
    render();
  }
}

async function save(next, { suggestionIndex } = {}) {
  if (busy) return;
  const suggestionsTop =
    suggestionIndex === undefined
      ? undefined
      : $("#suggestions").getBoundingClientRect().top;
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
    rememberList(id, subreddits.length > 0);
    saved = true;
  } catch (error) {
    message(error.message);
    $("#save-state").textContent = "Not saved. Try again.";
  } finally {
    busy = false;
    render();
    if (suggestionsTop !== undefined) {
      await Promise.all(
        [...$("#editor").querySelectorAll("wa-button, wa-checkbox")].map(
          (control) => control.updateComplete,
        ),
      );
      // The saved list grows above suggestions; keep the same place in the viewport.
      const buttons = $("#suggested-communities").querySelectorAll("wa-button");
      buttons[Math.min(suggestionIndex, buttons.length - 1)]?.focus({
        preventScroll: true,
      });
      window.scrollBy({
        top: $("#suggestions").getBoundingClientRect().top - suggestionsTop,
        behavior: "instant",
      });
    }
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
    rememberList(id, subreddits.length > 0);
    $("#save-state").textContent = revision
      ? "Saved."
      : "Add a subreddit to save this list.";
  } catch (error) {
    message(error.message);
    $("#save-state").textContent = "Reload to try again.";
  }
  render();
}
