import { achievementCounts } from "../achievements.js";
import { formatPlayTime } from "../playtime.js";
import { activeProfile, completedBy, profileDetails, refreshOtherProfiles, saveProfileDetails, savedProgress, totalPlayTime } from "../store.js";
import { avatar, backLink, el } from "../ui.js";

function heading(profile) {
  return el("div", { class: "profile-heading" }, avatar(profile), el("h1", {}, profile.name));
}

// `achievementsHref` is only given for the active profile, whose achievements page exists.
function progressPanel({ done, total, achievements, playTime, achievementsHref }) {
  const achievementsText = `Logros: ${achievements.done} de ${achievements.total}`;
  return el(
    "div",
    { class: "panel profile-progress" },
    el(
      "p",
      {},
      el("strong", {}, `${done}/${total}`),
      " leccións e encrucillados feitos"
    ),
    el(
      "div",
      {
        class: "standing-bar",
        role: "progressbar",
        "aria-label": "Progreso total",
        "aria-valuemin": 0,
        "aria-valuemax": total,
        "aria-valuenow": done,
      },
      el("div", { style: `width: ${(done * 100) / total}%` })
    ),
    el("p", {}, achievementsHref ? el("a", { href: achievementsHref }, achievementsText) : achievementsText),
    el(
      "p",
      { title: "Só conta o tempo facendo exercicios, non o tempo coa web aberta" },
      "Tempo facendo exercicios: ",
      el("strong", {}, formatPlayTime(playTime))
    )
  );
}

export function profilePageView(site, { done, total }) {
  const profile = activeProfile();
  const details = profileDetails();
  const save = () => saveProfileDetails({ description: description.value, favoriteWord: favoriteWord.value });
  const description = el("textarea", {
    id: "profile-description",
    rows: 4,
    maxLength: 300,
    value: details.description,
    placeholder: "Conta algo sobre ti",
    oninput: save,
  });
  const favoriteWord = el("input", {
    id: "profile-word",
    type: "text",
    maxLength: 40,
    value: details.favoriteWord,
    placeholder: "A túa palabra galega preferida",
    autocomplete: "off",
    spellcheck: false,
    oninput: save,
  });

  return el(
    "div",
    { class: "narrow" },
    heading(profile),
    progressPanel({
      done,
      total,
      achievements: achievementCounts(site),
      playTime: totalPlayTime(),
      achievementsHref: "#/logros",
    }),
    el(
      "div",
      { class: "panel profile-fields" },
      el("label", { htmlFor: "profile-description" }, "Descrición"),
      description,
      el("label", { htmlFor: "profile-word" }, "Palabra favorita"),
      favoriteWord,
      el("p", { class: "muted" }, profile.guest
        ? "Gárdase automaticamente neste navegador."
        : "Gárdase automaticamente. Os outros perfiles tamén poden velo.")
    )
  );
}

// Another profile, only to look at: it shows what this device last read of it and
// redraws once the latest version arrives.
export function otherProfileView(site, profile) {
  const view = el("div", { class: "narrow" });

  function draw() {
    const saved = savedProgress(profile.id);
    const { lessonKeys, crosswordIds, total } = site.activities;
    const body = saved
      ? [
          progressPanel({
            done: completedBy(profile.id, lessonKeys, crosswordIds),
            total,
            achievements: achievementCounts(site, saved.achievements ?? {}),
            playTime: totalPlayTime(profile.id),
          }),
          el(
            "div",
            { class: "panel profile-fields" },
            el("h2", { class: "profile-field-name" }, "Descrición"),
            el("p", { class: `profile-value${saved.details.description ? "" : " muted"}` }, saved.details.description || "Aínda non escribiu nada."),
            el("h2", { class: "profile-field-name" }, "Palabra favorita"),
            el("p", { class: `profile-value${saved.details.favoriteWord ? "" : " muted"}`, lang: saved.details.favoriteWord ? "gl" : null }, saved.details.favoriteWord || "Aínda non escolleu ningunha.")
          ),
        ]
      : [el("p", { class: "lead" }, "Aínda non hai datos deste perfil. Comproba a conexión e volve probar.")];
    view.replaceChildren(backLink("#/", "Volver ao inicio"), heading(profile), ...body);
  }

  draw();
  refreshOtherProfiles().then(() => {
    if (view.isConnected) draw();
  });
  return view;
}
