// Each profile's progress is kept in the browser, so the site works offline or with
// storage blocked, and copied to the online database when it is configured.
import { mergeProgress, readRemote, syncEnabled, writeRemote } from "./sync.js";

const KEY = "oparrulo.v2";
const KEY_BEFORE_PROFILES = "oparrulo.v1";
const DEVICE_KEY = "oparrulo.device";
const PUSH_DELAY_MS = 1500;

// `password` is the SHA-256 of the lowercase password. It only keeps players out of each
// other's profiles by accident: the site has no server, so it can't stop anyone determined.
export const PROFILES = [
  { id: "alice", name: "Alice", color: "#bfe3f2", duck: "assets/img/pato-alice.svg", gender: "m", password: "f87ac4b3744c6502ed82045e47e54013b22e74bca3d335e6b500c3532ff7dd73" },
  { id: "raquel", name: "Raquel", color: "#f7c9d9", duck: "assets/img/pato-raquel.svg", gender: "f", password: "3502a3532fd3bb73baa9cfdae8bbeab9c35763303014f1cdf282d8f1af9ae9e2" },
  { id: "marina", name: "Marina", color: "#c5e8c9", duck: "assets/img/pato-marina.svg", gender: "f", password: "4a35fd50a93246799566b9f331f629d520ed70190d3b7d7a3f0f10c35a77c721" },
  { id: "japolo", name: "Japolo", color: "#dcdcd6", duck: "assets/img/pato-japolo.svg", gender: "m", password: "d70e819bfca5121ec77a57aa4f6b7b4a07127fbcd6874305f8eb92fad2505457" },
  { id: "diana", name: "Diana", color: "#f4c6c6", duck: "assets/img/pato-diana.svg", gender: "f", password: "95c572150a5228ac0d08a598df5f3a18451f6e0d9d1775559ca551ee99922d3f" },
];

// Playing without a profile: progress stays in this browser, and there is no collection.
export const GUEST = { id: "convidado", name: "Sen perfil", color: "#efe9db", duck: "assets/img/parrulo.svg", guest: true };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) {
      // A profile opened before passwords existed has to be opened again with its password.
      if (!saved.passwords) saved.active = null;
      saved.passwords = true;
      return saved;
    }
    // Progress saved before profiles existed goes to the first profile.
    const old = JSON.parse(localStorage.getItem(KEY_BEFORE_PROFILES));
    return { active: null, passwords: true, progress: old ? { [PROFILES[0].id]: old } : {} };
  } catch {
    return { active: null, passwords: true, progress: {} };
  }
}

const state = load();

// Play time is counted per device and added up, so two devices never overwrite each other's.
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "this-device";
  }
}

const DEVICE = deviceId();

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
    mistakesVerbs: {},
    mistakesGrammar: {},
    mistakesAt: 0,
    collection: {},
    collectionVerbs: {},
    collectionGrammar: {},
    collectionAt: 0,
    crosswords: {},
    details: { description: "", favoriteWord: "" },
    detailsAt: 0,
    achievements: null,
    playTime: {},
    playDays: {},
    counts: {},
    examAt: 0,
    examSeen: {},
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
    const remote = await readRemote(id);
    // Merged only once the read is back, so it includes whatever changed while waiting.
    const merged = mergeProgress(progressOf(id), remote);
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

function syncsActive() {
  return syncEnabled && state.active !== null && state.active !== GUEST.id;
}

function schedulePush() {
  if (!syncsActive()) return;
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
  if (!syncsActive()) return;
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
  if (state.active === GUEST.id) return GUEST;
  return PROFILES.find((profile) => profile.id === state.active) ?? null;
}

