import { celebrate } from "../ducks.js";
import { crosswordState, saveCrossword } from "../store.js";
import { gridLetter } from "../text.js";
import { backLink, el, focusSoon, LEVELS } from "../ui.js";

const GROUP_TITLES = { 1: "Encrucillados doados", 2: "Encrucillados medios", 3: "Encrucillados difíciles" };

export function crosswordListView(puzzles) {
  const groups = [1, 2, 3].map((level) => {
    const members = puzzles.filter((puzzle) => puzzle.level === level);
    return { level, members, done: members.filter((puzzle) => crosswordState(puzzle.id).done).length };
  });
  const firstOpen = groups.find(({ members, done }) => done < members.length);

  return el(
    "div",
    {},
    el("h1", {}, "Encrucillados"),
    el("p", { class: "lead" }, `Para os máis atrevidos: ${puzzles.length} encrucillados, de máis doado a máis difícil. Serven para descubrir palabras novas, e as pistas van cada vez máis en galego.`),
    ...groups.map(({ level, members, done }) => el(
      "details",
      { class: `group${done === members.length ? " group-done" : ""}`, open: firstOpen?.level === level },
      el(
        "summary",
        {},
        el("h2", {}, GROUP_TITLES[level]),
        el("span", { class: `level level-${level}` }, LEVELS[level]),
        el("span", { class: "group-progress" }, `${done} de ${members.length}`)
      ),
      el(
        "div",
        { class: "lesson-grid" },
        ...members.map((puzzle) => {
          const solved = crosswordState(puzzle.id).done;
          return el(
            "a",
            { class: `lesson-link${solved ? " done" : ""}`, href: `#/encrucillados/${puzzle.id}` },
            el("span", {}, `${puzzle.number}. ${puzzle.title}`, el("small", {}, `${puzzle.entries.length} palabras`)),
            solved ? el("span", { class: "score" }, "✓") : null
          );
        })
      )
    ))
  );
}

