// Palabreiro: the rules of the word board game, with no screen or network code, so every
// player's browser computes the same moves and scores.
//
// The board is a 225-character string, row by row: "." for an empty square, a lowercase
// letter for a tile, and an uppercase letter for a blank tile played as that letter.
// A rack holds lowercase letters and "?" for each blank.

export const SIZE = 15;
export const CENTER = 7 * SIZE + 7;
export const RACK_SIZE = 7;
export const ALL_TILES_BONUS = 50;
export const BLANK = "?";

// Letters of the Galician alphabet, with how many tiles of each and their points.
export const TILES = {
  a: [13, 1], e: [12, 1], o: [10, 1], s: [7, 1], r: [6, 1], n: [6, 1], i: [6, 1],
  l: [4, 1], t: [4, 1], u: [4, 1], d: [5, 2], c: [4, 2],
  m: [3, 3], p: [2, 3], g: [2, 3], b: [2, 3],
  x: [2, 4], v: [1, 4], f: [1, 4], h: [1, 5],
  z: [1, 6], q: [1, 8], ñ: [1, 8],
  [BLANK]: [2, 0],
};
export const LETTERS = Object.keys(TILES).filter((letter) => letter !== BLANK);

// Squares that multiply: a letter by two or three, or the whole word by two or three.
// Listed for the top-left quarter and mirrored to the other three.
const QUARTER = {
  pt: [[0, 3], [3, 0]],
  pd: [[1, 2], [2, 1], [4, 5], [5, 4], [7, 7]],
  lt: [[0, 0], [1, 6], [6, 1], [5, 5]],
  ld: [[0, 7], [7, 0], [2, 4], [4, 2], [3, 7], [7, 3], [6, 6]],
};

export const PREMIUM = (() => {
  const squares = {};
  for (const [kind, cells] of Object.entries(QUARTER)) {
    for (const [row, col] of cells) {
      for (const r of [row, SIZE - 1 - row]) {
        for (const c of [col, SIZE - 1 - col]) squares[r * SIZE + c] = kind;
      }
    }
  }
  return squares;
})();

export const PREMIUM_LABELS = { ld: "L×2", lt: "L×3", pd: "P×2", pt: "P×3" };

export const value = (tile) => (tile === tile.toLowerCase() ? TILES[tile]?.[1] ?? 0 : 0);
export const rackValue = (rack) => rack.reduce((total, tile) => total + (tile === BLANK ? 0 : value(tile)), 0);

export function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function draw(game, playerId) {
  const rack = game.racks[playerId];
  while (rack.length < RACK_SIZE && game.bag.length) rack.push(game.bag.pop());
}

// Players take turns in a random order.
export function newGame(id, playerIds) {
  const bag = shuffled(Object.entries(TILES).flatMap(([letter, [count]]) => Array(count).fill(letter)));
  const players = shuffled(playerIds);
  const game = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players,
    racks: Object.fromEntries(players.map((player) => [player, []])),
    scores: Object.fromEntries(players.map((player) => [player, 0])),
    resigned: [],
    bag,
    board: ".".repeat(SIZE * SIZE),
    turn: 0,
    passes: 0,
    moves: [],
    over: false,
  };
  for (const player of players) draw(game, player);
  return game;
}

export const currentPlayer = (game) => game.players[game.turn];
export const activePlayers = (game) => game.players.filter((player) => !game.resigned.includes(player));

const rowOf = (index) => Math.floor(index / SIZE);
const colOf = (index) => index % SIZE;

// The run of tiles through `index` along a direction (1 across, SIZE down).
function wordAt(cells, index, step) {
  const sameLine = (a, b) => (step === 1 ? rowOf(a) === rowOf(b) : true);
  let start = index;
  while (start - step >= 0 && sameLine(start - step, index) && cells[start - step] !== ".") start -= step;
  const positions = [];
  for (let at = start; at < cells.length && sameLine(at, index) && cells[at] !== "."; at += step) positions.push(at);
  return positions;
}

function scoreWord(cells, positions, fresh) {
  let total = 0;
  let times = 1;
  for (const at of positions) {
    let points = value(cells[at]);
    if (fresh.has(at)) {
      if (PREMIUM[at] === "ld") points *= 2;
      if (PREMIUM[at] === "lt") points *= 3;
      if (PREMIUM[at] === "pd") times *= 2;
      if (PREMIUM[at] === "pt") times *= 3;
    }
    total += points;
  }
  return total * times;
}

