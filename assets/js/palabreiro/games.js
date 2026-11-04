// Palabreiro games are kept in the same online database as the profiles, one document per
// game in `games/<id>`, with the whole game as JSON in a `game` field. Every write says which
// version it replaces, so two players can never overwrite each other's moves.
import { SYNC_URL } from "../config.js";

const GAMES_URL = SYNC_URL.replace(/\/profiles$/, "/games");
export const gamesEnabled = Boolean(SYNC_URL);

export class GameChanged extends Error {}

function fromDocument(doc) {
  return { game: JSON.parse(doc.fields.game.stringValue), version: doc.updateTime };
}

export async function listGames() {
  const games = [];
  let token = "";
  do {
    const response = await fetch(`${GAMES_URL}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`list ${response.status}`);
    const page = await response.json();
    for (const doc of page.documents ?? []) games.push(fromDocument(doc).game);
    token = page.nextPageToken ?? "";
  } while (token);
  return games;
}

// Returns { game, version }, or null if there is no such game.
export async function readGame(id) {
  const response = await fetch(`${GAMES_URL}/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`read ${response.status}`);
  return fromDocument(await response.json());
}

// `version` is the one read before the move, or null for a new game. Throws GameChanged if
// someone saved the game in between. Returns the new version.
export async function writeGame(game, version) {
  const condition = version
    ? `currentDocument.updateTime=${encodeURIComponent(version)}`
    : "currentDocument.exists=false";
  const response = await fetch(`${GAMES_URL}/${encodeURIComponent(game.id)}?${condition}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { game: { stringValue: JSON.stringify(game) } } }),
  });
  if (response.status === 400 || response.status === 409 || response.status === 412) {
    const text = await response.text();
    if (/FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND/.test(text)) throw new GameChanged();
    throw new Error(`write ${response.status}: ${text}`);
  }
  if (!response.ok) throw new Error(`write ${response.status}`);
  return (await response.json()).updateTime;
}