export async function checkPassword(profile, text) {
  const bytes = new TextEncoder().encode(text.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex === profile.password;
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

// What the review brings back, by kind as in the collection: vocabulary stays in `mistakes`,
// where it was saved before verbs and grammar joined. A word is saved as its Spanish and
// its answers, a verb form and a sentence as the collection saves them.
const MISTAKE_FIELDS = { words: "mistakes", verbs: "mistakesVerbs", grammar: "mistakesGrammar" };

export function addMistake(kind, id, value) {
  const current = progress();
  current[MISTAKE_FIELDS[kind]][id] = value;
  current.mistakesAt = Date.now();
  save();
}

export function clearMistake(kind, id) {
  const current = progress();
  const saved = current[MISTAKE_FIELDS[kind]];
  if (id in saved) {
    delete saved[id];
    current.mistakesAt = Date.now();
    save();
  }
}

// Returns [{ id, value }], oldest first.
export function mistakes(kind) {
  return Object.entries(progress()[MISTAKE_FIELDS[kind]]).map(([id, value]) => ({ id, value }));
}

export function mistakeCount() {
  return Object.keys(MISTAKE_FIELDS).reduce((total, kind) => total + mistakes(kind).length, 0);
}

// Vocabulary stays in `collection`, where it was saved before verbs and grammar joined.
const COLLECTION_FIELDS = { words: "collection", verbs: "collectionVerbs", grammar: "collectionGrammar" };

function collectionOf(kind) {
  return progress()[COLLECTION_FIELDS[kind]];
}

export function inCollection(kind, id) {
  return id in collectionOf(kind);
}

export function addToCollection(kind, id, value) {
  collectionOf(kind)[id] = value;
  progress().collectionAt = Date.now();
  save();
}

export function removeFromCollection(kind, id) {
  const saved = collectionOf(kind);
  if (id in saved) {
    delete saved[id];
    progress().collectionAt = Date.now();
    save();
  }
}

// Returns [{ id, value }], oldest first.
export function collection(kind) {
  return Object.entries(collectionOf(kind)).map(([id, value]) => ({ id, value }));
}

export function collectionSize() {
  return Object.keys(COLLECTION_FIELDS).reduce((total, kind) => total + collection(kind).length, 0);
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

// The local date, so a day runs from midnight to midnight where the player is.
function today() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
}

// Playing also marks the day as played, and the late and early hours for their achievements.
export function addPlayTime(ms) {
  const current = progress();
  current.playTime[DEVICE] = (current.playTime[DEVICE] ?? 0) + ms;
  current.playDays[today()] = true;
  const hour = new Date().getHours();
  if (hour < 5) bump(current, "noite");
  else if (hour < 7) bump(current, "madrugada");
  save();
}

// Days with exercises, as "YYYY-MM-DD".
export function playDays() {
  return Object.keys(progress().playDays);
}

// Counts are kept per device, like the play time, so two devices never overwrite each other's.
function bump(current, name) {
  const mine = { ...current.counts[DEVICE] };
  mine[name] = (mine[name] ?? 0) + 1;
  current.counts[DEVICE] = mine;
}

// Exams, Dudoiro rounds and the like, added up on every device.
export function countEvent(name) {
  bump(progress(), name);
  save();
}

export function eventCount(name) {
  return Object.values(progress().counts).reduce((total, device) => total + (device[name] ?? 0), 0);
}

export function totalPlayTime(profileId = state.active) {
  return Object.values(state.progress[profileId]?.playTime ?? {}).reduce((total, ms) => total + ms, 0);
}

// What this device last read of a profile, only to show it: null if it never could.
export function savedProgress(profileId) {
  const saved = state.progress[profileId];
  return saved ? { ...emptyProgress(), ...saved } : null;
}

// When the profile last finished the exam of what it has learned, or 0 if never.
export function lastExamAt() {
  return progress().examAt;
}

export function recordExam() {
  progress().examAt = Date.now();
  save();
}

// When each question or answer last came up in an exam, so the next exams can leave it out.
export function examSeen() {
  return progress().examSeen;
}

// Entries older than `forgetBefore` are dropped, so the list only covers the last few hours.
export function markExamSeen(keys, forgetBefore) {
  const current = progress();
  const now = Date.now();
  const seen = Object.fromEntries(Object.entries(current.examSeen).filter(([, at]) => at >= forgetBefore));
  for (const key of keys) seen[key] = now;
  current.examSeen = seen;
  save();
}

export function crosswordState(id) {
  return progress().crosswords[id] ?? { cells: {}, done: false };
}

export function saveCrossword(id, value) {
  progress().crosswords[id] = { ...value, updatedAt: Date.now() };
  save();
}
