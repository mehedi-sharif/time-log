const authKey = "time-log.auth";

const authGate = document.querySelector("#auth-gate");
const authForm = document.querySelector("#auth-form");
const authInput = document.querySelector("#auth-input");
const authError = document.querySelector("#auth-error");

if (localStorage.getItem(authKey) === "1") {
  authGate.classList.add("hidden");
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = authInput.value;

  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (data.ok) {
      localStorage.setItem(authKey, "1");
      authGate.classList.add("hidden");
    } else {
      authError.textContent = "Incorrect password. Try again.";
      authInput.value = "";
      authInput.focus();
    }
  } catch {
    authError.textContent = "Could not verify password. Try again.";
  }
});

const activityColors = ["#1f7a6b", "#d85f49", "#517fb8", "#529d65", "#7d679f", "#b88724"];

const todayIso = toLocalIsoDate(new Date());

const state = {
  view: "log",
  range: "today",
  entries: [],
};

const form = document.querySelector("#entry-form");
const startTimeInput = document.querySelector("#start-time");
const endTimeInput = document.querySelector("#end-time");
const chart = document.querySelector("#chart");
const entriesList = document.querySelector("#timeline");
const template = document.querySelector("#entry-template");

initTimeInputs();

document.querySelectorAll("[data-minutes]").forEach((button) => {
  button.addEventListener("click", () => {
    if (startTimeInput.value) {
      endTimeInput.value = minutesToTime(timeToMinutes(startTimeInput.value) + parseInt(button.dataset.minutes));
    }
    syncQuickTimeButtons();
  });
});

startTimeInput.addEventListener("change", () => {
  const duration = getDurationMinutes() || 30;
  endTimeInput.value = minutesToTime(timeToMinutes(startTimeInput.value) + duration);
  syncQuickTimeButtons();
});

endTimeInput.addEventListener("change", () => {
  syncQuickTimeButtons();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSubmit(new FormData(form));
});