export function crosswordView(puzzles, id) {
  const puzzle = puzzles.find((candidate) => candidate.id === id);
  if (!puzzle) return null;

  const saved = crosswordState(id);
  const letters = { ...saved.cells };
  let solved = saved.done;

  const solution = new Map();
  const startNumbers = new Map();
  const cellEntries = new Map();
  for (const entry of puzzle.entries) {
    entry.cells = [...entry.answer].map((letter, index) => {
      const key = `${entry.row + (entry.across ? 0 : index)},${entry.col + (entry.across ? index : 0)}`;
      solution.set(key, letter);
      if (!cellEntries.has(key)) cellEntries.set(key, []);
      cellEntries.get(key).push(entry);
      return key;
    });
    startNumbers.set(entry.cells[0], entry.number);
  }

  const inputs = new Map();
  const wrappers = new Map();
  const clueButtons = new Map();
  let current = puzzle.entries[0];

  const currentClue = el("div", { class: "current-clue", "aria-live": "polite" });
  const message = el("div", { "aria-live": "polite" });

  function persist() {
    saveCrossword(id, { cells: letters, done: solved });
  }

  function entryFilledCorrectly(entry) {
    return entry.cells.every((key) => letters[key] === solution.get(key));
  }

  function refreshClues() {
    for (const [entry, button] of clueButtons) {
      button.classList.toggle("active", entry === current);
      button.classList.toggle("solved", entryFilledCorrectly(entry));
    }
    currentClue.textContent = `${current.number} ${current.across ? "horizontal" : "vertical"}: ${current.clue}`;
    for (const [key, wrapper] of wrappers) {
      wrapper.classList.toggle("in-word", current.cells.includes(key));
    }
  }

  function clearMarks() {
    for (const wrapper of wrappers.values()) wrapper.classList.remove("correct", "incorrect");
  }

  function selectEntry(entry, key) {
    current = entry;
    refreshClues();
    inputs.get(key ?? entry.cells.find((cell) => !letters[cell]) ?? entry.cells[0]).focus();
  }

  // While typing, letters already placed by a crossing word are jumped over, not overwritten.
  // Going back never jumps, so a whole word can be deleted square by square.
  // Returns the square it moved to, or null at the edge of the word.
  function moveWithin(key, step) {
    const isCrossingLetter = (cell) => letters[cell] && cellEntries.get(cell).length > 1;
    let index = current.cells.indexOf(key) + step;
    while (step > 0 && current.cells[index] && isCrossingLetter(current.cells[index])) index += step;
    const target = current.cells[index];
    if (!target) return null;
    inputs.get(target).focus();
    return target;
  }

  function checkFinished() {
    if ([...solution].every(([key, letter]) => letters[key] === letter)) {
      if (!solved) celebrate(true);
      solved = true;
      persist();
      message.replaceChildren(el(
        "div",
        { class: "feedback right" },
        el("p", {}, el("strong", {}, "Parabéns! Encrucillado resolto."))
      ));
    }
  }

  function setLetter(key, letter) {
    if (letter) letters[key] = letter;
    else delete letters[key];
    inputs.get(key).value = letter;
    wrappers.get(key).classList.remove("correct", "incorrect");
    persist();
    refreshClues();
  }

  function switchDirection(key) {
    const entries = cellEntries.get(key);
    if (entries.length > 1) {
      current = entries.find((entry) => entry !== current);
      refreshClues();
    }
  }

  function buildCell(row, col) {
    const key = `${row},${col}`;
    if (!solution.has(key)) return el("div", { class: "cell block" });

    const input = el("input", {
      type: "text",
      value: letters[key] ?? "",
      autocomplete: "off",
      autocapitalize: "characters",
      autocorrect: "off",
      spellcheck: false,
      "aria-label": `Fila ${row + 1}, columna ${col + 1}`,
      onfocus() {
        if (!current.cells.includes(key)) {
          current = cellEntries.get(key)[0];
          refreshClues();
        }
        input.select();
      },
      onclick() {
        if (clickedBefore === key) switchDirection(key);
        clickedBefore = key;
      },
      oninput(event) {
        // Phone keyboards may not report the key press, only the text it adds.
        if (event.data === " ") {
          input.value = letters[key] ?? "";
          input.select();
          switchDirection(key);
          return;
        }
        const letter = gridLetter(input.value);
        setLetter(key, letter);
        if (letter) {
          moveWithin(key, 1);
          checkFinished();
        }
      },
      onkeydown(event) {
        if (event.key === " ") {
          event.preventDefault();
          switchDirection(key);
        } else if (event.key === "Backspace") {
          // A filled square is cleared; an empty one goes back and clears the one before.
          event.preventDefault();
          if (letters[key]) {
            setLetter(key, "");
          } else {
            const previous = moveWithin(key, -1);
            if (previous) setLetter(previous, "");
          }
        } else if (event.key === "Delete") {
          event.preventDefault();
          setLetter(key, "");
        } else if (event.key === "Tab") {
          event.preventDefault();
          const index = puzzle.entries.indexOf(current);
          const step = event.shiftKey ? -1 : 1;
          const count = puzzle.entries.length;
          selectEntry(puzzle.entries[(index + step + count) % count]);
        } else if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          const [dr, dc] = {
            ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
          }[event.key];
          const target = inputs.get(`${row + dr},${col + dc}`);
          if (!target) return;
          const across = dc !== 0;
          const targetKey = `${row + dr},${col + dc}`;
          current = cellEntries.get(targetKey).find((entry) => entry.across === across) ?? cellEntries.get(targetKey)[0];
          refreshClues();
          target.focus();
        }
      },
    });
    inputs.set(key, input);

    const number = startNumbers.get(key);
    const wrapper = el("div", { class: "cell" }, number ? el("span", { class: "number" }, String(number)) : null, input);
    wrappers.set(key, wrapper);
    return wrapper;
  }

  let clickedBefore = null;
  const cells = [];
  for (let row = 0; row < puzzle.rows; row++) {
    for (let col = 0; col < puzzle.cols; col++) cells.push(buildCell(row, col));
  }

  const grid = el("div", { class: "crossword-grid", style: `--cols: ${puzzle.cols}` }, ...cells);

  function clueList(title, across) {
    return [
      el("h2", {}, title),
      el("ol", {}, ...puzzle.entries.filter((entry) => entry.across === across).map((entry) => {
        const button = el("button", {
          class: "clue",
          type: "button",
          onclick: () => selectEntry(entry),
        }, `${entry.number}. ${entry.clue}`);
        clueButtons.set(entry, button);
        return el("li", {}, button);
      })),
    ];
  }

  function checkGrid() {
    clearMarks();
    let wrong = 0;
    for (const [key, letter] of Object.entries(letters)) {
      const isRight = solution.get(key) === letter;
      wrappers.get(key).classList.add(isRight ? "correct" : "incorrect");
      if (!isRight) wrong++;
    }
    const missing = solution.size - Object.keys(letters).length;
    if (!wrong && !missing) {
      checkFinished();
    } else {
      message.replaceChildren(el(
        "div",
        { class: wrong ? "feedback wrong" : "feedback right" },
        el("p", {}, wrong
          ? `Hai ${wrong} ${wrong === 1 ? "letra incorrecta" : "letras incorrectas"}, marcadas en vermello. Faltan ${missing}.`
          : `Todo ben polo de agora. Faltan ${missing} ${missing === 1 ? "letra" : "letras"}.`)
      ));
    }
  }

  function revealCurrent() {
    for (const key of current.cells) setLetter(key, solution.get(key));
    checkFinished();
  }

  function reset() {
    for (const key of solution.keys()) setLetter(key, "");
    solved = false;
    persist();
    message.replaceChildren();
    selectEntry(puzzle.entries[0]);
  }

  const view = el(
    "div",
    {},
    backLink("#/encrucillados", "Volver aos encrucillados"),
    el("h1", {}, `${puzzle.number}. ${puzzle.title}`),
    el(
      "div",
      { class: "crossword-layout" },
      el(
        "div",
        {},
        currentClue,
        grid,
        message,
        el(
          "div",
          { class: "actions" },
          el("button", { class: "button", type: "button", onclick: checkGrid }, "Comprobar"),
          el("button", { class: "button secondary", type: "button", onclick: revealCurrent }, "Revelar palabra"),
          el("button", { class: "button secondary", type: "button", onclick: reset }, "Borrar todo")
        )
      ),
      el("div", { class: "clues" }, ...clueList("Horizontais", true), ...clueList("Verticais", false))
    )
  );

  refreshClues();
  if (solved) {
    message.replaceChildren(el("div", { class: "feedback right" }, el("p", {}, el("strong", {}, "Xa resolviches este encrucillado."))));
  }
  focusSoon(inputs.get(current.cells[0]));
  return view;
}
