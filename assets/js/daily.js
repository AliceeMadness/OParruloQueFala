import { el } from "./ui.js";

const DAY_MS = 86400000;
const EXPRESSION_EVERY = 5;

// Depends only on the calendar date, so every device shows the same entry each day.
// Words and expressions advance separately, so that no entry of either list is skipped.
export function dailyEntry(daily, date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
  if (day % EXPRESSION_EVERY === EXPRESSION_EVERY - 1) {
    const index = Math.floor(day / EXPRESSION_EVERY) % daily.expressions.length;
    return { title: "Expresión do día", ...daily.expressions[index] };
  }
  const wordDays = day - Math.floor((day + 1) / EXPRESSION_EVERY);
  return { title: "Palabra do día", ...daily.words[wordDays % daily.words.length] };
}

export function dailyPanel(daily) {
  const entry = dailyEntry(daily);
  return el(
    "aside",
    { class: "side-panel daily-panel" },
    el("h2", {}, entry.title),
    el("p", { class: "daily-term" }, entry.gl),
    el("p", {}, entry.def),
    el("p", { class: "daily-translation" }, "En castelán: ", el("strong", { lang: "es" }, entry.es))
  );
}
