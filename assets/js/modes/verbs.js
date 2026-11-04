import { addMistake, clearMistake } from "../store.js";
import { checkAnswer } from "../text.js";
import { grammarLessonView } from "./grammar.js";
import { answerInput, backLink, collectButton, el, findLesson, finishPanel, focusSoon, progressBar, replace, wordTable } from "../ui.js";

export function verbsMode(data) {
  return {
    path: "verbos",
    title: "Verbos",
    intro: "Primeiro, un verbo regular de cada conxugación en todos os tempos, para aprender as terminacións. Despois, os irregulares, un por un, e por último as perífrases e outras expresións.",
    groups: data.themes,
    describe: (lesson) => (lesson.items ? `${lesson.items.length} frases` : "Conxugar"),
  };
}

// A single form, so the player can save just the persons they get wrong.
export function verbFormId(name, tense, index) {
  return `${name}/${tense}/${index}`;
}

// What the collection and the review keep of a form, so it can be studied without the lesson.
export function verbFormValue(data, name, tense, index) {
  const verb = data.verbs[name];
  return { verb: name, es: verb.es, tense: data.tenses[tense], person: data.persons[index], form: verb.forms[tense][index] };
}

export function verbLessonView(mode, data, groupId, lessonId) {
  const found = findLesson(mode, groupId, lessonId);
  if (!found) return null;
  // Periphrases are sentences with a gap, played as in grammar.
  if (found.lesson.items) return grammarLessonView(mode, groupId, lessonId);
  const { group, lesson, key, backHref, nextHref } = found;
  const tenseName = data.tenses[lesson.tense];
  const container = el("div", {});

  function collectForm(name, index) {
    return collectButton("verbs", verbFormId(name, lesson.tense, index), verbFormValue(data, name, lesson.tense, index), { small: true });
  }

  // A form answered wrong goes to the review, and leaves it once right without failing it here.
  const failedForms = new Set();
  function rememberForm(name, index, right) {
    const id = verbFormId(name, lesson.tense, index);
    if (right) {
      if (!failedForms.has(id)) clearMistake("verbs", id);
    } else {
      failedForms.add(id);
      addMistake("verbs", id, verbFormValue(data, name, lesson.tense, index));
    }
  }

  function start() {
    failedForms.clear();
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
            data.verbs[name].forms[lesson.tense].filter(Boolean).join(", "),
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
      // The imperative has only «ti» and «vós»: the other persons are empty and not asked.
      const asked = forms.map((form, index) => (form ? index : -1)).filter((index) => index >= 0);
      const inputs = forms.map((_, index) => answerInput({
        id: `person-${index}`,
        onkeydown(event) {
          const after = asked[asked.indexOf(index) + 1];
          if (event.key === "Enter" && after !== undefined && !answered) {
            event.preventDefault();
            inputs[after].focus();
          }
        },
      }));
      const rows = el("div", { class: "conjugation" });
      const fixes = forms.map(() => null);
      const collects = forms.map((_, index) => collectForm(name, index));
      function drawRows() {
        rows.replaceChildren(...asked.flatMap((index) => [
          el("label", { htmlFor: `person-${index}`, lang: "gl" }, data.persons[index]),
          inputs[index],
          collects[index],
          fixes[index],
        ]).filter(Boolean));
      }
      drawRows();

      const feedback = el("div", { "aria-live": "polite" });
      const check = el("button", { class: "button", type: "submit" }, "Comprobar");
      const table = wordTable(asked.map((index) => [data.persons[index], forms[index]]));
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
        asked.forEach((index) => {
          const form = forms[index];
          const input = inputs[index];
          const result = checkAnswer(input.value, [form]);
          rememberForm(name, index, result.ok);
          input.readOnly = true;
          input.classList.add(result.ok ? "right" : "wrong");
          // A missing or wrong accent still counts, but the right spelling is shown.
          if (result.note) {
            accentSlip = true;
            fixes[index] = el("div", { class: "fix accent", lang: "gl" }, form);
          }
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
      focusSoon(inputs[asked[0]]);
    }

    showVerb();
  }

  const conjugate = el("button", { class: "button", type: "button", onclick: start }, "Conxugar");
  const persons = data.verbs[lesson.verbs[0]].forms[lesson.tense].filter(Boolean).length;
  replace(
    container,
    el(
      "div",
      { class: "panel" },
      el("p", { class: "prompt-label" }, `${group.section} · ${group.title}`),
      el("h1", {}, tenseName),
      el("p", {}, persons === 6
        ? "Escribe as seis persoas. O que falles volverá ao final ata que o acertes."
        : "O imperativo só ten «ti» e «vós». O que falles volverá ao final ata que o acertes."),
      el("div", { class: "actions" }, conjugate)
    )
  );
  focusSoon(conjugate);
  return el("div", { class: "narrow" }, backLink(backHref, "Volver ás leccións"), container);
}
