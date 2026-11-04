// Palabreiro: a word board game played by turns between the profiles, two to four at a time.
// The rules are in ../palabreiro/rules.js and the games live in the online database.
import { unknownWords } from "../palabreiro/dictionary.js";
import { GameChanged, gamesEnabled, listGames, readGame, writeGame } from "../palabreiro/games.js";
import {
  BLANK, CENTER, LETTERS, PREMIUM, PREMIUM_LABELS, SIZE, activePlayers, canSwap, currentPlayer, evaluate,
  newGame, passMove, playMove, resignMove, shuffled, swapMove, value,
} from "../palabreiro/rules.js";
import { activeProfile, PROFILES } from "../store.js";
import { avatar, backLink, el, focusSoon, replace } from "../ui.js";

export const PALABREIRO_TITLE = "Palabreiro";
const POLL_MS = 8000;
const FINISHED_SHOWN = 10;

const profileOf = (id) => PROFILES.find((profile) => profile.id === id) ?? { id, name: id, color: "#ddd", duck: "assets/img/parrulo.svg" };
const nameOf = (id) => profileOf(id).name;
const isMine = (game, me) => game.players.includes(me);
const myTurn = (game, me) => !game.over && currentPlayer(game) === me;

// How many games are waiting for the active profile, for the menu.
export async function gamesWaiting() {
  const me = activeProfile();
  if (!gamesEnabled || !me || me.guest) return 0;
  const games = await listGames();
  return games.filter((game) => isMine(game, me.id) && myTurn(game, me.id)).length;
}

function unavailable() {
  const profile = activeProfile();
  if (profile?.guest) {
    return el(
      "div",
      { class: "narrow" },
      el("h1", {}, PALABREIRO_TITLE),
      el("p", { class: "lead" }, "As partidas xóganse entre perfís. Entra co teu para retar aos demais."),
      el("a", { class: "button", href: "#/cambiar-perfil" }, "Escoller perfil")
    );
  }
  if (!gamesEnabled) {
    return el("div", { class: "narrow" }, el("h1", {}, PALABREIRO_TITLE), el("p", { class: "lead" }, "O Palabreiro precisa a base de datos en liña, e esta copia da web non a ten."));
  }
  return null;
}

function statusOf(game, me) {
  if (game.over) {
    const winners = game.winners ?? [];
    if (winners.includes(me)) return winners.length > 1 ? "Rematada: empate!" : "Rematada: gañaches!";
    return `Rematada: gañou ${winners.map(nameOf).join(" e ")}`;
  }
  if (game.resigned.includes(me)) return "Abandonaches esta partida";
  return myTurn(game, me) ? "É a túa quenda!" : `Agardando por ${nameOf(currentPlayer(game))}`;
}

function scoreList(game, me) {
  return el(
    "ul",
    { class: "pb-scores" },
    ...game.players.map((player) => el(
      "li",
      {
        class: [
          !game.over && currentPlayer(game) === player ? "turn" : "",
          game.resigned.includes(player) ? "resigned" : "",
          player === me ? "me" : "",
        ].filter(Boolean).join(" ") || null,
      },
      avatar(profileOf(player)),
      el("span", { class: "pb-name" }, nameOf(player)),
      el("strong", {}, String(game.scores[player]))
    ))
  );
}

// List ------------------------------------------------------------------------

