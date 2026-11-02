import { clean, withoutAccents } from "./text.js";
import { el } from "./ui.js";

const DAY_MS = 86400000;
const EXPRESSION_EVERY = 5;
// The first day of the list. Changing it changes which entries are unlocked.
const FIRST_DAY = Date.UTC(2026, 10, 2) / DAY_MS;
const WEEKDAYS = ["domingo", "luns", "martes", "mércores", "xoves", "venres", "sábado"];
const MONTHS = ["xaneiro", "febreiro", "marzo", "abril", "maio", "xuño", "xullo", "agosto", "setembro", "outubro", "novembro", "decembro"];

// Depends only on the calendar date, so every device and profile sees the same.
function dayNumber(date) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
  return Math.max(0, today - FIRST_DAY);
}

// How many expressions come out in a given number of days, starting with one on the
// first day. Once they run out, the remaining days are all words, so that every day
// brings something new.
function expressionsIn(days, daily) {
  return Math.min(Math.ceil(days / EXPRESSION_EVERY), daily.expressions.length);
}

// Entries come out in the fixed random order of data/daily.json. When all of them
// have come out, the whole sequence starts again.
export function dailyEntry(daily, date = new Date()) {
  const day = dayNumber(date) % (daily.words.length + daily.expressions.length);
  const before = expressionsIn(day, daily);
  if (day % EXPRESSION_EVERY === 0 && before < daily.expressions.length) {
    return { title: "Expresión do día", ...daily.expressions[before] };
  }
  return { title: "Palabra do día", ...daily.words[day - before] };
}

// Everything that has come out so far, the most recent first.
export function unlockedEntries(daily, date = new Date()) {
  const days = Math.min(dayNumber(date) + 1, daily.words.length + daily.expressions.length);
  const expressions = expressionsIn(days, daily);
  return {
    words: daily.words.slice(0, days - expressions).reverse(),
    expressions: daily.expressions.slice(0, expressions).reverse(),
  };
}

// Written by hand because not every browser includes the Galician date names.
export function dateInGalician(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

let shownDate = null;

// Only redraws when the day changes, so moving around the site doesn't reload the picture.
export function drawDailyPanel(container, daily) {
  const today = dateInGalician();
  if (today === shownDate) return;
  shownDate = today;
  const entry = dailyEntry(daily);
  container.replaceChildren(
    el("h2", {}, entry.title),
    el("p", { class: "daily-date" }, today),
    el("img", { class: "daily-duck", src: "assets/img/pato-sofa.svg", alt: "Un parrulo con lentes lendo un libro sentado nun sofá" }),
    el("p", { class: "daily-term" }, entry.gl),
    el("p", {}, entry.def),
    el("p", { class: "daily-translation" }, "En castelán: ", el("strong", { lang: "es" }, entry.es)),
    el("a", { class: "daily-all", href: "#/palabras-do-dia" }, "Ver todas as palabras e expresións")
  );
}

function normalized(text) {
  return withoutAccents(clean(text));
}

function heading(title, count) {
  return el("div", { class: "daily-list-heading" }, el("h2", {}, title), count);
}

function listSection(title, entries, today, emptyText) {
  const rows = entries.map((entry) => ({
    search: normalized(`${entry.gl} ${entry.def} ${entry.es}`),
    node: el(
      "li",
      { class: entry.gl === today.gl ? "today" : null },
      el(
        "p",
        { class: "daily-list-term" },
        entry.gl,
        entry.gl === today.gl ? el("span", { class: "daily-today" }, "Hoxe") : null
      ),
      el("p", {}, entry.def),
      el("p", { class: "daily-translation" }, "En castelán: ", el("strong", { lang: "es" }, entry.es))
    ),
  }));
  const count = el("span", { class: "daily-count" });
  const section = el(
    "section",
    { class: "daily-list-section" },
    heading(title, count),
    entries.length
      ? el("ul", { class: "daily-list" }, ...rows.map((row) => row.node))
      : el("p", { class: "muted" }, emptyText)
  );

  function filter(text) {
    let visible = 0;
    for (const row of rows) {
      row.node.hidden = !row.search.includes(text);
      if (!row.node.hidden) visible++;
    }
    count.textContent = String(visible);
    section.hidden = Boolean(text) && visible === 0;
    return visible;
  }

  return { section, filter };
}

export function dailyListView(daily, date = new Date()) {
  const today = dailyEntry(daily, date);
  const { words, expressions } = unlockedEntries(daily, date);
  const hidden = daily.words.length + daily.expressions.length - words.length - expressions.length;
  const sections = [
    listSection("Palabras do día", words, today, "Aínda non saíu ningunha palabra."),
    listSection("Expresións do día", expressions, today, "Aínda non saíu ningunha expresión."),
  ];
  // The hidden entries are not named anywhere on the page, only counted.
  const hiddenSection = el(
    "section",
    { class: "daily-list-section" },
    heading("Palabras ou expresións ocultas", el("span", { class: "daily-count" }, String(hidden))),
    el("ul", { class: "daily-list daily-hidden" }, ...Array.from({ length: hidden }, () => el("li", { "aria-label": "Oculta" }, "?")))
  );
  const nothing = el("p", { class: "muted", hidden: true }, "Non hai ningunha coincidencia.");
  const search = el("input", {
    type: "text",
    placeholder: "Busca nas que xa saíron, en galego ou en castelán",
    "aria-label": "Buscar nas palabras e expresións que xa saíron",
    autocomplete: "off",
    spellcheck: false,
    oninput() {
      const text = normalized(search.value);
      const visible = sections.reduce((sum, { filter }) => sum + filter(text), 0);
      nothing.hidden = !text || visible > 0;
      hiddenSection.hidden = Boolean(text);
    },
  });
  sections.forEach(({ filter }) => filter(""));

  return el(
    "div",
    {},
    el("h1", {}, "Palabras e expresións do día"),
    el("p", { class: "lead" }, "Cada día desbloquéase unha nova."),
    el("div", { class: "daily-search" }, search),
    nothing,
    ...sections.map(({ section }) => section),
    hiddenSection
  );
}
