const API = "https://time-log-mehedi.vercel.app";

const authScreen = document.querySelector("#auth-screen");
const mainScreen = document.querySelector("#main-screen");
const authForm = document.querySelector("#auth-form");
const authInput = document.querySelector("#auth-input");
const authError = document.querySelector("#auth-error");
const logForm = document.querySelector("#log-form");
const startTimeInput = document.querySelector("#start-time");
const endTimeInput = document.querySelector("#end-time");
const todayTotal = document.querySelector("#today-total");
const statusDot = document.querySelector("#status-dot");
const saveBtn = document.querySelector("#save-btn");
const toast = document.querySelector("#toast");

// ── Init ──────────────────────────────────────────────────────────────────

chrome.storage.local.get("authed", ({ authed }) => {
  if (authed) showMain();
  else showAuth();
});

// ── Auth ──────────────────────────────────────────────────────────────────

function showAuth() {
  authScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
  authInput.focus();
}

function showMain() {
  authScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  initTimeInputs();
  syncQuickButtons();
  loadToday();
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";

  try {
    const res = await fetch(`${API}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: authInput.value }),
    });
    const data = await res.json();
    if (data.ok) {
      chrome.storage.local.set({ authed: true });
      showMain();
    } else {
      authError.textContent = "Incorrect password.";
      authInput.value = "";
      authInput.focus();
    }
  } catch {
    authError.textContent = "Could not connect. Try again.";
  }
});

// ── Time helpers ──────────────────────────────────────────────────────────

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDuration() {
  if (!startTimeInput.value || !endTimeInput.value) return 0;
  let diff = timeToMinutes(endTimeInput.value) - timeToMinutes(startTimeInput.value);
  if (diff <= 0) diff += 1440;
  return diff;
}

function initTimeInputs() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5, 0, 0);
  startTimeInput.value = minutesToTime(now.getHours() * 60 + now.getMinutes());
  endTimeInput.value = minutesToTime(now.getHours() * 60 + now.getMinutes() + 30);
}

function syncQuickButtons() {
  const duration = getDuration();
  document.querySelectorAll("[data-minutes]").forEach((btn) => {
    btn.classList.toggle("selected", parseInt(btn.dataset.minutes) === duration);
  });
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function toLocalIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ── Quick buttons ─────────────────────────────────────────────────────────

document.querySelectorAll("[data-minutes]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (startTimeInput.value) {
      endTimeInput.value = minutesToTime(timeToMinutes(startTimeInput.value) + parseInt(btn.dataset.minutes));
    }
    syncQuickButtons();
  });
});

startTimeInput.addEventListener("change", () => {
  const duration = getDuration() || 30;
  endTimeInput.value = minutesToTime(timeToMinutes(startTimeInput.value) + duration);
  syncQuickButtons();
});

endTimeInput.addEventListener("change", syncQuickButtons);

// ── Load today's total ────────────────────────────────────────────────────

async function loadToday() {
  try {
    const res = await fetch(`${API}/api/logs`);
    const data = await res.json();
    if (data.database) {
      statusDot.classList.add("connected");
      const today = toLocalIsoDate(new Date());
      const total = (data.entries || [])
        .filter((e) => e.date === today)
        .reduce((sum, e) => sum + e.minutes, 0);
      todayTotal.textContent = formatMinutes(total);
    }
  } catch {
    todayTotal.textContent = "—";
  }
}

// ── Save log ──────────────────────────────────────────────────────────────

logForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const activity = document.querySelector("#activity").value.trim();
  const start_time = startTimeInput.value;
  const end_time = endTimeInput.value;
  let minutes = getDuration();
  if (!minutes) minutes = 30;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const res = await fetch(`${API}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity,
        date: toLocalIsoDate(new Date()),
        start_time,
        end_time,
        minutes,
      }),
    });

    if (!res.ok) throw new Error();

    logForm.reset();
    initTimeInputs();
    syncQuickButtons();
    loadToday();
    showToast("Saved!");
  } catch {
    showToast("Failed to save. Try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save log";
  }
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}
