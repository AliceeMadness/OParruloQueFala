import { achievementCounts } from "../achievements.js";
import { formatPlayTime } from "../playtime.js";
import { activeProfile, profileDetails, saveProfileDetails, totalPlayTime } from "../store.js";
import { avatar, el } from "../ui.js";

export function profilePageView(site, { done, total }) {
  const profile = activeProfile();
  const details = profileDetails();
  const achievements = achievementCounts(site);
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
    el(
      "div",
      { class: "profile-heading" },
      avatar(profile),
      el("h1", {}, profile.name)
    ),
    el(
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
      el("p", {}, el("a", { href: "#/logros" }, `Logros: ${achievements.done} de ${achievements.total}`)),
      el(
        "p",
        { title: "Só conta o tempo facendo exercicios, non o tempo coa web aberta" },
        "Tempo facendo exercicios: ",
        el("strong", {}, formatPlayTime(totalPlayTime()))
      )
    ),
    el(
      "div",
      { class: "panel profile-fields" },
      el("label", { htmlFor: "profile-description" }, "Descrición"),
      description,
      el("label", { htmlFor: "profile-word" }, "Palabra favorita"),
      favoriteWord,
      el("p", { class: "muted" }, "Gárdase automaticamente.")
    )
  );
}
