import { collection, removeFromCollection } from "../store.js";
import { shuffled } from "../text.js";
import { backLink, collectButton, el, replace } from "../ui.js";
import { runSentences } from "./grammar.js";
import { runWords } from "./vocabulary.js";

const STUDY_SIZE = 20;

function verbName(value) {
  return value.es === value.verb ? value.verb : `${value.verb} (${value.es})`;
}

function filledSentence(item) {
  return item.text.replace("___", item.answer);
}

// Each section lists its saved items as [Spanish or context, Galician] and studies them.
const SECTIONS = {
  vocabulario: {
    kind: "words",
    title: "Vocabulario",
    empty: "Nas leccións de vocabulario, preme «Engadir á miña colección» nas palabras que non saibas.",
    row: ({ id, value }) => [el("td", {}, id), el("td", { lang: "gl" }, value.join(" / "))],
    studies: [{ path: "vocabulario", label: "Estudar o vocabulario" }],
  },
  verbos: {
    kind: "verbs",
    title: "Verbos",
    empty: "Nas leccións de verbos, preme o «+» ao lado de cada persoa para gardar só as formas que non saibas.",
    row: ({ value }) => [
      el("td", {}, el("span", { lang: "gl" }, verbName(value)), el("small", { class: "muted" }, ` · ${value.tense}`)),
      el("td", { lang: "gl" }, `${value.person} ${value.form}`),
    ],
    studies: [{ path: "verbos", label: "Estudar os verbos" }],
  },
  gramatica: {
    kind: "grammar",
    title: "Gramática",
    empty: "Nas leccións de gramática, preme «Engadir á miña colección» nas frases que che custen.",
    row: ({ value }) => [el("td", { lang: "gl" }, filledSentence(value)), el("td", { lang: "gl" }, value.answer)],
    studies: [
      { path: "gramatica/facil", label: "Estudar en modo fácil" },
      { path: "gramatica/dificil", label: "Estudar en modo difícil", secondary: true },
    ],
  },
};

function section(name, redraw) {
  const { kind, title, empty, row, studies } = SECTIONS[name];
  const saved = collection(kind);
  return el(
    "section",
    { class: "collection-section" },
    el("h2", {}, title, el("small", {}, `${saved.length} gardadas`)),
    saved.length
      ? el(
          "div",
          {},
          el("div", { class: "actions" }, ...studies.map(({ path, label, secondary }) =>
            el("a", { class: `button${secondary ? " secondary" : ""}`, href: `#/coleccion/${path}` }, label)
          )),
          el("table", { class: "word-table collection-table" }, el("tbody", {}, ...saved.map((entry) => el(
            "tr",
            {},
            ...row(entry),
            el("td", {}, el("button", {
              class: "remove",
              type: "button",
              title: "Quitar da colección",
              "aria-label": "Quitar da colección",
              onclick() {
                removeFromCollection(kind, entry.id);
                redraw();
              },
            }, "✕"))
          ))))
        )
      : el("p", { class: "muted" }, empty)
  );
}

export function collectionView() {
  const view = el("div", { class: "narrow" });
  function draw() {
    replace(
      view,
      el("h1", {}, "A miña colección"),
      el("p", { class: "lead" }, `O que gardas porque aínda non o sabes. Estúdao de ${STUDY_SIZE} en ${STUDY_SIZE}, en orde aleatoria: queda aquí ata que o quites.`),
      ...Object.keys(SECTIONS).map((name) => section(name, draw))
    );
  }
  draw();
  return view;
}

// `name` is a section of SECTIONS; grammar also takes "facil" or "dificil".
export function collectionStudyView(name, level) {
  const known = SECTIONS[name];
  if (!known || (name === "gramatica" ? !["facil", "dificil"].includes(level) : level)) return null;
  const container = el("div", {});
  const common = { title: "Estuda a túa colección", backHref: "#/coleccion", backText: "Volver á colección" };

  function start() {
    const picked = shuffled(collection(known.kind)).slice(0, STUDY_SIZE);
    if (!picked.length) {
      location.hash = "#/coleccion";
      return;
    }
    if (name === "vocabulario") {
      runWords(container, { ...common, restart: start, words: picked.map(({ id, value }) => ({ es: id, gl: value })) });
    } else if (name === "verbos") {
      runWords(container, {
        ...common,
        restart: start,
        remember: (word) => ({ kind: "verbs", id: word.id, value: word.value }),
        words: picked.map(({ id, value }) => ({
          id,
          value,
          es: `${value.person} · ${value.verb}`,
          lang: "gl",
          hint: `${value.tense}${value.es === value.verb ? "" : ` · ${value.es}`}`,
          gl: [value.form],
        })),
        collect: (word) => collectButton("verbs", word.id, word.value),
      });
    } else {
      runSentences(container, { ...common, restart: start, hard: level === "dificil", items: picked.map(({ value }) => value) });
    }
  }

  start();
  return el("div", { class: "narrow" }, backLink("#/coleccion", "Volver á colección"), container);
}
