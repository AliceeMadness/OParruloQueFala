import { achievementsView, buildAchievements, checkAchievements } from "./achievements.js";
import { dailyListView, drawDailyPanel } from "./daily.js";
import { showSplash, talkingDuck } from "./ducks.js";
import { crosswordListView, crosswordView } from "./modes/crosswords.js";
import { grammarLessonView, grammarMode } from "./modes/grammar.js";
import { profilePageView } from "./modes/profile.js";
import { verbLessonView, verbsMode } from "./modes/verbs.js";
import { collectionStudyView, collectionView } from "./modes/collection.js";
import { reviewView, vocabularyLessonView, vocabularyMode } from "./modes/vocabulary.js";
import { startPlayTimer } from "./playtime.js";
import { activeProfile, bestScore, checkPassword, collectionSize, completedBy, crosswordState, GUEST, isSyncFailing, mistakes, PROFILES, pullProgress, refreshOtherProfiles, selectProfile, startSync } from "./store.js";
import { avatar, catalogueView, el, focusSoon, replace } from "./ui.js";

const app = document.getElementById("app");
const progressPanel = document.getElementById("panel-progress");
const dailyPanel = document.getElementById("panel-daily");
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

function lessonKeysOf(mode) {
  return mode.groups.flatMap((group) => group.lessons.map((lesson) => `${mode.path}/${group.id}/${lesson.id}`));
}

// Rounds down, so that 100% only appears when everything is really done.
function percentLabel(done, total) {
  if (done > 0 && done * 100 < total) return "<1%";
  return `${Math.floor((done * 100) / total)}%`;
}

// Returns the function that redraws the bars, so they can follow each saved lesson.
function buildProgressPanel(site) {
  const { lessonKeys, crosswordIds, total } = site.activities;
  const list = el("ul", { class: "standings" });

  function draw() {
    const active = activeProfile();
    list.replaceChildren(...PROFILES.map((profile) => {
      const done = completedBy(profile.id, lessonKeys, crosswordIds);
      const label = done === null ? "—" : percentLabel(done, total);
      return el(
        "li",
        { class: profile === active ? "current" : null },
        el("div", { class: "standing-name" }, avatar(profile), el("span", {}, profile.name), el("span", { class: "standing-percent" }, label)),
        el(
          "div",
          {
            class: "standing-bar",
            role: "progressbar",
            "aria-label": `Progreso de ${profile.name}`,
            "aria-valuemin": 0,
            "aria-valuemax": total,
            "aria-valuenow": done ?? 0,
            title: done === null ? "Aínda non hai datos deste perfil" : `${done} de ${total} completados`,
          },
          el("div", { style: `width: ${((done ?? 0) * 100) / total}%` })
        )
      );
    }));
  }

  progressPanel.replaceChildren(el("h2", {}, "Progreso total"), list);
  return draw;
}

function homeView(site) {
  const { vocabulary, verbs, grammar, crosswords } = site;
  const card = (href, title, text, { done, total }) => el(
    "a",
    { class: "mode-card", href },
    el("h2", {}, title),
    el("p", {}, text),
    el("span", { class: "count" }, `${done} de ${total} completados`)
  );
  const pending = mistakes().length;
  const saved = collectionSize();

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
        el("p", { class: "lead" }, "Vocabulario, verbos, gramática e encrucillados, do máis sinxelo ao máis atrevido. O teu progreso vai contigo en calquera dispositivo.")
      )
    ),
    el(
      "div",
      { class: "mode-grid" },
      card("#/vocabulario", "Vocabulario", "Escribe en galego as palabras que che damos en castelán.", countDone(vocabulary)),
      card("#/verbos", "Verbos", "Conxuga as seis persoas dos verbos, por temas e tempos.", countDone(verbs)),
      card("#/gramatica", "Gramática", "Completa frases e aprende, por fin, onde van os pronomes.", countDone(grammar)),
      card("#/encrucillados", "Encrucillados", `Para os máis atrevidos: ${crosswords.length} retos con palabras novas.`, {
        done: crosswords.filter((puzzle) => crosswordState(puzzle.id).done).length,
        total: crosswords.length,
      }),
      activeProfile().guest ? null : el(
        "a",
        { class: "mode-card", href: "#/coleccion" },
        el("h2", {}, "A miña colección"),
        el("p", {}, "As palabras, formas verbais e frases que gardaches porque aínda non as sabes, para estudalas cando queiras."),
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

function chooseProfileView(site) {
  const active = activeProfile();
  const login = el("div", {});

  async function enter(id) {
    selectProfile(id);
    await pullWithLimit();
    refreshPanels(site);
    checkAchievements(site);
    if (location.hash.startsWith("#/cambiar-perfil")) location.hash = "#/";
    else render(site);
  }

  function askPassword(profile) {
    for (const option of options) option.classList.toggle("chosen", option.dataset.id === profile.id);
    const input = el("input", {
      id: "profile-password",
      type: "password",
      autocomplete: "current-password",
      autocapitalize: "none",
      spellcheck: false,
    });
    const error = el("p", { class: "feedback wrong", hidden: true, "aria-live": "polite" }, "Contrasinal incorrecto.");
    replace(login, el(
      "form",
      {
        class: "panel password-form",
        async onsubmit(event) {
          event.preventDefault();
          if (await checkPassword(profile, input.value)) {
            await enter(profile.id);
          } else {
            error.hidden = false;
            input.select();
          }
        },
      },
      el("label", { htmlFor: "profile-password" }, `Contrasinal de ${profile.name}`),
      input,
      error,
      el("div", { class: "actions" }, el("button", { class: "button", type: "submit" }, "Entrar"))
    ));
    focusSoon(input);
  }

  const options = PROFILES.map((profile) => el(
    "button",
    {
      class: `profile-option${profile === active ? " current" : ""}`,
      type: "button",
      "data-id": profile.id,
      onclick: () => askPassword(profile),
    },
    avatar(profile),
    profile.name
  ));

  return el(
    "div",
    { class: "narrow" },
    el("h1", {}, "Quen vai xogar?"),
    el("p", { class: "lead" }, "Cada perfil garda o seu propio progreso, entres desde onde entres."),
    el("div", { class: "profile-grid" }, ...options),
    login,
    el(
      "div",
      { class: "guest-option" },
      el("button", { class: "button secondary", type: "button", onclick: () => enter(GUEST.id) }, "Xogar sen perfil"),
      el("small", {}, "Podes xogar a todo, pero sen a túa colección, e o progreso só se garda neste navegador.")
    )
  );
}

function closeProfileMenu() {
  document.getElementById("profile-dropdown").hidden = true;
  document.getElementById("profile-chip").setAttribute("aria-expanded", "false");
}

function setUpProfileMenu() {
  const chip = document.getElementById("profile-chip");
  const dropdown = document.getElementById("profile-dropdown");
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    chip.setAttribute("aria-expanded", String(!dropdown.hidden));
  });
  document.addEventListener("click", closeProfileMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dropdown.hidden) {
      closeProfileMenu();
      chip.focus();
    }
  });
}