async function handleSubmit(data) {
  const startTime = data.get("start_time");
  const endTime = data.get("end_time");
  const date = toLocalIsoDate(new Date());

  const conflict = state.entries.find((e) => {
    if (e.date !== date || !e.start_time || !e.end_time) return false;
    const eStart = timeToMinutes(e.start_time);
    const eEnd = timeToMinutes(e.end_time);
    const nStart = timeToMinutes(startTime);
    const nEnd = timeToMinutes(endTime);
    return nStart < eEnd && nEnd > eStart;
  });

  if (conflict) {
    flashError(`Overlaps with "${conflict.activity}" (${formatTime(conflict.start_time)} → ${formatTime(conflict.end_time)})`);
    return;
  }

  const entry = {
    id: makeId(),
    activity: data.get("activity").trim(),
    date,
    start_time: startTime,
    end_time: endTime,
    minutes: calcMinutes(startTime, endTime),
  };

  const savedEntry = await createEntry(entry);
  state.entries.unshift(savedEntry);
  form.reset();
  initTimeInputs();
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

const confirmModal = document.querySelector("#confirm-modal");
const confirmDelete = document.querySelector("#confirm-delete");
const confirmCancel = document.querySelector("#confirm-cancel");
let pendingDeleteId = null;
let pendingDeleteType = "entry";

entriesList.addEventListener("click", (event) => {
  if (event.target.closest(".delete-button")) {
    pendingDeleteId = event.target.closest(".delete-button").dataset.id;
    pendingDeleteType = "entry";
    confirmModal.classList.remove("hidden");
    return;
  }

  const editBtn = event.target.closest(".edit-button");
  if (editBtn) openEditModal(editBtn.dataset.id);
});

const editModal = document.querySelector("#edit-modal");
const editForm = document.querySelector("#edit-form");
const editCancel = document.querySelector("#edit-cancel");
let editingId = null;

editCancel.addEventListener("click", () => {
  editModal.classList.add("hidden");
  editingId = null;
});

editModal.addEventListener("click", (e) => {
  if (e.target === editModal) {
    editModal.classList.add("hidden");
    editingId = null;
  }
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingId) return;

  const activity = document.querySelector("#edit-activity").value.trim();
  const start_time = document.querySelector("#edit-start-time").value;
  const end_time = document.querySelector("#edit-end-time").value;
  const minutes = calcMinutes(start_time, end_time);

  try {
    const res = await fetch(`/api/logs/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity, start_time, end_time, minutes }),
    });
    if (!res.ok) throw new Error();
    const { entry } = await res.json();

    const idx = state.entries.findIndex((e) => e.id === editingId);
    if (idx !== -1) state.entries[idx] = { ...state.entries[idx], ...entry };
    render();
  } catch {}

  editModal.classList.add("hidden");
  editingId = null;
});

function openEditModal(id) {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;

  editingId = id;
  document.querySelector("#edit-activity").value = entry.activity;
  document.querySelector("#edit-start-time").value = entry.start_time || "";
  document.querySelector("#edit-end-time").value = entry.end_time || "";
  editModal.classList.remove("hidden");
  document.querySelector("#edit-activity").focus();
}

confirmCancel.addEventListener("click", () => {
  pendingDeleteId = null;
  confirmModal.classList.add("hidden");
});

confirmDelete.addEventListener("click", () => {
  if (pendingDeleteId) {
    if (pendingDeleteType === "goal") deleteGoal(pendingDeleteId);
    else deleteEntry(pendingDeleteId);
  }
  pendingDeleteId = null;
  confirmModal.classList.add("hidden");
});

init();

async function init() {
  state.entries = await loadEntries();
  updateSaveStatus();
  render();
}

async function loadEntries() {
  const remoteEntries = await fetchRemoteEntries();
  return remoteEntries ?? [];
}

async function fetchRemoteEntries() {
  try {
    const response = await fetch("/api/logs");
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.database || !Array.isArray(data.entries)) return null;

    return data.entries;
  } catch {
    return null;
  }
}

async function createEntry(entry) {
  const response = await fetch("/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });

  if (!response.ok) throw new Error("Unable to save log.");
  const data = await response.json();
  return data.entry;
}

async function deleteEntry(id) {
  const previousEntries = state.entries;
  state.entries = state.entries.filter((entry) => entry.id !== id);
  render();

  try {
    const response = await fetch(`/api/logs/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Unable to delete log.");
  } catch {
    state.entries = previousEntries;
    render();
  }
}

function render() {
  const visibleEntries = filterEntries(state.entries, state.range);
  const todayEntries = filterEntries(state.entries, "today");
  const totals = summarize(visibleEntries);
  const todayTotals = summarize(todayEntries);

  document.querySelector("#today-total").textContent = formatMinutes(todayTotals.total);

  document.querySelector("#range-label").textContent = labelForRange(state.range);
  document.querySelector("#total-time").textContent = formatMinutes(totals.total);
  document.querySelector("#top-activity").textContent = totals.topActivity || "None";
  document.querySelector("#log-count-stat").textContent = `${visibleEntries.length}`;

  renderChart(totals.byActivity, totals.total);
  renderEntries(todayEntries);
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

// ── Timeline ───────────────────────────────────────────────────────────────

const TIMELINE_START = 6;  // 6 AM
const TIMELINE_END   = 23; // 11 PM

function minsToTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

const HOUR_HEIGHT = 64; // px per hour — 30 min = 32px, 15 min = 16px
const GRID_PAD    = 14; // top offset so first label stays inside the border

function renderEntries(todayEntries) {
  entriesList.innerHTML = "";

  const startMins  = TIMELINE_START * 60;
  const endMins    = TIMELINE_END   * 60;
  const totalHours = TIMELINE_END - TIMELINE_START;

  entriesList.style.position = "relative";

  const grid = document.createElement("div");
  grid.className = "tl-grid";
  grid.style.height = totalHours * HOUR_HEIGHT + GRID_PAD + "px";

  // ── Period bands (Morning / Noon / Evening) ────────────────────────────────
  const periods = [
    { label: "🌅 Morning", start: 6,  end: 12, cls: "tl-period-morning" },
    { label: "☀️ Noon",    start: 12, end: 17, cls: "tl-period-noon"    },
    { label: "🌙 Evening", start: 17, end: 23, cls: "tl-period-evening" },
  ];
  for (const p of periods) {
    const band = document.createElement("div");
    band.className = `tl-period ${p.cls}`;
    band.style.top    = (p.start - TIMELINE_START) * HOUR_HEIGHT + GRID_PAD + "px";
    band.style.height = (p.end   - p.start)        * HOUR_HEIGHT + "px";
    band.innerHTML    = `<span class="tl-period-label">${p.label}</span>`;
    grid.append(band);
  }

  // ── Hour grid lines + labels ───────────────────────────────────────────────
  for (let hour = TIMELINE_START; hour <= TIMELINE_END; hour++) {
    const top  = (hour - TIMELINE_START) * HOUR_HEIGHT + GRID_PAD;
    const h12  = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";

    const row = document.createElement("div");
    row.className = "tl-hour-row";
    row.style.top = top + "px";
    row.innerHTML = `<span class="tl-hour-label">${h12} ${ampm}</span>`;
    grid.append(row);
  }

  // ── Current-time indicator (Notion-style badge + line) ────────────────────
  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (nowMins >= startMins && nowMins < endMins) {
    const h12    = now.getHours() % 12 || 12;
    const mm     = String(now.getMinutes()).padStart(2, "0");
    const ampm   = now.getHours() < 12 ? "AM" : "PM";
    const nowEl  = document.createElement("div");
    nowEl.className = "tl-now";
    nowEl.style.top = (nowMins - startMins) / 60 * HOUR_HEIGHT + GRID_PAD + "px";
    nowEl.innerHTML = `<span class="tl-now-badge">${h12}:${mm} ${ampm}</span><span class="tl-now-line"></span>`;
    grid.append(nowEl);
  }

  // ── Click → persistent selection block + pre-fill form ───────────────────
  let selectionEl = null;

  function snapSlot(clientY) {
    const y       = clientY - grid.getBoundingClientRect().top - GRID_PAD;
    const raw     = (y / HOUR_HEIGHT) * 60 + startMins;
    const snapped = Math.round(raw / 15) * 15;
    const s       = Math.max(startMins, Math.min(snapped, endMins - 30));
    return { s, end: Math.min(s + 30, endMins) };
  }

  function placeSelection(s, end) {
    if (selectionEl) selectionEl.remove();
    const top    = (s - startMins) / 60 * HOUR_HEIGHT + GRID_PAD;
    const height = Math.max((end - s) / 60 * HOUR_HEIGHT, 32);
    selectionEl  = document.createElement("div");
    selectionEl.className = "tl-selection";
    selectionEl.style.cssText = `top:${top}px;height:${height}px;`;
    selectionEl.innerHTML = `
      <span class="tl-sel-time">${formatTime(minsToTimeStr(s))} – ${formatTime(minsToTimeStr(end))}</span>
      <span class="tl-sel-dur">${end - s}min</span>
    `;
    grid.append(selectionEl);
  }

  grid.addEventListener("click", (e) => {
    if (e.target.closest(".tl-entry")) return;
    const { s, end } = snapSlot(e.clientY);
    placeSelection(s, end);
    startTimeInput.value = minsToTimeStr(s);
    endTimeInput.value   = minsToTimeStr(end);
    syncQuickTimeButtons();
    document.querySelector("#activity").focus();
    document.querySelector("#activity").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ── Entry blocks ───────────────────────────────────────────────────────────
  const sorted = [...todayEntries]
    .filter((e) => e.start_time && e.end_time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (const entry of sorted) {
    const sMins = Math.max(timeToMinutes(entry.start_time), startMins);
    const eMins = Math.min(timeToMinutes(entry.end_time),   endMins);
    if (eMins <= sMins) continue;

    const top    = (sMins - startMins) / 60 * HOUR_HEIGHT + GRID_PAD;
    const height = Math.max((eMins - sMins) / 60 * HOUR_HEIGHT, 28);
    const color  = activityColors[colorIndexFor(entry.activity)];
    const tall   = height >= 42;

    const block = document.createElement("div");
    block.className = "tl-entry";
    block.style.cssText = `top:${top}px;height:${height}px;border-left-color:${color};background:${color}22;`;
    block.innerHTML = `
      <div class="tl-entry-inner">
        <span class="tl-entry-name"></span>
        ${tall ? `<span class="tl-entry-time">${formatTime(entry.start_time)} – ${formatTime(entry.end_time)}</span>` : ""}
      </div>
      <button class="delete-button tl-delete" type="button" data-id="${entry.id}" aria-label="Delete entry">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path></svg>
      </button>
    `;
    block.querySelector(".tl-entry-name").textContent = entry.activity;
    grid.append(block);
  }

  // ── Wire delete buttons ────────────────────────────────────────────────────
  grid.querySelectorAll(".tl-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      pendingDeleteId   = btn.dataset.id;
      pendingDeleteType = "entry";
      confirmModal.classList.remove("hidden");
    });
  });

  entriesList.append(grid);
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

function flashError(message) {
  const toast = document.querySelector("#toast");
  toast.innerHTML = `&#9888;&nbsp; ${message}`;
  toast.style.borderLeftColor = "var(--coral)";
  toast.classList.add("visible");
  setTimeout(() => {
    toast.classList.remove("visible");
    toast.style.borderLeftColor = "";
  }, 3500);
}

function flashSaved() {
  const toast = document.querySelector("#toast");
  toast.innerHTML = "&#10003;&nbsp; Time logged successfully";
  toast.style.borderLeftColor = "";
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2500);

  const status = document.querySelector("#save-status");
  updateSaveStatus();
}

function updateSaveStatus() {
  document.querySelector("#save-status .status-dot").classList.add("connected");
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
  const duration = getDurationMinutes();
  document.querySelectorAll("[data-minutes]").forEach((button) => {
    button.classList.toggle("selected", parseInt(button.dataset.minutes) === duration);
  });
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDurationMinutes() {
  if (!startTimeInput.value || !endTimeInput.value) return 0;
  let diff = timeToMinutes(endTimeInput.value) - timeToMinutes(startTimeInput.value);
  if (diff <= 0) diff += 1440;
  return diff;
}

function calcMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  let diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (diff <= 0) diff += 1440;
  return diff;
}

function initTimeInputs() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5, 0, 0);
  startTimeInput.value = minutesToTime(now.getHours() * 60 + now.getMinutes());
  endTimeInput.value = minutesToTime(now.getHours() * 60 + now.getMinutes() + 30);
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ── Goals ──────────────────────────────────────────────────────────────────

const goalState = { goals: [] };

const goalForm = document.querySelector("#goal-form");
const goalInput = document.querySelector("#goal-input");
const goalsList = document.querySelector("#goals-list");
const goalTemplate = document.querySelector("#goal-template");

initGoals();

async function initGoals() {
  goalState.goals = await loadGoals();
  renderGoals();
}

async function loadGoals() {
  try {
    const res = await fetch("/api/goals");
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.database && Array.isArray(data.goals)) return data.goals;
  } catch {}
  return [];
}

goalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = goalInput.value.trim();
  if (!title) return;

  try {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const data = await res.json();
      goalState.goals.unshift(data.goal);
    }
  } catch {}

  goalInput.value = "";
  renderGoals();
});

