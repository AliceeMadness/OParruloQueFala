// Dudoiro: words where it is easy to doubt whether there is an «i», such as «neveira» but
// «lavadora». Rounds of 20 random words; each one is chosen between the right spelling and
// the same word with an «i» too many or too few.
import { countEvent } from "../store.js";
import { shuffled } from "../text.js";
import { backLink, el, finishPanel, focusSoon, progressBar, replace } from "../ui.js";

export const DUDOIRO_TITLE = "Dudoiro";
const ROUND_SIZE = 20;

// Words are dealt from a shuffled deck, so no word repeats until all of them have come up.
let deck = [];

function deal(words) {
  const round = [];
  while (round.length < Math.min(ROUND_SIZE, words.length)) {
    if (!deck.length) deck = shuffled(words);
    const word = deck.pop();
    if (!round.includes(word)) round.push(word);
  }
  return round;
}

// «-eiro», «-oira» and the like.
const hasI = (word) => /[eo]ir/.test(word.gl);

// Words answered wrong come back at the end of the round until they are right.
function runRound(container, words, restart) {
  const round = deal(words);
  const queue = [...round];
  const failed = new Set();
  let cleared = 0;

  function showWord() {
    if (!queue.length) {
      countEvent("dudoiro");
      if (!failed.size) countEvent("dudoiroPerfecto");
      replace(container, finishPanel({
        total: round.length,
        failed: failed.size,
        failedRows: [...failed].map((word) => [word.es, word.gl]),
        backHref: "#/",
        backText: "Volver ao inicio",
        restart,
      }));
      return;
    }

    const word = queue[0];
    const feedback = el("div", { "aria-live": "polite" });
    const next = el("button", { class: "button", type: "button", onclick: showWord });
    const actions = el("div", { class: "actions" });

    function choose(button, option) {
      queue.shift();
      for (const other of options) {
        other.disabled = true;
        if (other.textContent === word.gl) other.classList.add("right");
      }
      const tip = hasI(word) ? "Leva «i»." : "Sen «i», coma en castelán.";
      if (option === word.gl) {
        cleared++;
        feedback.replaceChildren(el("div", { class: "feedback right" }, el("p", {}, el("strong", {}, "Correcto! "), tip)));
      } else {
        button.classList.add("wrong");
        failed.add(word);
        queue.push(word);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback wrong" },
          el("p", {}, "Escríbese ", el("strong", { lang: "gl" }, word.gl), ". ", tip)
        ));
      }
      next.textContent = queue.length ? "Seguinte" : "Rematar";
      actions.replaceChildren(next);
      focusSoon(next);
    }

    const options = shuffled([word.gl, word.trap]).map((option) => {
      const button = el("button", { class: "option", type: "button", lang: "gl" }, option);
      button.addEventListener("click", () => choose(button, option));
      return button;
    });

    replace(
      container,
      progressBar(cleared, round.length),
      el(
        "div",
        { class: "panel" },
        el("p", { class: "prompt-label" }, failed.has(word) ? "Outra vez · Con «i» ou sen ela?" : "Con «i» ou sen ela?"),
        el("p", { class: "prompt", lang: "es" }, word.es),
        el("div", { class: "options" }, ...options),
        feedback,
        actions
      )
    );
    focusSoon(options[0]);
  }

  showWord();
}

export function dudoiroView(words) {
  const container = el("div", {});
  const start = () => runRound(container, words, start);
  const begin = el("button", { class: "button", type: "button", onclick: start }, "Comezar");
  const withI = words.filter(hasI).length;
  replace(container, el(
    "div",
    { class: "panel" },
    el("p", { class: "prompt-label" }, "Con «i» ou sen ela?"),
    el("h1", {}, DUDOIRO_TITLE),
    el("p", {}, "«Neveira», pero «lavadora». «Loureiro», pero «primavera». Dámosche a palabra en castelán e ti escolles como se escribe en galego."),
    el("p", { class: "muted" }, `Roldas de ${ROUND_SIZE} palabras ao chou entre ${words.length}: ${withI} levan «i» e ${words.length - withI} non. O que falles volverá saír ao final ata que o acertes.`),
    el("div", { class: "actions" }, begin)
  ));
  focusSoon(begin);
  return el("div", { class: "narrow" }, backLink("#/", "Volver ao inicio"), container);
}