function updateProfileChip() {
  const chip = document.getElementById("profile-chip");
  const profile = activeProfile();
  chip.hidden = !profile;
  document.getElementById("nav-collection").hidden = Boolean(profile?.guest);
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

// Lessons in progress and typed searches keep their state, so only other pages are redrawn.
function isSafeToRedraw() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return parts.length <= 1 && !["repaso", "palabras-do-dia", "perfil"].includes(parts[0]);
}

function updatePanels(site) {
  const visible = Boolean(activeProfile());
  progressPanel.hidden = !visible;
  dailyPanel.hidden = !visible;
  if (visible) {
    site.drawProgress();
    drawDailyPanel(dailyPanel, site.daily);
  }
}

function refreshPanels(site) {
  updatePanels(site);
  refreshOtherProfiles().then(() => updatePanels(site));
}

function guestCollectionView() {
  return el(
    "div",
    { class: "narrow" },
    el("h1", {}, "A miña colección"),
    el("p", { class: "lead" }, "A colección é de cada perfil. Entra co teu para gardar as palabras, verbos e frases que non saibas."),
    el("a", { class: "button", href: "#/cambiar-perfil" }, "Escoller perfil")
  );
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
  if (!activeProfile() || section === "cambiar-perfil") return chooseProfileView(site);
  if (!section) return homeView(site);
  if (section === "perfil") {
    const { lessonKeys, crosswordIds, total } = site.activities;
    return profilePageView(site, { done: completedBy(activeProfile().id, lessonKeys, crosswordIds) ?? 0, total });
  }
  if (section === "logros") return achievementsView(site);
  if (section === "repaso") return reviewView();
  if (section === "palabras-do-dia") return dailyListView(site.daily);
  if (section === "coleccion" && activeProfile().guest) return guestCollectionView();
  if (section === "coleccion") {
    // "estudar" is the address the collection had when it only held vocabulary.
    if (first === "estudar") return collectionStudyView("vocabulario");
    return first ? collectionStudyView(first, second) : collectionView();
  }
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
  closeProfileMenu();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const view = route(site, parts) ?? notFoundView();
  app.replaceChildren(view);
  updateProfileChip();
  updatePanels(site);
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
    const [vocabulary, verbData, grammar, crosswords, daily] = await Promise.all(
      ["vocabulary", "verbs", "grammar", "crosswords", "daily"].map(fetchJson)
    );
    const site = {
      vocabulary: vocabularyMode(vocabulary),
      verbs: verbsMode(verbData),
      verbData,
      grammar: grammarMode(grammar),
      crosswords,
      daily,
    };
    const lessonKeys = [site.vocabulary, site.verbs, site.grammar].flatMap(lessonKeysOf);
    const crosswordIds = crosswords.map((puzzle) => puzzle.id);
    site.activities = { lessonKeys, crosswordIds, total: lessonKeys.length + crosswordIds.length };
    site.achievements = buildAchievements(site);
    site.drawProgress = buildProgressPanel(site);
    setUpProfileMenu();
    window.addEventListener("hashchange", () => render(site));
    startPlayTimer();
    startSync({
      onProgressChange() {
        updatePanels(site);
        checkAchievements(site);
        if (isSafeToRedraw()) render(site);
      },
      onSyncChange: updateProfileChip,
      onSaved() {
        updatePanels(site);
        checkAchievements(site);
      },
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && activeProfile()) refreshPanels(site);
    });
    await pullWithLimit();
    render(site);
    if (activeProfile()) refreshPanels(site);
    checkAchievements(site);
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