export function palabreiroListView() {
  const blocked = unavailable();
  if (blocked) return blocked;
  const me = activeProfile().id;
  const list = el("div", {}, el("p", { class: "loading" }, "Cargando partidas…"));

  listGames().then((games) => {
    const mine = games.filter((game) => isMine(game, me)).sort((a, b) => b.updatedAt - a.updatedAt);
    const waiting = mine.filter((game) => myTurn(game, me));
    const others = mine.filter((game) => !game.over && !myTurn(game, me));
    const finished = mine.filter((game) => game.over).slice(0, FINISHED_SHOWN);
    const card = (game) => el(
      "a",
      { class: `pb-game-card${myTurn(game, me) ? " your-turn" : ""}`, href: `#/palabreiro/${game.id}` },
      el("span", { class: "pb-status" }, statusOf(game, me)),
      scoreList(game, me)
    );
    const section = (title, items, empty) => el(
      "section",
      { class: "pb-section" },
      el("h2", {}, title),
      items.length ? el("div", { class: "pb-game-grid" }, ...items.map(card)) : el("p", { class: "muted" }, empty)
    );
    replace(
      list,
      section("É a túa quenda", waiting, "Ningunha partida agarda por ti."),
      section("Agardando polos demais", others, "Ningunha."),
      finished.length ? section("Rematadas", finished, "") : null
    );
  }).catch((error) => {
    console.error(error);
    replace(list, el("p", { class: "feedback wrong" }, "Non se puideron cargar as partidas. Comproba a conexión."));
  });

  return el(
    "div",
    { class: "palabreiro" },
    el("h1", {}, PALABREIRO_TITLE),
    el("p", { class: "lead" }, "Forma palabras en galego no taboleiro, por quendas, contra os demais perfís. As casillas L×2 e L×3 multiplican a letra, e P×2 e P×3 a palabra enteira. Usar as sete fichas dunha vez dá 50 puntos máis."),
    el("div", { class: "actions" }, el("a", { class: "button", href: "#/palabreiro/nova" }, "Nova partida")),
    list
  );
}

// New game ----------------------------------------------------------------------

export function palabreiroNewView() {
  const blocked = unavailable();
  if (blocked) return blocked;
  const me = activeProfile().id;
  const chosen = new Set();
  const error = el("p", { class: "feedback wrong", hidden: true, "aria-live": "polite" });
  const start = el("button", { class: "button", type: "submit", disabled: true }, "Comezar partida");

  const options = PROFILES.filter((profile) => profile.id !== me).map((profile) => {
    const button = el("button", {
      class: "profile-option",
      type: "button",
      "aria-pressed": "false",
      onclick() {
        if (chosen.has(profile.id)) chosen.delete(profile.id);
        else chosen.add(profile.id);
        button.setAttribute("aria-pressed", String(chosen.has(profile.id)));
        button.classList.toggle("chosen", chosen.has(profile.id));
        start.disabled = chosen.size === 0;
      },
    }, avatar(profile), profile.name);
    return button;
  });

  async function create(event) {
    event.preventDefault();
    if (!chosen.size) return;
    start.disabled = true;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await writeGame(newGame(id, [me, ...chosen]), null);
      location.hash = `#/palabreiro/${id}`;
    } catch (failure) {
      console.error(failure);
      error.textContent = "Non se puido crear a partida. Comproba a conexión.";
      error.hidden = false;
      start.disabled = false;
    }
  }

  return el(
    "div",
    { class: "narrow" },
    backLink("#/palabreiro", "Volver ás partidas"),
    el(
      "form",
      { class: "panel", onsubmit: create },
      el("h1", {}, "Nova partida"),
      el("p", {}, "Escolle contra quen xogas: unha, dúas ou as tres persoas. A orde das quendas sortéase."),
      el("div", { class: "profile-grid" }, ...options),
      error,
      el("div", { class: "actions" }, start)
    )
  );
}

// Game ------------------------------------------------------------------------------

function describeMove(move) {
  const who = nameOf(move.player);
  if (move.kind === "play") {
    const bonus = move.bonus ? ` (inclúe ${move.bonus} por usar as sete fichas)` : "";
    return `${who}: ${move.words.map((word) => word.toUpperCase()).join(", ")} · +${move.score}${bonus}`;
  }
  if (move.kind === "swap") return `${who} cambiou ${move.count} ${move.count === 1 ? "ficha" : "fichas"}`;
  if (move.kind === "resign") return `${who} abandonou a partida`;
  return `${who} pasou`;
}

function tileFace(tile, extraClass = "") {
  const blank = tile === BLANK || tile !== tile.toLowerCase();
  return el(
    "span",
    { class: `pb-tile${blank ? " blank" : ""}${extraClass}` },
    el("span", { class: "pb-letter" }, tile === BLANK ? "" : tile.toUpperCase()),
    el("span", { class: "pb-points" }, tile === BLANK || blank ? "" : String(value(tile)))
  );
}

