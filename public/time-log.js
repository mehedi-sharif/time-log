const storageKey = "time-log.entries";
const legacyStorageKey = "energy-log.entries";

const activityColors = ["#1f7a6b", "#d85f49", "#517fb8", "#529d65", "#7d679f", "#b88724"];

const todayIso = toLocalIsoDate(new Date());
const sampleEntries = [
  {
    id: makeId(),
    activity: "Planning the week",
    date: todayIso,
    minutes: 45,
    notes: "Organized tasks and cleared loose ends.",
  },
  {
    id: makeId(),
    activity: "Deep work sprint",
    date: todayIso,
    minutes: 110,
    notes: "Good concentration after lunch.",
  },
  {
    id: makeId(),
    activity: "Walk and reset",
    date: todayIso,
    minutes: 35,
    notes: "",
  },
  {
    id: makeId(),
    activity: "Reading notes",
    date: offsetDate(-2),
    minutes: 70,
    notes: "Collected ideas for later.",
  },
  {
    id: makeId(),
    activity: "Family check-in",
    date: offsetDate(-3),
    minutes: 55,
    notes: "",
  },
];

const state = {
  view: "log",
  range: "today",
  entries: [],
  databaseEnabled: false,
};

const form = document.querySelector("#entry-form");
const minutesInput = document.querySelector("#minutes");
const chart = document.querySelector("#chart");
const entriesList = document.querySelector("#entries");
const template = document.querySelector("#entry-template");

document.querySelectorAll("[data-minutes]").forEach((button) => {
  button.addEventListener("click", () => {
    minutesInput.value = button.dataset.minutes;
    syncQuickTimeButtons();
  });
});

minutesInput.addEventListener("input", () => {
  syncQuickTimeButtons();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmit(new FormData(form));
});

async function handleSubmit(data) {
  const entry = {
    id: makeId(),
    activity: data.get("activity").trim(),
    date: toLocalIsoDate(new Date()),
    minutes: Number(data.get("minutes")),
    notes: data.get("notes").trim(),
  };

  const savedEntry = await createEntry(entry);
  state.entries.unshift(savedEntry);
  saveEntries();
  form.reset();
  minutesInput.value = 30;
  syncQuickTimeButtons();
  flashSaved();
  render();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === state.view);
    });
  });
});

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", () => {
    state.range = button.dataset.range;
    document.querySelectorAll("[data-range]").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.range === state.range);
    });
    render();
  });
});

entriesList.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;

  deleteEntry(button.dataset.id);
});

init();

async function init() {
  state.entries = await loadEntries();
  updateSaveStatus();
  render();
}

async function loadEntries() {
  const remoteEntries = await fetchRemoteEntries();
  if (remoteEntries) {
    localStorage.setItem(storageKey, JSON.stringify(remoteEntries));
    return remoteEntries;
  }

  const stored = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
  if (!stored) return cloneEntries(sampleEntries);

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return cloneEntries(sampleEntries);
    return parsed;
  } catch {
    return cloneEntries(sampleEntries);
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(state.entries));
}

async function fetchRemoteEntries() {
  try {
    const response = await fetch("/api/logs");
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.database || !Array.isArray(data.entries)) return null;

    state.databaseEnabled = true;
    return data.entries;
  } catch {
    return null;
  }
}

async function createEntry(entry) {
  if (!state.databaseEnabled) {
    saveEntries();
    return entry;
  }

  try {
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) throw new Error("Unable to save log.");
    const data = await response.json();
    return data.entry;
  } catch {
    state.databaseEnabled = false;
    return entry;
  }
}

