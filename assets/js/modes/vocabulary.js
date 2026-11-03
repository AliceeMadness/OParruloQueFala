import { addMistake, clearMistake } from "../store.js";
import { checkAnswer } from "../text.js";
import { answerInput, backLink, collectButton, el, findLesson, finishPanel, focusSoon, progressBar, replace, wordTable } from "../ui.js";

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

const collectWord = (word) => collectButton("words", word.es, word.gl);
const rememberWord = (word) => ({ kind: "words", id: word.es, value: word.gl });

// Words answered wrong come back at the end of the queue until they are right.
// A word is { es, gl }, plus `hint` and `lang` when the prompt isn't a Spanish word.
// `remember(word)` says what the review keeps of a word answered wrong: { kind, id, value }.
// It leaves the review once answered right without failing it in the same go.
export function runWords(container, { words, title, key, backHref, backText, nextHref, restart, collect = collectWord, remember = rememberWord }) {
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
    const input = answerInput({ "aria-label": `«${word.es}» en galego` });
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
      const memo = remember(word);
      if (result.ok) {
        cleared++;
        input.classList.add("right");
        if (!failed.has(memo.id)) clearMistake(memo.kind, memo.id);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback right" },
          el("p", {}, el("strong", { lang: "gl" }, word.gl[0])),
          result.note ? el("p", {}, NOTES[result.note]) : null,
          word.gl.length > 1 ? el("p", {}, `Tamén vale: ${word.gl.slice(1).join(", ")}`) : null
        ));
      } else {
        queue.push(word);
        failed.set(memo.id, word);
        addMistake(memo.kind, memo.id, memo.value);
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
        el("p", { class: "prompt-label" }, word.hint ?? title),
        el("p", { class: "prompt", lang: word.lang ?? "es" }, word.es),
        input,
        feedback,
        el("div", { class: "actions" }, check, collect(word))
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
