import { checkAnswer } from "../text.js";
import { answerInput, backLink, el, findLesson, finishPanel, focusSoon, progressBar, replace, wordTable } from "../ui.js";

export function verbsMode(data) {
  return {
    path: "verbos",
    title: "Verbos",
    intro: "Conxuga cada verbo nas seis persoas. Só traballamos os tempos que se usan de verdade, agrupados por temas.",
    groups: data.themes,
    describe: (lesson) => data.tenses[lesson.tense],
  };
}

export function verbLessonView(mode, data, groupId, lessonId) {
  const found = findLesson(mode, groupId, lessonId);
  if (!found) return null;
  const { group, lesson, key, backHref, nextHref } = found;
  const tenseName = data.tenses[lesson.tense];
  const container = el("div", {});

  function start() {
    const queue = [...lesson.verbs];
    const failed = new Set();
    let cleared = 0;

    function showVerb() {
      if (!queue.length) {
        replace(container, finishPanel({
          key,
          total: lesson.verbs.length,
          failed: failed.size,
          failedRows: [...failed].map((name) => [
            `${name} (${data.verbs[name].es})`,
            data.verbs[name].forms[lesson.tense].join(", "),
          ]),
          backHref,
          backText: "Volver ás leccións",
          nextHref,
          restart: start,
        }));
        return;
      }

      const name = queue[0];
      const verb = data.verbs[name];
      const forms = verb.forms[lesson.tense];
      const inputs = forms.map((_, index) => answerInput({
        id: `person-${index}`,
        onkeydown(event) {
          if (event.key === "Enter" && index < forms.length - 1 && !answered) {
            event.preventDefault();
            inputs[index + 1].focus();
          }
        },
      }));
      const rows = el("div", { class: "conjugation" });
      const fixes = forms.map(() => null);
      function drawRows() {
        rows.replaceChildren(...data.persons.flatMap((person, index) => [
          el("label", { htmlFor: `person-${index}`, lang: "gl" }, person),
          inputs[index],
          fixes[index],
        ]).filter(Boolean));
      }
      drawRows();

      const feedback = el("div", { "aria-live": "polite" });
      const check = el("button", { class: "button", type: "submit" }, "Comprobar");
      const table = wordTable(data.persons.map((person, index) => [person, forms[index]]));
      table.hidden = true;
      const hint = el("button", {
        class: "button secondary",
        type: "button",
        onclick() {
          table.hidden = !table.hidden;
          if (!table.hidden) failed.add(name);
        },
      }, "Ver a conxugación");

      let answered = false;
      function submit(event) {
        event.preventDefault();
        if (answered) {
          showVerb();
          return;
        }
        answered = true;
        queue.shift();
        hint.remove();
        table.hidden = true;

        let allRight = true;
        let accentSlip = false;
        forms.forEach((form, index) => {
          const input = inputs[index];
          const result = checkAnswer(input.value, [form]);
          input.readOnly = true;
          input.classList.add(result.ok ? "right" : "wrong");
          if (result.note) accentSlip = true;
          if (!result.ok) {
            allRight = false;
            fixes[index] = el("div", { class: "fix", lang: "gl" }, form);
          }
        });
        drawRows();

        if (allRight) {
          cleared++;
          feedback.replaceChildren(el(
            "div",
            { class: "feedback right" },
            el("p", {}, el("strong", {}, "Ben feito!")),
            accentSlip ? el("p", {}, "Ollo: fíxate nos tiles.") : null
          ));
        } else {
          failed.add(name);
          queue.push(name);
          feedback.replaceChildren(el(
            "div",
            { class: "feedback wrong" },
            el("p", {}, "Fíxate nas formas corrixidas. Este verbo volverá ao final.")
          ));
        }
        check.textContent = queue.length ? "Seguinte" : "Rematar";
        focusSoon(check);
      }

      replace(
        container,
        progressBar(cleared, lesson.verbs.length),
        el(
          "form",
          { class: "panel", onsubmit: submit },
          el("p", { class: "prompt-label" }, `${group.title} · ${lesson.title}`),
          el("p", { class: "prompt" }, el("span", { lang: "gl" }, name), verb.es === name ? null : ` (${verb.es})`),
          el("span", { class: "level tense" }, tenseName),
          rows,
          table,
          feedback,
          el("div", { class: "actions" }, check, hint)
        )
      );
      focusSoon(inputs[0]);
    }

    showVerb();
  }

  start();
  return el("div", { class: "narrow" }, backLink(backHref, "Volver ás leccións"), container);
}
