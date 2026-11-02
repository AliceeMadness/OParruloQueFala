import { celebrate, duckOf } from "./ducks.js";
import { activeProfile, addToCollection, bestScore, inCollection, recordScore, removeFromCollection } from "./store.js";

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "spellcheck") node.setAttribute(key, String(value));
    else if (value === undefined || value === null || value === false) continue;
    else if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key in node && key !== "list") node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

export const LEVELS = { 1: "Iniciación", 2: "Intermedio", 3: "Avanzado", 4: "Experto" };

export function backLink(href, text) {
  return el("a", { class: "back", href }, `← ${text}`);
}

// The player's duck swims along the bar as the lesson moves on.
export function progressBar(done, total) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return el(
    "div",
    {
      class: "progress",
      style: `--percent: ${percent}%`,
      role: "progressbar",
      "aria-valuenow": percent,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-label": "Progreso da lección",
    },
    el("div", { class: "progress-fill" }),
    el("img", { class: "progress-duck", src: duckOf(activeProfile()), alt: "" })
  );
}

export function answerInput(props = {}) {
  return el("input", {
    type: "text",
    autocomplete: "off",
    autocapitalize: "none",
    autocorrect: "off",
    spellcheck: false,
    lang: "gl",
    ...props,
  });
}

// Pressing Enter on a button right after pressing it on the input would repeat
// the same key press, so focus moves on the next tick.
export function focusSoon(node) {
  setTimeout(() => node.focus(), 0);
}

export function wordTable(rows) {
  return el(
    "table",
    { class: "word-table" },
    el("tbody", {}, ...rows.map(([left, right]) =>
      el("tr", {}, el("td", {}, left), el("td", { lang: "gl" }, right))
    ))
  );
}

export function avatar(profile) {
  return el("img", {
    class: "avatar",
    src: profile.duck,
    alt: "",
    style: `background: ${profile.color}`,
  });
}

function scoreClass(score) {
  if (score === 100) return "";
  if (score >= 70) return " score-high";
  if (score >= 50) return " score-mid";
  return " score-low";
}

function lessonHref(mode, group, lesson) {
  return `#/${mode.path}/${group.id}/${lesson.id}`;
}

function lessonKey(mode, group, lesson) {
  return `${mode.path}/${group.id}/${lesson.id}`;
}

// A mode is { path, title, intro, groups, describe(lesson) }.
export function catalogueView(mode) {
  const groups = mode.groups.map((group) => {
    const total = group.lessons.length;
    const scores = group.lessons.map((l) => bestScore(lessonKey(mode, group, l))).filter((score) => score !== undefined);
    return { group, total, done: scores.length, worst: Math.min(...scores) };
  });
  const firstOpen = groups.find(({ total, done }) => done < total);

  return el(
    "div",
    {},
    el("h1", {}, mode.title),
    el("p", { class: "lead" }, mode.intro),
    ...groups.map(({ group, total, done, worst }) =>
      el(
        "details",
        { class: `group${done === total ? ` group-done${scoreClass(worst)}` : ""}`, open: firstOpen && firstOpen.group === group },
        el(
          "summary",
          {},
          el("h2", {}, group.title),
          el("span", { class: `level level-${group.level}` }, LEVELS[group.level]),
          el("span", { class: "group-progress" }, `${done} de ${total}`)
        ),
        el(
          "div",
          { class: "lesson-grid" },
          ...group.lessons.map((lesson) => {
            const score = bestScore(lessonKey(mode, group, lesson));
            return el(
              "a",
              { class: `lesson-link${score !== undefined ? ` done${scoreClass(score)}` : ""}`, href: lessonHref(mode, group, lesson) },
              el("span", {}, lesson.title, el("small", {}, mode.describe(lesson))),
              score !== undefined ? el("span", { class: "score" }, `${score}%`) : null
            );
          })
        )
      )
    )
  );
}

export function findLesson(mode, groupId, lessonId) {
  const flat = mode.groups.flatMap((group) => group.lessons.map((lesson) => ({ group, lesson })));
  const index = flat.findIndex((entry) => entry.group.id === groupId && entry.lesson.id === lessonId);
  if (index < 0) return null;
  const next = flat[index + 1];
  return {
    ...flat[index],
    key: lessonKey(mode, flat[index].group, flat[index].lesson),
    nextHref: next ? lessonHref(mode, next.group, next.lesson) : null,
    backHref: `#/${mode.path}`,
  };
}

function verdict(percent) {
  if (percent === 100) return "Perfecto! Es un parrulo de ouro!";
  if (percent >= 80) return "Moi ben! Cuac de satisfacción.";
  if (percent >= 50) return "Vas ben, segue nadando.";
  return "Ánimo: os parrulos tamén aprenden a nadar pouco a pouco.";
}

export const SUCCESS = 80;

export function finishPanel({ key, total, failed, failedRows, backHref, backText, nextHref, restart }) {
  const percent = total ? Math.round(((total - failed) / total) * 100) : 100;
  if (key) recordScore(key, percent);
  const success = percent >= SUCCESS;
  if (success) celebrate(percent === 100);
  const next = nextHref ? el("a", { class: "button", href: nextHref }, "Seguinte lección") : null;
  const again = el("button", { class: `button${next ? " secondary" : ""}`, type: "button", onclick: restart }, "Repetir");
  const panel = el(
    "div",
    { class: `panel finish${success ? " success" : ""}` },
    el("img", { class: "finish-duck", src: duckOf(activeProfile()), alt: "" }),
    el("p", { class: "prompt-label" }, "Lección rematada"),
    el("p", { class: "prompt" }, `${percent}% á primeira. ${verdict(percent)}`),
    failedRows && failedRows.length
      ? el("div", {}, el("h2", {}, "Para repasar"), wordTable(failedRows))
      : null,
    el(
      "div",
      { class: "actions" },
      next,
      again,
      el("a", { class: "button secondary", href: backHref }, backText)
    )
  );
  focusSoon(next ?? again);
  return panel;
}

// Swaps the content of a container, used by every lesson as it moves on.
export function replace(container, ...nodes) {
  container.replaceChildren(...nodes.filter(Boolean));
}

// Saves something the player doesn't know yet in their collection, or takes it out.
export function collectButton(kind, id, value, { small = false } = {}) {
  const button = el("button", { class: small ? "collect-mini" : "button secondary collect", type: "button" });
  function draw() {
    const added = inCollection(kind, id);
    button.setAttribute("aria-pressed", String(added));
    if (small) {
      button.textContent = added ? "✓" : "+";
      button.title = added ? "Quitar da miña colección" : "Engadir á miña colección";
      button.setAttribute("aria-label", button.title);
    } else {
      button.textContent = added ? "✓ Na miña colección" : "Engadir á miña colección";
    }
  }
  button.addEventListener("click", () => {
    if (inCollection(kind, id)) removeFromCollection(kind, id);
    else addToCollection(kind, id, value);
    draw();
  });
  draw();
  return button;
}
