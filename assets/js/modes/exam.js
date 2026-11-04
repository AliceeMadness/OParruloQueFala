// "Non hai que esquecer o aprendido": an exam of random questions from the vocabulary, verb
// and grammar lessons the profile has already done, with a reminder every few days.
import { celebrate, duckOf } from "../ducks.js";
import { activeProfile, bestScore, countEvent, examSeen, lastExamAt, markExamSeen, mistakeCount, recordExam } from "../store.js";
import { EXAM_FRESH_MS } from "../sync.js";
import { shuffled } from "../text.js";
import { backLink, el, focusSoon, replace, wordTable } from "../ui.js";
import { grammarQuestion, runQuestions, verbQuestion, wordQuestion } from "./questions.js";
import { verbFormId, verbFormValue } from "./verbs.js";

export const EXAM_TITLE = "Non hai que esquecer o aprendido";
const EXAM_SIZE = 20;
const EXAM_EVERY_MS = 3 * 86400000;
const MIN_DONE_LESSONS = 3;
const SUCCESS = 80;

function doneLessons(mode) {
  return mode.groups.flatMap((group) => group.lessons
    .filter((lesson) => bestScore(`${mode.path}/${group.id}/${lesson.id}`) !== undefined)
    .map((lesson) => ({ group, lesson })));
}

function doneCount(site) {
  return [site.vocabulary, site.verbs, site.grammar].reduce((total, mode) => total + doneLessons(mode).length, 0);
}

export function examAvailable(site) {
  return doneCount(site) >= MIN_DONE_LESSONS;
}

// Shown on the home page once enough days have passed since the last finished exam.
export function examDue(site) {
  return examAvailable(site) && Date.now() - lastExamAt() >= EXAM_EVERY_MS;
}

function vocabularyQuestions(site) {
  return doneLessons(site.vocabulary).flatMap(({ lesson }) => lesson.words.map((word) => wordQuestion(word.es, word.gl)));
}

function verbQuestions(site) {
  const data = site.verbData;
  // Periphrases are sentences with a gap, and the imperative leaves some persons empty.
  return doneLessons(site.verbs).flatMap(({ lesson }) => (lesson.items
    ? lesson.items.map((item) => grammarQuestion(item, lesson.title))
    : lesson.verbs.flatMap((name) => data.persons
      .map((_, index) => index)
      .filter((index) => data.verbs[name].forms[lesson.tense][index])
      .map((index) => verbQuestion(
        verbFormId(name, lesson.tense, index),
        verbFormValue(data, name, lesson.tense, index)
      )))
  ));
}

function grammarQuestions(site) {
  return doneLessons(site.grammar).flatMap(({ lesson }) => lesson.items.map((item) => grammarQuestion(item, lesson.title)));
}

// Takes from each part in turn, so the exam mixes vocabulary, verbs and grammar even
// when one of them has many more lessons done. When few questions are left that haven't
// come up recently, the exam is shorter rather than repeat any.
function pickQuestions(site) {
  const since = Date.now() - EXAM_FRESH_MS;
  const used = new Set(Object.entries(examSeen()).filter(([, at]) => at >= since).map(([key]) => key));
  const fits = (question) => question.keys.every((key) => !used.has(key)) && !used.has(question.family);
  const pools = [vocabularyQuestions(site), verbQuestions(site), grammarQuestions(site)].map(shuffled);
  const picked = [];
  let added = true;
  while (picked.length < EXAM_SIZE && added) {
    added = false;
    for (const pool of pools) {
      if (picked.length >= EXAM_SIZE) break;
      let question = pool.pop();
      while (question && !fits(question)) question = pool.pop();
      if (!question) continue;
      picked.push(question);
      for (const key of [...question.keys, question.family]) if (key) used.add(key);
      added = true;
    }
  }
  return shuffled(picked);
}

function runExam(container, site) {
  const questions = pickQuestions(site);

  if (!questions.length) {
    const home = el("a", { class: "button", href: "#/" }, "Volver ao inicio");
    replace(container, el(
      "div",
      { class: "panel" },
      el("p", { class: "prompt-label" }, "Exame"),
      el("p", { class: "prompt" }, "Por agora xa respondiches todo o que aprendiches."),
      el("p", {}, "Fai máis leccións para ter preguntas novas, ou volve dentro dun anaco."),
      el("div", { class: "actions" }, home)
    ));
    focusSoon(home);
    return;
  }

  function finish(failed) {
    recordExam();
    countEvent("exames");
    if (!failed.length) countEvent("examesPerfectos");
    const right = questions.length - failed.length;
    const percent = Math.round((right * 100) / questions.length);
    const success = percent >= SUCCESS;
    if (success) celebrate(percent === 100);
    const home = el("a", { class: "button", href: "#/" }, "Volver ao inicio");
    replace(container, el(
      "div",
      { class: `panel finish${success ? " success" : ""}` },
      el("img", { class: "finish-duck", src: duckOf(activeProfile()), alt: "" }),
      el("p", { class: "prompt-label" }, "Exame rematado"),
      el("p", { class: "prompt" }, `${right} de ${questions.length} ben (${percent}%). ${success ? "Non esqueciches nada importante!" : "Convén repasar un pouco."}`),
      failed.length ? el("div", {}, el("h2", {}, "Para repasar"), wordTable(failed.map((question) => question.failedRow))) : null,
      failed.length ? el("p", { class: "muted" }, "O que fallaches está agora no repaso.") : null,
      el(
        "div",
        { class: "actions" },
        home,
        failed.length && mistakeCount() ? el("a", { class: "button secondary", href: "#/repaso" }, "Repasar") : null,
        el("button", { class: "button secondary", type: "button", onclick: () => runExam(container, site) }, "Outro exame")
      )
    ));
    focusSoon(home);
  }

  runQuestions(container, questions, {
    numbered: true,
    repeat: true,
    onAnswer: (question) => markExamSeen(question.keys, Date.now() - EXAM_FRESH_MS),
    onFinish: finish,
  });
}

export function examView(site) {
  const container = el("div", {});
  if (!examAvailable(site)) {
    replace(
      container,
      el("h1", {}, EXAM_TITLE),
      el("p", { class: "lead" }, `Este exame pregunta polo que xa aprendiches. Fai polo menos ${MIN_DONE_LESSONS} leccións de vocabulario, verbos ou gramática e volve.`),
      el("a", { class: "button", href: "#/" }, "Volver ao inicio")
    );
  } else {
    const begin = el("button", { class: "button", type: "button", onclick: () => runExam(container, site) }, "Comezar");
    replace(
      container,
      el(
        "div",
        { class: "panel" },
        el("p", { class: "prompt-label" }, "Exame"),
        el("h1", {}, EXAM_TITLE),
        el("p", {}, `Ata ${EXAM_SIZE} preguntas ao chou das leccións que xa fixeches, de vocabulario, verbos e gramática. Cada vez é distinto, e o que falles volverá saír ao final ata que o acertes.`),
        el("div", { class: "actions" }, begin)
      )
    );
    focusSoon(begin);
  }
  return el("div", { class: "narrow" }, backLink("#/", "Volver ao inicio"), container);
}
