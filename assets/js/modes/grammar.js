import { shuffled } from "../text.js";
import { backLink, el, findLesson, finishPanel, focusSoon, progressBar, replace } from "../ui.js";

export function grammarMode(groups) {
  return {
    path: "gramatica",
    title: "Gramática",
    intro: "Completa as frases escollendo a opción correcta. Se fallas, explicámosche a regra. Comeza por colocar os pronomes.",
    groups,
    describe: (lesson) => `${lesson.items.length} frases`,
  };
}

function sentence(text, filled) {
  const [before, after] = text.split("___");
  return el(
    "p",
    { class: "prompt", lang: "gl" },
    before,
    el("span", { class: `gap${filled ? " filled" : ""}` }, filled ?? "    "),
    after
  );
}

export function grammarLessonView(mode, groupId, lessonId) {
  const found = findLesson(mode, groupId, lessonId);
  if (!found) return null;
  const { group, lesson, key, backHref, nextHref } = found;
  const container = el("div", {});

  function play() {
    const queue = [...lesson.items];
    const failed = new Set();
    let cleared = 0;

    function showItem() {
      if (!queue.length) {
        replace(container, finishPanel({
          key,
          total: lesson.items.length,
          failed: failed.size,
          backHref,
          backText: "Volver ás leccións",
          nextHref,
          restart: play,
        }));
        return;
      }

      const item = queue[0];
      const feedback = el("div", { "aria-live": "polite" });
      const heading = el("div", {}, sentence(item.text));
      const next = el("button", {
        class: "button",
        type: "button",
        onclick: showItem,
      }, queue.length > 1 ? "Seguinte" : "Rematar");
      const actions = el("div", { class: "actions" });

      function choose(button, option) {
        queue.shift();
        const right = option === item.answer;
        for (const other of options) {
          other.disabled = true;
          if (other.textContent === item.answer) other.classList.add("right");
        }
        if (right) {
          cleared++;
          feedback.replaceChildren(el("div", { class: "feedback right" }, el("p", {}, el("strong", {}, "Correcto!"))));
        } else {
          button.classList.add("wrong");
          failed.add(item);
          queue.push(item);
          feedback.replaceChildren(el(
            "div",
            { class: "feedback wrong" },
            el("p", {}, el("strong", { lang: "gl" }, item.answer)),
            el("p", {}, item.why)
          ));
        }
        heading.replaceChildren(sentence(item.text, item.answer));
        next.textContent = queue.length ? "Seguinte" : "Rematar";
        actions.replaceChildren(next);
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
        progressBar(cleared, lesson.items.length),
        el(
          "div",
          { class: "panel" },
          el("p", { class: "prompt-label" }, lesson.title),
          heading,
          el("p", { class: "translation", lang: "es" }, item.es),
          el("div", { class: "options" }, ...options),
          feedback,
          actions
        )
      );
    }

    showItem();
  }

  const begin = el("button", { class: "button", type: "button", onclick: play }, "Comezar");
  replace(
    container,
    el(
      "div",
      { class: "panel" },
      el("p", { class: "prompt-label" }, group.title),
      el("h1", {}, lesson.title),
      el("p", {}, lesson.intro),
      el("div", { class: "actions" }, begin)
    )
  );
  focusSoon(begin);

  return el("div", { class: "narrow" }, backLink(backHref, "Volver ás leccións"), container);
}