goalsList.addEventListener("change", async (e) => {
  const checkbox = e.target.closest(".goal-checkbox");
  if (!checkbox) return;
  const card = checkbox.closest(".goal-card");
  const id = card.dataset.id;
  const goal = goalState.goals.find((g) => g.id === id);
  if (!goal) return;

  goal.completed = checkbox.checked;
  renderGoals();

  fetch(`/api/goals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: goal.completed }),
  }).catch(() => {});
});

goalsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".goal-delete");
  if (!btn) return;
  const card = btn.closest(".goal-card");
  pendingDeleteId = card.dataset.id;
  pendingDeleteType = "goal";
  confirmModal.classList.remove("hidden");
});

async function deleteGoal(id) {
  goalState.goals = goalState.goals.filter((g) => g.id !== id);
  renderGoals();
  fetch(`/api/goals/${id}`, { method: "DELETE" }).catch(() => {});
}

function renderGoals() {
  goalsList.innerHTML = "";
  const total = goalState.goals.length;
  const done = goalState.goals.filter((g) => g.completed).length;
  document.querySelector("#goals-count").textContent =
    `${done}/${total} complete`;

  if (!total) {
    goalsList.innerHTML = '<p class="empty-state">No goals yet. Add one above.</p>';
    return;
  }

  goalState.goals.forEach((goal) => {
    const node = goalTemplate.content.cloneNode(true);
    const card = node.querySelector(".goal-card");
    card.dataset.id = goal.id;
    const checkbox = node.querySelector(".goal-checkbox");
    checkbox.checked = goal.completed;
    const titleEl = node.querySelector(".goal-title");
    titleEl.textContent = goal.title;
    if (goal.completed) titleEl.classList.add("completed");
    goalsList.append(node);
  });
}
