// The review: what the player got wrong in vocabulary, verbs and grammar, wherever it was
// (lessons, the exam or the collection), until they get it right.
import { mistakeCount, mistakes } from "../store.js";
import { backLink, el, finishPanel, replace } from "../ui.js";
import { grammarQuestion, runQuestions, verbQuestion, wordQuestion } from "./questions.js";

const REVIEW_SIZE = 20;

// Oldest first, taking from each part in turn so a long list of words doesn't hide the rest.
function pickQuestions() {
  const pools = [
    mistakes("words").map(({ id, value }) => wordQuestion(id, value)),
    mistakes("verbs").map(({ id, value }) => verbQuestion(id, value)),
    mistakes("grammar").map(({ value }) => grammarQuestion(value)),
  ];
  const picked = [];
  for (let index = 0; picked.length < REVIEW_SIZE && pools.some((pool) => index < pool.length); index++) {
    for (const pool of pools) {
      if (index < pool.length && picked.length < REVIEW_SIZE) picked.push(pool[index]);
    }
  }
  return picked;
}

export function reviewView() {
  const container = el("div", {});

  function start() {
    if (!mistakeCount()) {
      replace(
        container,
        el("h1", {}, "Repaso"),
        el("p", { class: "lead" }, "Non tes nada pendente. O que falles no vocabulario, nos verbos ou na gramática aparecerá aquí ata que o acertes."),
        el("a", { class: "button", href: "#/" }, "Volver ao inicio")
      );
      return;
    }
    const questions = pickQuestions();
    runQuestions(container, questions, {
      repeat: true,
      onFinish: (failed) => replace(container, finishPanel({
        total: questions.length,
        failed: failed.length,
        failedRows: failed.map((question) => question.failedRow),
        backHref: "#/",
        backText: "Volver ao inicio",
        restart: start,
      })),
    });
  }

  start();
  return el("div", { class: "narrow" }, backLink("#/", "Volver ao inicio"), container);
}
