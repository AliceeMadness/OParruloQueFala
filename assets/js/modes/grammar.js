import { checkAnswer, shuffled } from "../text.js";
import { answerInput, backLink, collectButton, el, findLesson, finishPanel, focusSoon, progressBar, replace } from "../ui.js";

export function grammarMode(groups) {
  return {
    path: "gramatica",
    title: "Gramática",
    intro: "Completa as frases escollendo a opción correcta, ou escribíndoa ti no modo difícil. Se fallas, explicámosche a regra. Comeza por colocar os pronomes.",
    groups,
    describe: (lesson) => `${lesson.items.length} frases`,
  };
}

// Some sentences appear in more than one lesson with different answers.
export function grammarId(item) {
  return `${item.text}|${item.answer}`;
}

function sentence(text, filled) {
  const [before, after] = text.split("___");
  return el(
    "p",
    { class: "prompt", lang: "gl" },
    before,
    filled instanceof Node ? filled : el("span", { class: `gap${filled ? " filled" : ""}` }, filled ?? "    "),
    after
  );
}

const collectSentence = (item) => collectButton("grammar", grammarId(item), item);

// Sentences answered wrong come back at the end of the queue until they are right.
// In hard mode the player types the missing word instead of choosing it. An item is
// { text, answer, wrong, why, es }, plus `answers` when more than one is right and
// `hintLang` when the line under the sentence isn't a Spanish translation.
export function runSentences(container, { items, title, hard, key, backHref, backText, nextHref, restart, collect = collectSentence }) {
  const queue = [...items];
  const failed = new Set();
  let cleared = 0;

  function showItem() {
    if (!queue.length) {
      replace(container, finishPanel({
        key,
        total: items.length,
        failed: failed.size,
        backHref,
        backText,
        nextHref,
        restart,
      }));
      return;
    }

    const item = queue[0];
    const feedback = el("div", { "aria-live": "polite" });
    const heading = el("div", {});
    const saveButton = collect(item);
    const next = el("button", { class: "button", type: "button", onclick: showItem });
    const actions = el("div", { class: "actions" }, saveButton);

    // Records the answer and shows the rule when it was wrong.
    function settle(right, note) {
      queue.shift();
      if (right) {
        cleared++;
        feedback.replaceChildren(el(
          "div",
          { class: "feedback right" },
          el("p", {}, el("strong", {}, "Correcto!")),
          note === "accent" ? el("p", {}, "Ollo: fíxate nos tiles. Escríbese ", el("strong", { lang: "gl" }, item.answer), ".") : null
        ));
      } else {
        failed.add(item);
        queue.push(item);
        feedback.replaceChildren(el(
          "div",
          { class: "feedback wrong" },
          el("p", {}, el("strong", { lang: "gl" }, item.answer)),
          el("p", {}, item.why)
        ));
      }
      next.textContent = queue.length ? "Seguinte" : "Rematar";
    }

    const panelBody = [
      el("p", { class: "prompt-label" }, title),
      heading,
      el("p", { class: "translation", lang: item.hintLang ?? "es" }, item.es),
    ];

    if (hard) {
      const input = answerInput({ class: "gap-input", "aria-label": "A palabra que falta" });
      const check = el("button", { class: "button", type: "submit" }, "Comprobar");
      heading.replaceChildren(sentence(item.text, input));
      actions.replaceChildren(...[check, saveButton].filter(Boolean));
      let answered = false;

      replace(
        container,
        progressBar(cleared, items.length),
        el(
          "form",
          {
            class: "panel",
            onsubmit(event) {
              event.preventDefault();
              if (answered) {
                showItem();
                return;
              }
              if (!input.value.trim()) return;
              answered = true;
              input.readOnly = true;
              const result = checkAnswer(input.value, item.answers ?? [item.answer]);
              input.classList.add(result.ok ? "right" : "wrong");
              settle(result.ok, result.note);
              check.textContent = next.textContent;
              focusSoon(check);
            },
          },
          ...panelBody,
          feedback,
          actions
        )
      );
      focusSoon(input);
      return;
    }

    heading.replaceChildren(sentence(item.text));
    function choose(button, option) {
      for (const other of options) {
        other.disabled = true;
        if (other.textContent === item.answer) other.classList.add("right");
      }
      if (option !== item.answer) button.classList.add("wrong");
      settle(option === item.answer);
      heading.replaceChildren(sentence(item.text, item.answer));
      actions.replaceChildren(...[next, saveButton].filter(Boolean));
      focusSoon(next);
    }

    const options = shuffled([item.answer, ...item.wrong]).map((option) => {
      const button = el("button", {
        class: "option",
        type: "button",
        lang: "gl",
        onclick: () => choose(button, option),
      }, option);
      return button;
    });

    replace(
      container,
      progressBar(cleared, items.length),
      el(
        "div",
        { class: "panel" },
        ...panelBody,
        el("div", { class: "options" }, ...options),
        feedback,
        actions
      )
    );
  }

  showItem();
}

export function grammarLessonView(mode, groupId, lessonId) {
  const found = findLesson(mode, groupId, lessonId);
  if (!found) return null;
  const { group, lesson, key, backHref, nextHref } = found;
  const container = el("div", {});

  function play(hard) {
    runSentences(container, {
      items: lesson.items,
      title: lesson.title,
      hard,
      key,
      backHref,
      backText: "Volver ás leccións",
      nextHref,
      restart: () => play(hard),
    });
  }

  const easy = el("button", { class: "button", type: "button", onclick: () => play(false) }, "Modo fácil");
  replace(
    container,
    el(
      "div",
      { class: "panel" },
      el("p", { class: "prompt-label" }, group.title),
      el("h1", {}, lesson.title),
      el("p", {}, lesson.intro),
      el(
        "div",
        { class: "modes" },
        el("div", {}, easy, el("small", {}, "Escolle a opción correcta.")),
        el("div", {}, el("button", { class: "button secondary", type: "button", onclick: () => play(true) }, "Modo difícil"), el("small", {}, "Escribe ti a palabra que falta."))
      )
    )
  );
  focusSoon(easy);

  return el("div", { class: "narrow" }, backLink(backHref, "Volver ás leccións"), container);
}
