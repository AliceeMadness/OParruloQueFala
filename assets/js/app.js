import { showSplash, talkingDuck } from "./ducks.js";
import { crosswordListView, crosswordView } from "./modes/crosswords.js";
import { grammarLessonView, grammarMode } from "./modes/grammar.js";
import { verbLessonView, verbsMode } from "./modes/verbs.js";
import { collectionStudyView, collectionView, reviewView, vocabularyLessonView, vocabularyMode } from "./modes/vocabulary.js";
import { activeProfile, bestScore, collection, crosswordState, isSyncFailing, mistakes, PROFILES, pullProgress, selectProfile, startSync } from "./store.js";
import { avatar, catalogueView, el } from "./ui.js";

const app = document.getElementById("app");
const PULL_LIMIT_MS = 4000;

// Relative URLs, because GitHub Pages serves the site under /OParruloQueFala/.
async function fetchJson(name) {
  const response = await fetch(`data/${name}.json`);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  return response.json();
}

function countDone(mode) {
  let done = 0;
  let total = 0;
  for (const group of mode.groups) {
    for (const lesson of group.lessons) {
      total++;
      if (bestScore(`${mode.path}/${group.id}/${lesson.id}`) !== undefined) done++;
    }
  }
  return { done, total };
}

function homeView({ vocabulary, verbs, grammar, crosswords }) {
  const card = (href, title, text, { done, total }) => el(
    "a",
    { class: "mode-card", href },
    el("h2", {}, title),
    el("p", {}, text),
    el("span", { class: "count" }, `${done} de ${total} completados`)
  );
  const pending = mistakes().length;
  const saved = collection().length;

  return el(
    "div",
    {},
    el(
      "div",
      { class: "hero" },
      talkingDuck(),
      el(
        "div",
        {},
        el("h1", {}, "Aprende galego co parrulo"),
        el("p", { class: "lead" }, "Vocabulario, verbos, gramática e encrucillados, do máis sinxelo ao máis atrevido. O teu progreso gárdase neste navegador.")
      )
    ),
    el(
      "div",
      { class: "mode-grid" },
      card("#/vocabulario", "Vocabulario", "Escribe en galego as palabras que che damos en castelán.", countDone(vocabulary)),
      card("#/verbos", "Verbos", "Conxuga as seis persoas dos verbos, por temas e tempos.", countDone(verbs)),
      card("#/gramatica", "Gramática", "Completa frases e aprende, por fin, onde van os pronomes.", countDone(grammar)),
      card("#/encrucillados", "Encrucillados", "Para os máis atrevidos: 20 retos con palabras novas.", {
        done: crosswords.filter((puzzle) => crosswordState(puzzle.id).done).length,
        total: crosswords.length,
      }),
      el(
        "a",
        { class: "mode-card", href: "#/coleccion" },
        el("h2", {}, "A miña colección"),
        el("p", {}, "As palabras que gardaches porque aínda non as sabes, para estudalas cando queiras."),
        el("span", { class: "count" }, `${saved} ${saved === 1 ? "palabra" : "palabras"}`)
      )
    ),
    pending
      ? el(
          "div",
          { class: "review-banner" },
          el("span", {}, `Tes ${pending} ${pending === 1 ? "palabra" : "palabras"} para repasar.`),
          el("a", { class: "button", href: "#/repaso" }, "Repasar")
        )
      : null
  );
}

function profileView(site) {
  const active = activeProfile();
  return el(
    "div",
    { class: "narrow" },
    el("h1", {}, "Quen vai xogar?"),
    el("p", { class: "lead" }, "Cada perfil garda o seu propio progreso neste navegador."),
    el(
      "div",
      { class: "profile-grid" },
      ...PROFILES.map((profile) => el(
        "button",
        {
          class: `profile-option${profile === active ? " current" : ""}`,
          type: "button",
          async onclick() {
            selectProfile(profile.id);
            await pullWithLimit();
            if (location.hash.startsWith("#/perfil")) location.hash = "#/";
            else render(site);
          },
        },
        avatar(profile),
        profile.name
      ))
    )
  );
}

function updateProfileChip() {
  const chip = document.getElementById("profile-chip");
  const profile = activeProfile();
  chip.hidden = !profile;
  chip.replaceChildren(...(profile ? [avatar(profile), profile.name] : []));
  if (profile && isSyncFailing()) {
    chip.append(el("span", {
      class: "sync-warning",
      title: "Sen conexión: o progreso gárdase neste navegador e sincronizarase cando volva a conexión",
    }, "⚠"));
  }
}

// A slow connection must not hold the page back: if the reply comes later, the
// progress is merged then and the page redraws.
function pullWithLimit() {
  return Promise.race([pullProgress(), new Promise((resolve) => setTimeout(resolve, PULL_LIMIT_MS))]);
}

// Lessons in progress keep their state, so only pages without one are redrawn.
function isSafeToRedraw() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return parts.length <= 1 && parts[0] !== "repaso";
}

function notFoundView() {
  return el(
    "div",
    { class: "narrow" },
    el("h1", {}, "Non atopamos esta páxina"),
    el("p", { class: "lead" }, "Pode que a lección cambiase de nome."),
    el("a", { class: "button", href: "#/" }, "Volver ao inicio")
  );
}

function route(site, parts) {
  const [section, first, second] = parts;
  if (!activeProfile() || section === "perfil") return profileView(site);
  if (!section) return homeView(site);
  if (section === "repaso") return reviewView();
  if (section === "coleccion") return first === "estudar" ? collectionStudyView() : first ? null : collectionView();
  if (section === "vocabulario") {
    return first ? vocabularyLessonView(site.vocabulary, first, second) : catalogueView(site.vocabulary);
  }
  if (section === "verbos") {
    return first ? verbLessonView(site.verbs, site.verbData, first, second) : catalogueView(site.verbs);
  }
  if (section === "gramatica") {
    return first ? grammarLessonView(site.grammar, first, second) : catalogueView(site.grammar);
  }
  if (section === "encrucillados") {
    return first ? crosswordView(site.crosswords, first) : crosswordListView(site.crosswords);
  }
  return null;
}

function render(site) {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const view = route(site, parts) ?? notFoundView();
  app.replaceChildren(view);
  updateProfileChip();
  window.scrollTo(0, 0);
  for (const link of document.querySelectorAll(".site-header nav a")) {
    if (link.getAttribute("href") === `#/${parts[0]}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  app.focus({ preventScroll: true });
}

async function main() {
  showSplash();
  try {
    const [vocabulary, verbData, grammar, crosswords] = await Promise.all(
      ["vocabulary", "verbs", "grammar", "crosswords"].map(fetchJson)
    );
    const site = {
      vocabulary: vocabularyMode(vocabulary),
      verbs: verbsMode(verbData),
      verbData,
      grammar: grammarMode(grammar),
      crosswords,
    };
    window.addEventListener("hashchange", () => render(site));
    startSync({
      onProgressChange() {
        if (isSafeToRedraw()) render(site);
      },
      onSyncChange: updateProfileChip,
    });
    await pullWithLimit();
    render(site);
  } catch (error) {
    console.error(error);
    app.replaceChildren(el(
      "div",
      { class: "narrow" },
      el("h1", {}, "Non se puido cargar o contido"),
      el("p", { class: "lead" }, "Comproba a túa conexión e recarga a páxina. Se abriches o ficheiro directamente, precisas un servidor local: mira o README.")
    ));
  }
}

main();
