import { addMistake, addToCollection, clearMistake, collection, inCollection, mistakes, removeFromCollection } from "../store.js";
import { checkAnswer, shuffled } from "../text.js";
import { answerInput, backLink, el, findLesson, finishPanel, focusSoon, progressBar, replace, wordTable } from "../ui.js";

const NOTES = {
  accent: "Ollo: fíxate nos tiles.",
  article: "Lembra o artigo: forma parte do que hai que aprender.",
};

export function vocabularyMode(themes) {
  return {
    path: "vocabulario",
    title: "Vocabulario",
    intro: "Dámosche a palabra en castelán e ti escríbela en galego. Os temas van de menos a máis difíciles, e cada lección ten como máximo 20 palabras.",
    groups: themes,
    describe: (lesson) => `${lesson.words.length} palabras`,
  };
}

// Adds a word the player doesn't know yet to their collection, or takes it out.
function collectionButton(word) {
  const button = el("button", { class: "button secondary collect", type: "button" });
  function draw() {
    const added = inCollection(word);
    button.textContent = added ? "✓ Na miña colección" : "Engadir á miña colección";
    button.setAttribute("aria-pressed", String(added));
  }
  button.addEventListener("click", () => {
    if (inCollection(word)) removeFromCollection(word);
    else addToCollection(word);
    draw();
  });
  draw();
  return button;
}

// Words answered wrong come back at the end of the queue until they are right.
function runWords(container, { words, title, key, backHref, backText, nextHref, restart }) {
  const queue = [...words];
  const failed = new Map();
  let cleared = 0;

  function showWord() {
    if (!queue.length) {
      replace(container, finishPanel({
        key,
        total: words.length,
        failed: failed.size,
        failedRows: [...failed.values()].map((word) => [word.es, word.gl[0]]),
        backHref,
        backText,
        nextHref,
        restart,
      }));
      return;
    }

    const word = queue[0];
    const input = answerInput({ "aria-label": `«${word.es}» en gallego` });
    const feedback = el("div", { "aria-live": "polite" });
    const check = el("button", { class: "button", type: "submit" }, "Comprobar");

    let answered = false;
    function advance() {
      showWord();
    }

    function submit(event) {
      event.preventDefault();
      if (answered) {
        advance();
        return;
      }
      if (!input.value.trim()) return;
      answered = true;
      input.readOnly = true;
      queue.shift();

      const result = checkAnswer(input.value, word.gl);
      if (result.ok) {
        cleared++;
        input.classList.add("right");
        if (!failed.has(word.es)) clearMistake(word);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback right" },
          el("p", {}, el("strong", { lang: "gl" }, word.gl[0])),
          result.note ? el("p", {}, NOTES[result.note]) : null,
          word.gl.length > 1 ? el("p", {}, `Tamén vale: ${word.gl.slice(1).join(", ")}`) : null
        ));
      } else {
        queue.push(word);
        failed.set(word.es, word);
        addMistake(word);
        input.classList.add("wrong");
        feedback.replaceChildren(el(
          "div",
          { class: "feedback wrong" },
          el("p", {}, "A resposta é:"),
          el("p", {}, el("strong", { lang: "gl" }, word.gl.join(" / ")))
        ));
      }
      check.textContent = queue.length ? "Seguinte" : "Rematar";
    }

    replace(
      container,
      progressBar(cleared, words.length),
      el(
        "form",
        { class: "panel", onsubmit: submit },
        el("p", { class: "prompt-label" }, title),
        el("p", { class: "prompt", lang: "es" }, word.es),
        input,
        feedback,
        el("div", { class: "actions" }, check, collectionButton(word))
      )
    );
    focusSoon(input);
  }

  showWord();
}

export function vocabularyLessonView(mode, groupId, lessonId) {
  const found = findLesson(mode, groupId, lessonId);
  if (!found) return null;
  const { group, lesson, key, backHref, nextHref } = found;
  const container = el("div", {});

  function start() {
    runWords(container, {
      words: lesson.words,
      title: "Escríbeo en galego",
      key,
      backHref,
      backText: "Volver ás leccións",
      nextHref,
      restart: start,
    });
  }

  const begin = el("button", { class: "button", type: "button", onclick: start }, "Comezar");
  replace(
    container,
    el(
      "div",
      { class: "panel" },
      el("p", { class: "prompt-label" }, group.title),
      el("h1", {}, lesson.title),
      el("div", { class: "actions" }, begin),
      el(
        "details",
        { style: "margin-top: 1rem" },
        el("summary", {}, `Ver as ${lesson.words.length} palabras antes de comezar`),
        wordTable(lesson.words.map((word) => [word.es, word.gl.join(" / ")]))
      )
    )
  );
  focusSoon(begin);

  return el("div", { class: "narrow" }, backLink(backHref, "Volver ás leccións"), container);
}

export function reviewView() {
  const container = el("div", {});
  function start() {
    if (!mistakes().length) {
      replace(
        container,
        el("h1", {}, "Repaso"),
        el("p", { class: "lead" }, "Non tes palabras pendentes. As que falles no vocabulario aparecerán aquí."),
        el("a", { class: "button", href: "#/vocabulario" }, "Ir ao vocabulario")
      );
      return;
    }
    runWords(container, {
      words: mistakes().slice(0, 20),
      title: "Repaso dos teus fallos",
      backHref: "#/",
      backText: "Volver ao inicio",
      restart: start,
    });
  }
  start();
  return el("div", { class: "narrow" }, backLink("#/", "Volver ao inicio"), container);
}

const STUDY_SIZE = 20;

export function collectionView() {
  const view = el("div", { class: "narrow" });

  function draw() {
    const words = collection();
    if (!words.length) {
      replace(
        view,
        el("h1", {}, "A miña colección"),
        el("p", { class: "lead" }, "Aínda non gardaches ningunha palabra. No vocabulario, preme «Engadir á miña colección» nas palabras que non saibas, e aparecerán aquí para estudalas."),
        el("a", { class: "button", href: "#/vocabulario" }, "Ir ao vocabulario")
      );
      return;
    }
    replace(
      view,
      el("h1", {}, "A miña colección"),
      el("p", { class: "lead" }, `Tes ${words.length} ${words.length === 1 ? "palabra gardada" : "palabras gardadas"}. Estúdaas de ${STUDY_SIZE} en ${STUDY_SIZE}, en orde aleatoria. Quedan na colección ata que as quites.`),
      el("div", { class: "actions" }, el("a", { class: "button", href: "#/coleccion/estudar" }, "Estudar a colección")),
      el("table", { class: "word-table collection-table" }, el("tbody", {}, ...words.map((word) => el(
        "tr",
        {},
        el("td", {}, word.es),
        el("td", { lang: "gl" }, word.gl.join(" / ")),
        el("td", {}, el("button", {
          class: "remove",
          type: "button",
          title: "Quitar da colección",
          "aria-label": `Quitar «${word.es}» da colección`,
          onclick() {
            removeFromCollection(word);
            draw();
          },
        }, "✕"))
      ))))
    );
  }

  draw();
  return view;
}

export function collectionStudyView() {
  const container = el("div", {});
  function start() {
    const words = collection();
    if (!words.length) {
      location.hash = "#/coleccion";
      return;
    }
    runWords(container, {
      words: shuffled(words).slice(0, STUDY_SIZE),
      title: "Estuda a túa colección",
      backHref: "#/coleccion",
      backText: "Volver á colección",
      restart: start,
    });
  }
  start();
  return el("div", { class: "narrow" }, backLink("#/coleccion", "Volver á colección"), container);
}
