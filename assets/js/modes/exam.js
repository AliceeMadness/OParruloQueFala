// "Non hai que esquecer o aprendido": every few days, an exam of random questions from
// the vocabulary, verb and grammar lessons the profile has already done.
import { celebrate, duckOf } from "../ducks.js";
import { activeProfile, addMistake, bestScore, clearMistake, examSeen, lastExamAt, markExamSeen, mistakes, recordExam } from "../store.js";
import { EXAM_FRESH_MS } from "../sync.js";
import { checkAnswer, clean, shuffled } from "../text.js";
import { answerInput, backLink, collectButton, el, focusSoon, progressBar, replace, wordTable } from "../ui.js";
import { grammarId, sentence } from "./grammar.js";
import { verbFormId } from "./verbs.js";

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

// Each question is { keys, label, answers, shown, failedRow, collect() }, plus `prompt` for a
// word to translate or conjugate, or `text` and `es` for a sentence with a gap. `word` is
// set for vocabulary, so the review keeps the words answered wrong.
//
// `keys` name what the question asks and the words it expects: two questions sharing a key
// never come up in the same exam, nor in exams a few hours apart. `family` only applies
// inside one exam, so it asks one person of each verb but the next exam can ask another.
function vocabularyQuestions(site) {
  return doneLessons(site.vocabulary).flatMap(({ lesson }) => lesson.words.map((word) => ({
    keys: [`es:${clean(word.es)}`, ...word.gl.map((option) => `gl:${clean(option)}`)],
    label: "Vocabulario · Escríbeo en galego",
    prompt: word.es,
    promptLang: "es",
    answers: word.gl,
    shown: word.gl.join(" / "),
    failedRow: [word.es, word.gl[0]],
    word,
    collect: () => collectButton("words", word.es, word.gl),
  })));
}

function verbQuestions(site) {
  const data = site.verbData;
  return doneLessons(site.verbs).flatMap(({ lesson }) => {
    const tense = data.tenses[lesson.tense];
    return lesson.verbs.flatMap((name) => {
      const verb = data.verbs[name];
      return verb.forms[lesson.tense].map((form, index) => {
        const person = data.persons[index];
        return {
          keys: [`verb:${verbFormId(name, lesson.tense, index)}`, `gl:${clean(form)}`],
          family: `verb:${name}`,
          label: `Verbos · ${tense}${verb.es === name ? "" : ` · ${verb.es}`}`,
          prompt: `${person} · ${name}`,
          promptLang: "gl",
          answers: [form],
          shown: form,
          failedRow: [`${person} · ${name} (${tense.toLowerCase()})`, form],
          collect: () => collectButton(
            "verbs",
            verbFormId(name, lesson.tense, index),
            { verb: name, es: verb.es, tense, person, form }
          ),
        };
      });
    });
  });
}

function grammarQuestions(site) {
  return doneLessons(site.grammar).flatMap(({ lesson }) => lesson.items.map((item) => ({
    keys: [`text:${clean(item.text)}`],
    label: `Gramática · ${lesson.title}`,
    text: item.text,
    es: item.es,
    answers: [item.answer],
    shown: item.answer,
    why: item.why,
    failedRow: [item.text.replace("___", "…"), item.answer],
    collect: () => collectButton("grammar", grammarId(item), item),
  })));
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
  const failed = [];
  let index = 0;

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

  function finish() {
    recordExam();
    const right = questions.length - failed.length;
    const percent = Math.round((right * 100) / questions.length);
    const success = percent >= SUCCESS;
    if (success) celebrate(percent === 100);
    const forgotWords = failed.some((question) => question.word);
    const home = el("a", { class: "button", href: "#/" }, "Volver ao inicio");
    replace(container, el(
      "div",
      { class: `panel finish${success ? " success" : ""}` },
      el("img", { class: "finish-duck", src: duckOf(activeProfile()), alt: "" }),
      el("p", { class: "prompt-label" }, "Exame rematado"),
      el("p", { class: "prompt" }, `${right} de ${questions.length} ben (${percent}%). ${success ? "Non esqueciches nada importante!" : "Convén repasar un pouco."}`),
      failed.length ? el("div", {}, el("h2", {}, "Para repasar"), wordTable(failed.map((question) => question.failedRow))) : null,
      forgotWords ? el("p", { class: "muted" }, "As palabras de vocabulario que fallaches están agora no repaso.") : null,
      el(
        "div",
        { class: "actions" },
        home,
        forgotWords && mistakes().length ? el("a", { class: "button secondary", href: "#/repaso" }, "Repasar") : null,
        el("button", { class: "button secondary", type: "button", onclick: () => runExam(container, site) }, "Outro exame")
      )
    ));
    focusSoon(home);
  }

  function showQuestion() {
    if (index >= questions.length) {
      finish();
      return;
    }
    const question = questions[index];
    const input = answerInput(question.text
      ? { class: "gap-input", "aria-label": "A palabra que falta" }
      : { "aria-label": `Resposta para «${question.prompt}»` });
    const feedback = el("div", { "aria-live": "polite" });
    const check = el("button", { class: "button", type: "submit" }, "Comprobar");
    let answered = false;

    function submit(event) {
      event.preventDefault();
      if (answered) {
        index++;
        showQuestion();
        return;
      }
      if (!input.value.trim()) return;
      answered = true;
      input.readOnly = true;
      markExamSeen(question.keys, Date.now() - EXAM_FRESH_MS);
      const result = checkAnswer(input.value, question.answers);
      input.classList.add(result.ok ? "right" : "wrong");
      if (result.ok) {
        if (question.word) clearMistake(question.word);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback right" },
          el("p", {}, el("strong", {}, "Correcto!")),
          result.note ? el("p", {}, "Ollo: escríbese ", el("strong", { lang: "gl" }, question.answers[0]), ".") : null
        ));
      } else {
        failed.push(question);
        if (question.word) addMistake(question.word);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback wrong" },
          el("p", {}, "A resposta é: ", el("strong", { lang: "gl" }, question.shown)),
          question.why ? el("p", {}, question.why) : null
        ));
      }
      check.textContent = index + 1 < questions.length ? "Seguinte" : "Rematar";
      focusSoon(check);
    }

    const body = question.text
      ? [sentence(question.text, input), el("p", { class: "translation", lang: "es" }, question.es)]
      : [el("p", { class: "prompt", lang: question.promptLang }, question.prompt), input];

    replace(
      container,
      progressBar(index, questions.length),
      el(
        "form",
        { class: "panel", onsubmit: submit },
        el("p", { class: "prompt-label" }, `${index + 1}/${questions.length} · ${question.label}`),
        ...body,
        feedback,
        el("div", { class: "actions" }, check, question.collect())
      )
    );
    focusSoon(input);
  }

  showQuestion();
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
        el("p", {}, `Ata ${EXAM_SIZE} preguntas ao chou das leccións que xa fixeches, de vocabulario, verbos e gramática. Cada vez é distinto, e cada pregunta só sae unha vez: o que falles verás ao final.`),
        el("div", { class: "actions" }, begin)
      )
    );
    focusSoon(begin);
  }
  return el("div", { class: "narrow" }, backLink("#/", "Volver ao inicio"), container);
}
