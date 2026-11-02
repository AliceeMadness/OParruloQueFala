// Each profile's progress is kept in the browser, so the site works offline or with
// storage blocked, and copied to the online database when it is configured.
import { mergeProgress, readRemote, syncEnabled, writeRemote } from "./sync.js";

const KEY = "oparrulo.v2";
const KEY_BEFORE_PROFILES = "oparrulo.v1";
const PUSH_DELAY_MS = 1500;

export const PROFILES = [
  { id: "alice", name: "Alice", color: "#bfe3f2", duck: "assets/img/pato-alice.svg", gender: "m" },
  { id: "raquel", name: "Raquel", color: "#f7c9d9", duck: "assets/img/pato-raquel.svg", gender: "f" },
  { id: "marina", name: "Marina", color: "#c5e8c9", duck: "assets/img/pato-marina.svg", gender: "f" },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) return saved;
    // Progress saved before profiles existed goes to the first profile.
    const old = JSON.parse(localStorage.getItem(KEY_BEFORE_PROFILES));
    return { active: null, progress: old ? { [PROFILES[0].id]: old } : {} };
  } catch {
    return { active: null, progress: {} };
  }
}

const state = load();

function saveLocally() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Nothing to do: progress stays in memory.
  }
}

function emptyProgress() {
  return {
    lessons: {},
    mistakes: {},
    mistakesAt: 0,
    collection: {},
    collectionAt: 0,
    crosswords: {},
    details: { description: "", favoriteWord: "" },
    detailsAt: 0,
    achievements: null,
  };
}

function progressOf(id) {
  state.progress[id] = { ...emptyProgress(), ...state.progress[id] };
  return state.progress[id];
}

function progress() {
  return progressOf(state.active);
}

// Online copy -----------------------------------------------------------------

let pushTimer = null;
let syncFailed = false;
let onProgressChange = () => {};
let onSyncChange = () => {};
let onSaved = () => {};

function setSyncFailed(value) {
  if (syncFailed !== value) {
    syncFailed = value;
    onSyncChange();
  }
}

async function push(id) {
  try {
    const merged = mergeProgress(progressOf(id), await readRemote(id));
    state.progress[id] = merged;
    saveLocally();
    await writeRemote(id, merged);
    setSyncFailed(false);
  } catch (error) {
    console.warn("Non se puido sincronizar", error);
    setSyncFailed(true);
  }
}

function pushPendingNow() {
  if (pushTimer === null) return;
  clearTimeout(pushTimer.handle);
  const { id } = pushTimer;
  pushTimer = null;
  push(id);
}

function schedulePush() {
  if (!syncEnabled) return;
  if (pushTimer) clearTimeout(pushTimer.handle);
  const id = state.active;
  const handle = setTimeout(() => {
    pushTimer = null;
    push(id);
  }, PUSH_DELAY_MS);
  pushTimer = { id, handle };
}

function save() {
  saveLocally();
  onSaved();
  schedulePush();
}

// Brings in what other devices saved, and sends what this device has that they lack.
export async function pullProgress() {
  const id = state.active;
  if (!syncEnabled || !id) return;
  try {
    const remote = await readRemote(id);
    const before = JSON.stringify(progressOf(id));
    const merged = mergeProgress(progressOf(id), remote);
    state.progress[id] = merged;
    saveLocally();
    setSyncFailed(false);
    if (JSON.stringify(merged) !== JSON.stringify(remote)) schedulePush();
    if (JSON.stringify(merged) !== before && state.active === id) onProgressChange();
  } catch (error) {
    console.warn("Non se puido sincronizar", error);
    setSyncFailed(true);
  }
}

export function startSync(callbacks) {
  ({ onProgressChange, onSyncChange, onSaved } = callbacks);
  if (!syncEnabled) return;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pushPendingNow();
    else pullProgress();
  });
  window.addEventListener("pagehide", pushPendingNow);
  window.addEventListener("online", pullProgress);
}

export function isSyncFailing() {
  return syncFailed;
}

// Brings in the other profiles' progress, only to show it: it is never uploaded from here.
export async function refreshOtherProfiles() {
  if (!syncEnabled) return;
  const others = PROFILES.filter((profile) => profile.id !== state.active);
  await Promise.all(others.map(async ({ id }) => {
    try {
      const remote = await readRemote(id);
      state.progress[id] = mergeProgress(progressOf(id), remote);
    } catch (error) {
      console.warn("Non se puido ler o perfil", id, error);
    }
  }));
  saveLocally();
}

// Profiles and progress ---------------------------------------------------------

export function activeProfile() {
  return PROFILES.find((profile) => profile.id === state.active) ?? null;
}

export function selectProfile(id) {
  pushPendingNow();
  state.active = id;
  saveLocally();
}

// Null when this device has never been able to read that profile's progress.
export function completedBy(profileId, lessonKeys, crosswordIds) {
  const saved = state.progress[profileId];
  if (!saved) return null;
  const lessons = lessonKeys.filter((key) => saved.lessons?.[key] !== undefined).length;
  const puzzles = crosswordIds.filter((id) => saved.crosswords?.[id]?.done).length;
  return lessons + puzzles;
}

export function bestScore(lessonKey) {
  return progress().lessons[lessonKey];
}

export function recordScore(lessonKey, percent) {
  const { lessons } = progress();
  lessons[lessonKey] = Math.max(percent, lessons[lessonKey] ?? 0);
  save();
}

export function addMistake(word) {
  const current = progress();
  current.mistakes[word.es] = word.gl;
  current.mistakesAt = Date.now();
  save();
}

export function clearMistake(word) {
  const current = progress();
  if (word.es in current.mistakes) {
    delete current.mistakes[word.es];
    current.mistakesAt = Date.now();
    save();
  }
}

export function mistakes() {
  return Object.entries(progress().mistakes).map(([es, gl]) => ({ es, gl }));
}

export function inCollection(word) {
  return word.es in progress().collection;
}

export function addToCollection(word) {
  const current = progress();
  current.collection[word.es] = word.gl;
  current.collectionAt = Date.now();
  save();
}

export function removeFromCollection(word) {
  const current = progress();
  if (word.es in current.collection) {
    delete current.collection[word.es];
    current.collectionAt = Date.now();
    save();
  }
}

export function collection() {
  return Object.entries(progress().collection).map(([es, gl]) => ({ es, gl }));
}

export function profileDetails() {
  return progress().details;
}

export function saveProfileDetails(details) {
  const current = progress();
  current.details = details;
  current.detailsAt = Date.now();
  save();
}

// Null until the profile's first check, which records what it had already reached.
export function earnedAchievements() {
  return progress().achievements;
}

export function addEarnedAchievements(ids) {
  const current = progress();
  current.achievements = { ...current.achievements };
  for (const id of ids) current.achievements[id] = Date.now();
  save();
}

export function crosswordState(id) {
  return progress().crosswords[id] ?? { cells: {}, done: false };
}

export function saveCrossword(id, value) {
  progress().crosswords[id] = { ...value, updatedAt: Date.now() };
  save();
}
