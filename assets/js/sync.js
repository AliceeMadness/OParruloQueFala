import { SYNC_URL } from "./config.js";

export const syncEnabled = Boolean(SYNC_URL);

// Larger requests cannot use keepalive, which lets a save finish as the page closes.
const KEEPALIVE_LIMIT = 60000;

export async function readRemote(profileId) {
  const response = await fetch(`${SYNC_URL}/${profileId}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`read ${response.status}`);
  const doc = await response.json();
  return JSON.parse(doc.fields.progress.stringValue);
}

export async function writeRemote(profileId, progress) {
  const body = JSON.stringify({ fields: { progress: { stringValue: JSON.stringify(progress) } } });
  const response = await fetch(`${SYNC_URL}/${profileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: body.length < KEEPALIVE_LIMIT,
  });
  if (!response.ok) throw new Error(`write ${response.status}`);
}

// Devices can play offline, so their progress is joined rather than overwritten:
// the best score of each lesson, and the most recent version of everything else.
export function mergeProgress(local, remote) {
  if (!remote) return local;
  const lessons = { ...local.lessons };
  for (const [key, score] of Object.entries(remote.lessons ?? {})) {
    lessons[key] = Math.max(score, lessons[key] ?? 0);
  }
  const crosswords = { ...local.crosswords };
  for (const [id, puzzle] of Object.entries(remote.crosswords ?? {})) {
    if ((puzzle.updatedAt ?? 0) > (crosswords[id]?.updatedAt ?? 0)) crosswords[id] = puzzle;
  }
  const remoteIsNewer = (remote.mistakesAt ?? 0) > (local.mistakesAt ?? 0);
  return {
    lessons,
    crosswords,
    mistakes: remoteIsNewer ? remote.mistakes : local.mistakes,
    mistakesAt: remoteIsNewer ? remote.mistakesAt : local.mistakesAt,
  };
}