export function palabreiroGameView(gameId) {
  const blocked = unavailable();
  if (blocked) return blocked;
  const me = activeProfile().id;
  const root = el("div", { class: "palabreiro" }, backLink("#/palabreiro", "Volver ás partidas"));
  const body = el("div", {}, el("p", { class: "loading" }, "Cargando a partida…"));
  root.append(body);

  let game = null;
  let version = null;
  let rack = [];            // this player's tiles in the order shown, which they can shuffle
  let pending = [];         // [{ index, slot, tile }]: tiles put on the board this turn
  let selected = null;      // the rack slot chosen to place next
  let swapping = null;      // a Set of rack slots while choosing tiles to swap
  let choosingBlank = null; // the board square waiting for the blank's letter
  let busy = false;
  let message = null;

  function resetTurn() {
    rack = [...(game.racks[me] ?? [])];
    pending = [];
    selected = null;
    swapping = null;
    choosingBlank = null;
  }

  async function load() {
    const found = await readGame(gameId);
    if (!found) {
      replace(body, el("p", { class: "lead" }, "Non atopamos esta partida."));
      return false;
    }
    ({ game, version } = found);
    resetTurn();
    return true;
  }

  // Reads the game again, applies a move made by this player and saves it, unless someone
  // saved the game in between.
  async function act(move) {
    if (busy) return;
    busy = true;
    message = null;
    draw();
    try {
      const latest = await readGame(gameId);
      if (latest.version !== version || latest.game.over || currentPlayer(latest.game) !== me) throw new GameChanged();
      move(latest.game);
      version = await writeGame(latest.game, latest.version);
      game = latest.game;
      resetTurn();
    } catch (error) {
      if (error instanceof GameChanged) {
        await load();
        message = { kind: "wrong", text: "A partida cambiou mentres xogabas. Xa tes a versión nova." };
      } else {
        console.error(error);
        message = { kind: "wrong", text: "Non se puido gardar a xogada. Comproba a conexión e tórnao a intentar." };
      }
    }
    busy = false;
    draw();
  }

  async function submitPlay() {
    const placed = pending.map(({ index, tile }) => ({ index, tile }));
    const result = evaluate(game.board, placed);
    if (result.error) return;
    busy = true;
    message = { kind: "note", text: "Comprobando as palabras no dicionario…" };
    draw();
    let unknown;
    try {
      unknown = await unknownWords(result.words.map((word) => word.word));
    } catch (error) {
      console.error(error);
      busy = false;
      message = { kind: "wrong", text: "Non se puido descargar o dicionario. Comproba a conexión." };
      draw();
      return;
    }
    busy = false;
    if (unknown.length) {
      message = {
        kind: "wrong",
        text: `${unknown.length === 1 ? "Esta palabra non está" : "Estas palabras non están"} no dicionario: ${unknown.map((word) => word.toUpperCase()).join(", ")}.`,
      };
      draw();
      return;
    }
    await act((latest) => playMove(latest, me, placed, evaluate(latest.board, placed)));
  }

  function placeAt(index, tile) {
    pending.push({ index, slot: selected, tile });
    selected = null;
    choosingBlank = null;
    draw();
  }

  function clickSquare(index) {
    if (busy || !myTurn(game, me)) return;
    const own = pending.findIndex((tile) => tile.index === index);
    if (own >= 0) {
      pending.splice(own, 1);
      choosingBlank = null;
      draw();
      return;
    }
    if (game.board[index] !== "." || selected === null || swapping) return;
    if (rack[selected] === BLANK) {
      choosingBlank = index;
      draw();
      return;
    }
    placeAt(index, rack[selected]);
  }

  function clickRack(slot) {
    if (busy) return;
    if (swapping) {
      if (swapping.has(slot)) swapping.delete(slot);
      else swapping.add(slot);
    } else {
      selected = selected === slot ? null : slot;
      choosingBlank = null;
    }
    draw();
  }

  function draw() {
    const turn = myTurn(game, me);
    const playing = game.players.includes(me) && !game.resigned.includes(me);
    const used = new Set(pending.map((tile) => tile.slot));
    const preview = pending.length ? evaluate(game.board, pending.map(({ index, tile }) => ({ index, tile }))) : null;

    const squares = [];
    for (let index = 0; index < SIZE * SIZE; index++) {
      const placedTile = game.board[index] !== "." ? game.board[index] : null;
      const mine = pending.find((tile) => tile.index === index);
      const premium = PREMIUM[index];
      const label = placedTile || mine?.tile
        ? (placedTile ?? mine.tile).toUpperCase()
        : premium ? PREMIUM_LABELS[premium] : "baleira";
      squares.push(el(
        "button",
        {
          type: "button",
          class: [
            "pb-square",
            premium ? `pb-${premium}` : "",
            index === CENTER ? "pb-center" : "",
            mine ? "pending" : "",
            choosingBlank === index ? "choosing" : "",
          ].filter(Boolean).join(" "),
          "aria-label": `Fila ${Math.floor(index / SIZE) + 1}, columna ${(index % SIZE) + 1}: ${label}`,
          onclick: () => clickSquare(index),
        },
        placedTile ? tileFace(placedTile)
          : mine ? tileFace(mine.tile, " pending")
            : premium ? el("span", { class: "pb-premium" }, index === CENTER ? "★" : PREMIUM_LABELS[premium]) : null
      ));
    }

    const rackTiles = rack.map((tile, slot) => (used.has(slot) ? null : el(
      "button",
      {
        type: "button",
        class: `pb-rack-tile${selected === slot ? " selected" : ""}${swapping?.has(slot) ? " swap" : ""}`,
        "aria-label": tile === BLANK ? "Comodín" : `Letra ${tile.toUpperCase()}, ${value(tile)} puntos`,
        "aria-pressed": String(selected === slot || Boolean(swapping?.has(slot))),
        disabled: game.over || game.resigned.includes(me),
        onclick: () => clickRack(slot),
      },
      tileFace(tile)
    ))).filter(Boolean);

    const blankPicker = choosingBlank !== null ? el(
      "div",
      { class: "panel pb-blank-picker" },
      el("p", {}, "Que letra vai ser o comodín? Conta 0 puntos."),
      el("div", { class: "pb-letters" }, ...LETTERS.map((letter) => el("button", {
        type: "button",
        class: "button secondary",
        onclick: () => placeAt(choosingBlank, letter.toUpperCase()),
      }, letter.toUpperCase()))),
      el("button", { type: "button", class: "button secondary", onclick() { choosingBlank = null; draw(); } }, "Cancelar")
    ) : null;

    let actions = null;
    if (turn && playing) {
      if (swapping) {
        actions = el(
          "div",
          { class: "actions" },
          el("button", {
            type: "button",
            class: "button",
            disabled: busy || swapping.size === 0,
            onclick: () => {
              const tiles = [...swapping].map((slot) => rack[slot]);
              act((latest) => swapMove(latest, me, tiles));
            },
          }, `Cambiar ${swapping.size} ${swapping.size === 1 ? "ficha" : "fichas"}`),
          el("button", { type: "button", class: "button secondary", onclick() { swapping = null; draw(); } }, "Cancelar")
        );
      } else {
        actions = el(
          "div",
          { class: "actions" },
          el("button", { type: "button", class: "button", disabled: busy || !preview || Boolean(preview.error), onclick: submitPlay }, "Xogar"),
          pending.length ? el("button", { type: "button", class: "button secondary", onclick() { pending = []; draw(); } }, "Recoller") : null,
          el("button", {
            type: "button",
            class: "button secondary",
            disabled: busy || !canSwap(game),
            title: canSwap(game) ? null : "Só se pode cambiar se quedan polo menos 7 fichas na bolsa",
            onclick() { pending = []; selected = null; swapping = new Set(); draw(); },
          }, "Cambiar fichas"),
          el("button", {
            type: "button",
            class: "button secondary",
            disabled: busy,
            onclick() { if (confirm("Pasar a quenda sen xogar?")) act((latest) => passMove(latest, me)); },
          }, "Pasar")
        );
      }
    }

    const previewLine = preview
      ? el("p", { class: preview.error ? "pb-preview wrong" : "pb-preview" }, preview.error ?? `Esta xogada: ${preview.score} puntos${preview.bonus ? " (con 50 por usar as sete fichas)" : ""}`)
      : null;

    const result = game.over ? el(
      "div",
      { class: "panel finish success" },
      el("p", { class: "prompt" }, statusOf(game, me)),
      el("a", { class: "button", href: "#/palabreiro/nova" }, "Nova partida")
    ) : null;

    replace(
      body,
      el(
        "div",
        { class: "pb-header" },
        el("h1", {}, PALABREIRO_TITLE),
        el("p", { class: `pb-status${turn ? " your-turn" : ""}` }, statusOf(game, me)),
        scoreList(game, me),
        el("p", { class: "muted" }, `Quedan ${game.bag.length} ${game.bag.length === 1 ? "ficha" : "fichas"} na bolsa.`)
      ),
      result,
      el("div", { class: "pb-board", role: "grid", "aria-label": "Taboleiro" }, ...squares),
      blankPicker,
      !playing ? null : el(
        "div",
        { class: "pb-rack-row" },
        el("div", { class: "pb-rack", "aria-label": "As túas fichas" }, ...rackTiles),
        el("button", {
          type: "button",
          class: "button secondary pb-shuffle",
          title: "Mesturar as fichas",
          onclick() {
            const order = shuffled(rack.map((_, slot) => slot).filter((slot) => !used.has(slot)));
            const kept = rack.map((tile, slot) => (used.has(slot) ? tile : null));
            const free = order.map((slot) => rack[slot]);
            rack = kept.map((tile) => tile ?? free.shift());
            selected = null;
            draw();
          },
        }, "Mesturar")
      ),
      turn && !swapping ? el("p", { class: "muted pb-help" }, "Toca unha ficha e despois a casilla onde a queres. Toca unha ficha do taboleiro para recollela.") : null,
      swapping ? el("p", { class: "muted pb-help" }, "Escolle as fichas que queres cambiar. Perdes a quenda.") : null,
      previewLine,
      message ? el("p", { class: `feedback ${message.kind === "wrong" ? "wrong" : "right"}`, "aria-live": "polite" }, message.text) : null,
      actions,
      el(
        "details",
        { class: "pb-moves", open: true },
        el("summary", {}, "Últimas xogadas"),
        game.moves.length
          ? el("ol", { reversed: true }, ...game.moves.slice(-12).reverse().map((move) => el("li", {}, describeMove(move))))
          : el("p", { class: "muted" }, "Aínda ninguén xogou.")
      ),
      !game.over && playing && activePlayers(game).length > 1 ? el("button", {
        type: "button",
        class: "button secondary pb-resign",
        disabled: busy,
        onclick() {
          if (confirm("Seguro que queres abandonar esta partida?")) {
            if (myTurn(game, me)) act((latest) => resignMove(latest, me));
            else resignOutOfTurn();
          }
        },
      }, "Abandonar a partida") : null
    );
  }

  // Resigning doesn't wait for the turn, so it saves the game whoever's turn it is.
  async function resignOutOfTurn() {
    busy = true;
    draw();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const latest = await readGame(gameId);
        resignMove(latest.game, me);
        version = await writeGame(latest.game, latest.version);
        game = latest.game;
        break;
      } catch (error) {
        if (!(error instanceof GameChanged)) {
          console.error(error);
          message = { kind: "wrong", text: "Non se puido gardar. Comproba a conexión." };
          break;
        }
      }
    }
    busy = false;
    resetTurn();
    draw();
  }

  // While it is someone else's turn, the game is read again every few seconds.
  const poll = setInterval(async () => {
    if (!root.isConnected) {
      clearInterval(poll);
      return;
    }
    if (busy || !game || document.visibilityState !== "visible" || (myTurn(game, me) && pending.length)) return;
    try {
      const latest = await readGame(gameId);
      if (latest && latest.version !== version) {
        ({ game, version } = latest);
        resetTurn();
        draw();
      }
    } catch (error) {
      console.warn("Non se puido ler a partida", error);
    }
  }, POLL_MS);

  load().then((found) => {
    if (found) {
      if (!game.players.includes(me)) message = { kind: "note", text: "Estás mirando unha partida doutros perfís." };
      draw();
      focusSoon(body.querySelector(".pb-rack-tile"));
    }
  }).catch((error) => {
    console.error(error);
    replace(body, el("p", { class: "feedback wrong" }, "Non se puido cargar a partida. Comproba a conexión."));
  });

  return root;
}
