// Counts the time spent doing exercises, not just having the site open: only on
// exercise pages, with the tab visible, and while the player keeps interacting.
import { activeProfile, addPlayTime } from "./store.js";

const TICK_MS = 1000;
const IDLE_MS = 2 * 60 * 1000;
// Time is saved in batches, so playing doesn't send an upload every second.
const SAVE_EVERY_MS = 30 * 1000;

let pending = 0;
let lastTick = Date.now();
let lastActivity = Date.now();

// Lessons, crosswords, the review and studying the collection; not lists or menus.
function isExercisePage() {
  const [section, ...rest] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (["vocabulario", "verbos", "gramatica"].includes(section)) return rest.length === 2;
  if (["encrucillados", "coleccion"].includes(section)) return rest.length > 0;
  return section === "repaso";
}

function isPlaying(now) {
  return document.visibilityState === "visible"
    && now - lastActivity <= IDLE_MS
    && activeProfile() !== null
    && isExercisePage();
}

function flush() {
  if (pending >= TICK_MS && activeProfile()) addPlayTime(Math.round(pending));
  pending = 0;
}

function tick() {
  const now = Date.now();
  // A long gap means the computer slept, which isn't playing.
  if (isPlaying(now)) pending += Math.min(now - lastTick, 2 * TICK_MS);
  lastTick = now;
  if (pending >= SAVE_EVERY_MS) flush();
}

// Call before startSync, so the time is saved before a hidden page uploads its progress.
export function startPlayTimer() {
  for (const type of ["keydown", "pointerdown", "input"]) {
    window.addEventListener(type, () => { lastActivity = Date.now(); }, { capture: true, passive: true });
  }
  // Leaving an exercise, or switching profile, saves its time to the profile that played it.
  window.addEventListener("hashchange", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
    lastTick = Date.now();
  });
  window.addEventListener("pagehide", flush);
  setInterval(tick, TICK_MS);
}

export function formatPlayTime(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "menos dun minuto";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