async function deleteEntry(id) {
  const previousEntries = state.entries;
  state.entries = state.entries.filter((entry) => entry.id !== id);
  render();

  saveEntries();

  if (!state.databaseEnabled) return;

  try {
    const response = await fetch(`/api/logs/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Unable to delete log.");
  } catch {
    state.entries = previousEntries;
    saveEntries();
    render();
  }
}

function render() {
  const visibleEntries = filterEntries(state.entries, state.range);
  const todayEntries = filterEntries(state.entries, "today");
  const totals = summarize(visibleEntries);
  const todayTotals = summarize(todayEntries);

  document.querySelector("#today-total").textContent = formatMinutes(todayTotals.total);
  document.querySelector("#today-focus").textContent = todayTotals.topActivity
    ? `${todayTotals.topActivity} has the most time`
    : "No entries yet";

  document.querySelector("#range-label").textContent = labelForRange(state.range);
  document.querySelector("#total-time").textContent = formatMinutes(totals.total);
  document.querySelector("#top-activity").textContent = totals.topActivity || "None";
  document.querySelector("#log-count-stat").textContent = `${visibleEntries.length}`;
  document.querySelector("#entry-count").textContent = `${visibleEntries.length} ${visibleEntries.length === 1 ? "log" : "logs"}`;

  renderChart(totals.byActivity, totals.total);
  renderEntries(visibleEntries);
}

function filterEntries(entries, range) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  return entries.filter((entry) => {
    if (range === "all") return true;
    if (range === "today") return entry.date === todayIso;

    const entryDate = new Date(`${entry.date}T12:00:00`);
    return entryDate >= weekStart && entryDate <= now;
  });
}

function summarize(entries) {
  const byActivity = entries.reduce((accumulator, entry) => {
    const key = normalizeActivity(entry.activity);
    accumulator[key] = (accumulator[key] || 0) + entry.minutes;
    return accumulator;
  }, {});

  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const topActivity = Object.entries(byActivity).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return {
    byActivity,
    total,
    topActivity,
  };
}

function renderChart(byActivity, total) {
  chart.innerHTML = "";

  if (!total) {
    chart.innerHTML = '<p class="empty-state">Add a log to see your time breakdown.</p>';
    return;
  }

  Object.entries(byActivity)
    .sort((a, b) => b[1] - a[1])
    .forEach(([activity, minutes], index) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <span class="bar-label"></span>
        <span class="bar-track"><span class="bar-fill"></span></span>
        <span class="bar-time">${formatMinutes(minutes)}</span>
      `;
      row.querySelector(".bar-label").textContent = activity;
      row.querySelector(".bar-fill").style.width = `${Math.max((minutes / total) * 100, 3)}%`;
      row.querySelector(".bar-fill").style.background = activityColors[index % activityColors.length];
      chart.append(row);
    });
}

function renderEntries(entries) {
  entriesList.innerHTML = "";

  if (!entries.length) {
    entriesList.innerHTML = '<p class="empty-state">No logs in this range yet.</p>';
    return;
  }

  entries.forEach((entry) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".entry-title").textContent = entry.activity;
    node.querySelector(".entry-meta").textContent = `${formatDate(entry.date)} · ${formatMinutes(entry.minutes)}`;
    node.querySelector(".entry-notes").textContent = entry.notes;
    node.querySelector(".activity-dot").style.background = activityColors[colorIndexFor(entry.activity)];
    node.querySelector(".delete-button").dataset.id = entry.id;
    entriesList.append(node);
  });
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function labelForRange(range) {
  return {
    today: "Today",
    week: "Last 7 days",
    all: "All time",
  }[range];
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function flashSaved() {
  const status = document.querySelector("#save-status");
  status.querySelector(".status-dot").classList.toggle("connected", state.databaseEnabled);
  window.setTimeout(() => {
    updateSaveStatus();
  }, 1200);
}

function updateSaveStatus() {
  const status = document.querySelector("#save-status");
  status.querySelector(".status-dot").classList.toggle("connected", state.databaseEnabled);
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneEntries(entries) {
  return entries.map((entry) => ({ ...entry }));
}

function normalizeActivity(activity) {
  return activity.trim() || "Untitled";
}

function colorIndexFor(value) {
  const total = [...normalizeActivity(value)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return total % activityColors.length;
}

function syncQuickTimeButtons() {
  document.querySelectorAll("[data-minutes]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.minutes === minutesInput.value);
  });
}
