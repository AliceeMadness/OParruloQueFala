// Questions shared by the exam and the review: a word to translate, a verb form to write or
// a sentence with a gap, all typed by the player.
import { addMistake, clearMistake } from "../store.js";
import { checkAnswer, clean } from "../text.js";
import { answerInput, collectButton, el, focusSoon, progressBar, replace } from "../ui.js";
import { grammarId, sentence } from "./grammar.js";

// Each question is { keys, label, answers, shown, failedRow, remember, collect() }, plus
// `prompt` for a word or a verb form, or `text` and `es` for a sentence with a gap.
// `remember` is what the review keeps when it is answered wrong.
//
// `keys` name what the question asks and the words it expects: two questions sharing a key
// never come up in the same exam, nor in exams a few hours apart. `family` only applies
// inside one exam, so it asks one person of each verb but the next exam can ask another.
export function wordQuestion(es, gl) {
  return {
    keys: [`es:${clean(es)}`, ...gl.map((option) => `gl:${clean(option)}`)],
    label: "Vocabulario · Escríbeo en galego",
    prompt: es,
    promptLang: "es",
    answers: gl,
    shown: gl.join(" / "),
    failedRow: [es, gl[0]],
    remember: { kind: "words", id: es, value: gl },
    collect: () => collectButton("words", es, gl),
  };
}

// `value` is a verb form as the collection and the review save it: { verb, es, tense, person, form }.
export function verbQuestion(id, value) {
  const { verb, es, tense, person, form } = value;
  return {
    keys: [`verb:${id}`, `gl:${clean(form)}`],
    family: `verb:${verb}`,
    label: `Verbos · ${tense}${es === verb ? "" : ` · ${es}`}`,
    prompt: `${person} · ${verb}`,
    promptLang: "gl",
    answers: [form],
    shown: form,
    failedRow: [`${person} · ${verb} (${tense.toLowerCase()})`, form],
    remember: { kind: "verbs", id, value },
    collect: () => collectButton("verbs", id, value),
  };
}

export function grammarQuestion(item, lessonTitle) {
  const id = grammarId(item);
  return {
    keys: [`text:${clean(item.text)}`],
    label: lessonTitle ? `Gramática · ${lessonTitle}` : "Gramática",
    text: item.text,
    es: item.es,
    answers: [item.answer],
    shown: item.answer,
    why: item.why,
    failedRow: [item.text.replace("___", "…"), item.answer],
    remember: { kind: "grammar", id, value: item },
    collect: () => collectButton("grammar", id, item),
  };
}

// A question answered wrong goes to the review, and leaves it when answered right without
// having failed it in the same go. With `repeat`, wrong answers also come back at the end of
// the queue until they are right, as in the lessons; without it, each question comes up
// once. `onFinish` receives the questions answered wrong.
export function runQuestions(container, questions, { repeat, numbered, onAnswer = () => {}, onFinish }) {
  const queue = [...questions];
  const failed = new Set();
  let cleared = 0;

  function showQuestion() {
    if (!queue.length) {
      onFinish([...failed]);
      return;
    }
    const question = queue[0];
    const position = questions.length - queue.length;
    // A question coming back after a mistake keeps no number: the count is of the first go.
    const numberOf = (asked) => {
      if (!numbered) return asked.label;
      if (failed.has(asked)) return `Outra vez · ${asked.label}`;
      return `${questions.indexOf(asked) + 1}/${questions.length} · ${asked.label}`;
    };
    const input = answerInput(question.text
      ? { class: "gap-input", "aria-label": "A palabra que falta" }
      : { "aria-label": `Resposta para «${question.prompt}»` });
    const feedback = el("div", { "aria-live": "polite" });
    const check = el("button", { class: "button", type: "submit" }, "Comprobar");
    let answered = false;

    function submit(event) {
      event.preventDefault();
      if (answered) {
        showQuestion();
        return;
      }
      if (!input.value.trim()) return;
      answered = true;
      input.readOnly = true;
      queue.shift();
      onAnswer(question);
      const { kind, id, value } = question.remember;
      const result = checkAnswer(input.value, question.answers);
      input.classList.add(result.ok ? "right" : "wrong");
      if (result.ok) {
        cleared++;
        if (!failed.has(question)) clearMistake(kind, id);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback right" },
          el("p", {}, el("strong", {}, "Correcto!")),
          result.note ? el("p", {}, "Ollo: escríbese ", el("strong", { lang: "gl" }, question.answers[0]), ".") : null
        ));
      } else {
        failed.add(question);
        addMistake(kind, id, value);
        if (repeat) queue.push(question);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback wrong" },
          el("p", {}, "A resposta é: ", el("strong", { lang: "gl" }, question.shown)),
          question.why ? el("p", {}, question.why) : null
        ));
      }
      check.textContent = queue.length ? "Seguinte" : "Rematar";
      focusSoon(check);
    }

    const body = question.text
      ? [sentence(question.text, input), el("p", { class: "translation", lang: "es" }, question.es)]
      : [el("p", { class: "prompt", lang: question.promptLang }, question.prompt), input];

    replace(
      container,
      progressBar(repeat ? cleared : position, questions.length),
      el(
        "form",
        { class: "panel", onsubmit: submit },
        el("p", { class: "prompt-label" }, numberOf(question)),
        ...body,
        feedback,
        el("div", { class: "actions" }, check, question.collect())
      )
    );
    focusSoon(input);
  }

  showQuestion();
}