// `placed` is [{ index, tile }], where `tile` is a board character. Returns
// { words: [{ word, score }], score } or { error } in Galician, without checking the dictionary.
export function evaluate(board, placed) {
  if (!placed.length) return { error: "Pon algunha ficha no taboleiro." };
  const indexes = placed.map((tile) => tile.index);
  if (indexes.some((index) => board[index] !== ".") || new Set(indexes).size !== indexes.length) {
    return { error: "Hai fichas enriba doutras." };
  }
  const sameRow = indexes.every((index) => rowOf(index) === rowOf(indexes[0]));
  const sameCol = indexes.every((index) => colOf(index) === colOf(indexes[0]));
  if (!sameRow && !sameCol) return { error: "As fichas teñen que ir nunha mesma fila ou columna." };

  const cells = board.split("");
  for (const { index, tile } of placed) cells[index] = tile;
  const fresh = new Set(indexes);
  const step = placed.length === 1
    ? (wordAt(cells, indexes[0], 1).length > 1 ? 1 : SIZE)
    : (sameRow ? 1 : SIZE);
  const main = wordAt(cells, indexes[0], step);
  if (!indexes.every((index) => main.includes(index))) return { error: "As fichas teñen que formar unha palabra seguida, sen ocos." };

  const firstMove = board.split("").every((cell) => cell === ".");
  if (firstMove) {
    if (!fresh.has(CENTER)) return { error: "A primeira palabra ten que pasar pola casilla do centro." };
    if (main.length < 2) return { error: "A primeira palabra ten que ter polo menos dúas letras." };
  } else {
    const touches = main.some((at) => !fresh.has(at)) || indexes.some((index) => {
      const neighbours = [index - SIZE, index + SIZE];
      if (colOf(index) > 0) neighbours.push(index - 1);
      if (colOf(index) < SIZE - 1) neighbours.push(index + 1);
      return neighbours.some((at) => at >= 0 && at < cells.length && board[at] !== ".");
    });
    if (!touches) return { error: "A palabra ten que tocar as fichas que xa hai no taboleiro." };
  }

  const runs = [];
  if (main.length > 1) runs.push(main);
  const across = step === 1 ? SIZE : 1;
  for (const index of indexes) {
    const cross = wordAt(cells, index, across);
    if (cross.length > 1) runs.push(cross);
  }
  if (!runs.length) return { error: "Tes que formar unha palabra de polo menos dúas letras." };

  const words = runs.map((positions) => ({
    word: positions.map((at) => cells[at].toLowerCase()).join(""),
    score: scoreWord(cells, positions, fresh),
  }));
  const bonus = placed.length === RACK_SIZE ? ALL_TILES_BONUS : 0;
  return { words, bonus, score: words.reduce((total, word) => total + word.score, 0) + bonus };
}

function nextTurn(game) {
  if (game.over) return;
  for (let step = 1; step <= game.players.length; step++) {
    const turn = (game.turn + step) % game.players.length;
    if (!game.resigned.includes(game.players[turn])) {
      game.turn = turn;
      return;
    }
  }
}

// The game ends when someone uses their last tile with the bag empty, when every player has
// gone two turns in a row without scoring, or when only one player is left.
function finish(game, closer) {
  game.over = true;
  if (closer) {
    let gained = 0;
    for (const player of activePlayers(game)) {
      if (player === closer) continue;
      const left = rackValue(game.racks[player]);
      game.scores[player] -= left;
      gained += left;
    }
    game.scores[closer] += gained;
  } else {
    for (const player of activePlayers(game)) game.scores[player] -= rackValue(game.racks[player]);
  }
  const standing = activePlayers(game);
  const best = Math.max(...standing.map((player) => game.scores[player]));
  game.winners = standing.filter((player) => game.scores[player] === best);
}

function log(game, move) {
  game.moves.push({ ...move, at: Date.now() });
  game.updatedAt = Date.now();
}

function scoreless(game) {
  game.passes++;
  if (game.passes >= 2 * activePlayers(game).length) finish(game, null);
  else nextTurn(game);
}

// The moves change `game` in place. They assume the move was checked with evaluate().
export function playMove(game, player, placed, result) {
  const rack = game.racks[player];
  const cells = game.board.split("");
  for (const { index, tile } of placed) {
    cells[index] = tile;
    const used = tile === tile.toLowerCase() ? tile : BLANK;
    rack.splice(rack.indexOf(used), 1);
  }
  game.board = cells.join("");
  game.scores[player] += result.score;
  game.passes = 0;
  draw(game, player);
  log(game, { player, kind: "play", words: result.words.map((word) => word.word), score: result.score, bonus: result.bonus });
  if (!rack.length && !game.bag.length) finish(game, player);
  else nextTurn(game);
}

export function passMove(game, player) {
  log(game, { player, kind: "pass", score: 0 });
  scoreless(game);
}

// Swapping needs a full rack's worth of tiles left in the bag.
export function canSwap(game) {
  return game.bag.length >= RACK_SIZE;
}

export function swapMove(game, player, tiles) {
  const rack = game.racks[player];
  for (const tile of tiles) rack.splice(rack.indexOf(tile), 1);
  draw(game, player);
  game.bag = shuffled([...game.bag, ...tiles]);
  log(game, { player, kind: "swap", count: tiles.length, score: 0 });
  scoreless(game);
}

export function resignMove(game, player) {
  game.resigned.push(player);
  log(game, { player, kind: "resign", score: 0 });
  if (activePlayers(game).length <= 1) {
    game.over = true;
    game.winners = activePlayers(game);
  } else if (currentPlayer(game) === player) {
    nextTurn(game);
  }
}
