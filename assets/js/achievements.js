import { addEarnedAchievements, activeProfile, bestScore, collectionSize, crosswordState, earnedAchievements, eventCount, playDays, totalPlayTime } from "./store.js";
import { el } from "./ui.js";

const TOAST_MS = 5000;
// Matches toast-out in styles.css: the next toast waits until this one has faded away.
const TOAST_FADE_MS = 400;
const TOAST_GAP_MS = 250;

function lessonKeys(mode, level) {
  return mode.groups
    .filter((group) => level === undefined || group.level === level)
    .flatMap((group) => group.lessons.map((lesson) => `${mode.path}/${group.id}/${lesson.id}`));
}

// A share of a list counts as reached only if the list has something in it.
function reachedShare(done, total, percent) {
  return total > 0 && done * 100 >= percent * total;
}

function doneLessons(keys) {
  return keys.filter((key) => bestScore(key) !== undefined).length;
}

function donePuzzles(puzzles) {
  return puzzles.filter((puzzle) => crosswordState(puzzle.id).done).length;
}

function lessonGoal(id, title, description, keys, percent = 100) {
  return { id, title, description, reached: () => reachedShare(doneLessons(keys), keys.length, percent) };
}

// The title is read each time it is shown, because it depends on the active profile.
function withFeminine(goal, feminine) {
  const masculine = goal.title;
  return {
    ...goal,
    get title() {
      return activeProfile()?.gender === "f" ? feminine : masculine;
    },
  };
}

// Anything counted, reached once `value()` gets to `target`.
function countGoal(id, title, description, value, target) {
  return { id, title, description, reached: () => value() >= target };
}

// The longest run of days played one after another.
function longestStreak() {
  const days = playDays().map((day) => Date.parse(`${day}T00:00:00Z`) / 86400000).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((day, index) => {
    run = index > 0 && day - days[index - 1] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

const HOUR_MS = 3600000;

function puzzleGoal(id, title, description, puzzles, percent = 100) {
  return { id, title, description, reached: () => reachedShare(donePuzzles(puzzles), puzzles.length, percent) };
}

export function buildAchievements(site) {
  const { vocabulary, verbs, grammar, crosswords } = site;
  const vocabularyKeys = lessonKeys(vocabulary);
  const verbKeys = lessonKeys(verbs);
  const allKeys = [...vocabularyKeys, ...verbKeys, ...lessonKeys(grammar)];
  const total = allKeys.length + crosswords.length;
  const overall = (id, title, percent) => ({
    id,
    title,
    description: `Completa o ${percent} % de toda a aplicación.`,
    reached: () => reachedShare(doneLessons(allKeys) + donePuzzles(crosswords), total, percent),
  });
  const puzzlesOf = (level) => crosswords.filter((puzzle) => puzzle.level === level);
  const perfect = (keys) => keys.filter((key) => bestScore(key) === 100).length;
  const verbSection = (section) => verbs.groups
    .filter((group) => group.section === section)
    .flatMap((group) => group.lessons.map((lesson) => `${verbs.path}/${group.id}/${lesson.id}`));
  const regularVerbs = ["Primeira conxugación (-ar)", "Segunda conxugación (-er)", "Terceira conxugación (-ir)"].flatMap(verbSection);
  const streak = (id, title, days) => countGoal(id, title, `Fai exercicios ${days} días seguidos.`, longestStreak, days);
  const daysPlayed = (id, title, days) => countGoal(id, title, `Fai exercicios ${days} días distintos.`, () => playDays().length, days);
  const hours = (id, title, count) => countGoal(id, title, `Fai exercicios durante ${count} ${count === 1 ? "hora" : "horas"} en total.`, () => totalPlayTime() / HOUR_MS, count);
  const lessonsDone = (id, title, count) => countGoal(id, title, `Completa ${count} ${count === 1 ? "lección" : "leccións"}, de vocabulario, verbos ou gramática.`, () => doneLessons(allKeys), count);
  const lessonsPerfect = (id, title, count) => countGoal(id, title, `Consegue un 100 % en ${count} ${count === 1 ? "lección" : "leccións"}.`, () => perfect(allKeys), count);
  const allPerfect = (id, title, what, keys) => ({ id, title, description: `Consegue un 100 % en todas as leccións de ${what}.`, reached: () => keys.length > 0 && perfect(keys) === keys.length });

  return [
    {
      title: "Vocabulario",
      items: [
        lessonGoal("vocabulario-1", "Aprendiz do vocabulario", "Completa todas as leccións de iniciación de vocabulario.", lessonKeys(vocabulary, 1)),
        withFeminine(lessonGoal("vocabulario-2", "Coñecedor do vocabulario", "Completa todas as leccións de nivel intermedio de vocabulario.", lessonKeys(vocabulary, 2)), "Coñecedora do vocabulario"),
        withFeminine(lessonGoal("vocabulario-3", "Sabio do vocabulario", "Completa todas as leccións de nivel avanzado de vocabulario.", lessonKeys(vocabulary, 3)), "Sabia do vocabulario"),
        withFeminine(lessonGoal("vocabulario-4", "Rei do vocabulario", "Completa todas as leccións de nivel experto de vocabulario.", lessonKeys(vocabulary, 4)), "Raíña do vocabulario"),
        lessonGoal("vocabulario-25", "Aínda sei poucas palabras", "Completa o 25 % do vocabulario.", vocabularyKeys, 25),
        lessonGoal("vocabulario-50", "Sei algunhas palabras", "Completa o 50 % do vocabulario.", vocabularyKeys, 50),
        lessonGoal("vocabulario-75", "Pensei que isto acababa aquí", "Completa o 75 % do vocabulario.", vocabularyKeys, 75),
        withFeminine(lessonGoal("vocabulario-100", "De nome Galego e de apelido Vocabulario", "Completa todo o vocabulario.", vocabularyKeys), "De nome Galega e de apelido Vocabulario"),
      ],
    },
    {
      title: "Verbos",
      items: [
        lessonGoal("verbos-1", "Aprendiz dos verbos", "Completa todas as leccións de iniciación de verbos.", lessonKeys(verbs, 1)),
        withFeminine(lessonGoal("verbos-2", "Coñecedor dos verbos", "Completa todas as leccións de nivel intermedio de verbos.", lessonKeys(verbs, 2)), "Coñecedora dos verbos"),
        withFeminine(lessonGoal("verbos-3", "Sabio dos verbos", "Completa todas as leccións de nivel avanzado de verbos.", lessonKeys(verbs, 3)), "Sabia dos verbos"),
        withFeminine(lessonGoal("verbos-4", "Rei dos verbos", "Completa todas as leccións de nivel experto de verbos.", lessonKeys(verbs, 4)), "Raíña dos verbos"),
        lessonGoal("verbos-25", "Non me creo nada", "Completa o 25 % dos verbos.", verbKeys, 25),
        lessonGoal("verbos-50", "Como que isto é só a metade", "Completa o 50 % dos verbos.", verbKeys, 50),
        lessonGoal("verbos-75", "HAI MÁIS?!", "Completa o 75 % dos verbos.", verbKeys, 75),
        lessonGoal("verbos-100", "De segundo nome Verbum", "Completa todos os verbos.", verbKeys),
      ],
    },
    {
      title: "Gramática",
      items: [
        lessonGoal("gramatica-1", "Aprendiz da gramática", "Completa todas as leccións de iniciación de gramática.", lessonKeys(grammar, 1)),
        withFeminine(lessonGoal("gramatica-2", "Coñecedor da gramática", "Completa todas as leccións de nivel intermedio de gramática.", lessonKeys(grammar, 2)), "Coñecedora da gramática"),
        withFeminine(lessonGoal("gramatica-3", "Sabio da gramática", "Completa todas as leccións avanzadas de gramática.", lessonKeys(grammar, 3)), "Sabia da gramática"),
        withFeminine(lessonGoal("gramatica-rei", "Rei da gramática", "Completa todas as leccións de gramática.", lessonKeys(grammar)), "Raíña da gramática"),
      ],
    },
    {
      title: "Encrucillados",
      items: [
        puzzleGoal("encrucillados-1", "Aprendiz dos encrucillados", "Resolve todos os encrucillados doados.", puzzlesOf(1)),
        withFeminine(puzzleGoal("encrucillados-2", "Coñecedor dos encrucillados", "Resolve todos os encrucillados medios.", puzzlesOf(2)), "Coñecedora dos encrucillados"),
        withFeminine(puzzleGoal("encrucillados-3", "Sabio dos encrucillados", "Resolve todos os encrucillados avanzados.", puzzlesOf(3)), "Sabia dos encrucillados"),
        withFeminine(puzzleGoal("encrucillados-rei", "Rei dos encrucillados", "Resolve todos os encrucillados.", crosswords), "Raíña dos encrucillados"),
        puzzleGoal("encrucillados-50", "Gústanme os encrucillados", "Resolve o 50 % dos encrucillados.", crosswords, 50),
        puzzleGoal("encrucillados-100", "Quero máis encrucillados", "Resolve todos os encrucillados, e pide máis.", crosswords),
      ],
    },
    {
      title: "A miña colección",
      items: [
        { id: "coleccion-1", title: "Gústame esta palabra", description: "Engade unha palabra á túa colección.", reached: () => collectionSize() >= 1 },
        countGoal("coleccion-10", "Isto vai para a libreta", "Ten 10 palabras na túa colección.", collectionSize, 10),
        countGoal("coleccion-50", "Colecciono palabras coma quen colecciona selos", "Ten 50 palabras na túa colección.", collectionSize, 50),
        { id: "coleccion-100", title: "Esta última si que non a sabía", description: "Ten 100 palabras na túa colección.", reached: () => collectionSize() >= 100 },
        countGoal("coleccion-250", "A miña colección ten colección", "Ten 250 palabras na túa colección.", collectionSize, 250),
      ],
    },
    {
      title: "Constancia",
      items: [
        streak("racha-2", "Volvín!", 2),
        streak("racha-3", "Isto vai en serio", 3),
        streak("racha-7", "Unha semana enteiriña", 7),
        streak("racha-14", "Dúas semanas sen faltar á cita", 14),
        streak("racha-30", "Un mes sen saltar nin un día", 30),
        streak("racha-100", "Cen días seguidos: isto xa é vicio", 100),
        daysPlayed("dias-10", "Dez días de galego", 10),
        daysPlayed("dias-50", "Medio cento de días", 50),
        daysPlayed("dias-100", "Cen días de parrulo", 100),
        daysPlayed("dias-365", "Un ano de galego", 365),
      ],
    },
    {
      title: "Tempo de xogo",
      items: [
        hours("horas-1", "Unha horiña de nada", 1),
        hours("horas-5", "Xa levo un anaco", 5),
        hours("horas-10", "Dez horas de parrulo", 10),
        hours("horas-24", "Un día enteiro falando galego", 24),
        hours("horas-50", "Isto xa é un máster", 50),
        hours("horas-100", "Cen horas: o parrulo es ti", 100),
        countGoal("noite", "Parrulo noctámbulo", "Fai exercicios entre a medianoite e as cinco da mañá.", () => eventCount("noite"), 1),
        withFeminine(countGoal("madrugada", "Madrugador", "Fai exercicios entre as cinco e as sete da mañá.", () => eventCount("madrugada"), 1), "Madrugadora"),
      ],
    },
    {
      title: "Leccións",
      items: [
        lessonsDone("leccions-1", "O primeiro paso", 1),
        lessonsDone("leccions-10", "Quentando motores", 10),
        lessonsDone("leccions-50", "Xa non hai quen me pare", 50),
        lessonsDone("leccions-100", "Cen leccións e subindo", 100),
        lessonsDone("leccions-250", "Isto é unha maratón", 250),
        lessonsDone("leccions-500", "Medio milleiro", 500),
      ],
    },
    {
      title: "Ao 100 %",
      items: [
        lessonsPerfect("perfectas-1", "O primeiro 100 %", 1),
        lessonsPerfect("perfectas-10", "Dez de dez", 10),
        lessonsPerfect("perfectas-25", "Sen un erro", 25),
        lessonsPerfect("perfectas-50", "Perfeccionista", 50),
        lessonsPerfect("perfectas-100", "Cen veces perfecto", 100),
        lessonsPerfect("perfectas-250", "Isto xa é obsesión", 250),
        allPerfect("perfecto-vocabulario", "Dicionario con patas", "vocabulario", vocabularyKeys),
        allPerfect("perfecto-verbos", "Conxugo ata durmindo", "verbos", verbKeys),
        allPerfect("perfecto-gramatica", "Nin unha coma fóra do sitio", "gramática", lessonKeys(grammar)),
      ],
    },
    {
      title: "Verbos por partes",
      items: [
        lessonGoal("verbos-regulares", "Falo, como e parto", "Completa todos os tempos de falar, comer e partir.", regularVerbs),
        lessonGoal("verbos-basicos", "Irregular, pero meu", "Completa todos os verbos irregulares básicos.", verbSection("Verbos irregulares básicos")),
        lessonGoal("verbos-avanzados", "Os irregulares non me asustan", "Completa todos os verbos irregulares avanzados.", verbSection("Verbos irregulares avanzados")),
        lessonGoal("verbos-perifrases", "Perifrasticamente falando", "Completa todas as perífrases e outras expresións.", verbSection("Perífrases e outras expresións")),
      ],
    },
    {
      title: "Exame e Dudoiro",
      items: [
        countGoal("exame-1", "Non esquecín nada... creo", "Remata un exame de «Non hai que esquecer o aprendido».", () => eventCount("exames"), 1),
        countGoal("exame-10", "Exame tras exame", "Remata 10 exames.", () => eventCount("exames"), 10),
        countGoal("exame-perfecto", "Memoria de elefante", "Acerta todas as preguntas dun exame á primeira.", () => eventCount("examesPerfectos"), 1),
        countGoal("dudoiro-1", "Dubido, logo existo", "Remata unha rolda do Dudoiro.", () => eventCount("dudoiro"), 1),
        countGoal("dudoiro-10", "Xa non dubido tanto", "Remata 10 roldas do Dudoiro.", () => eventCount("dudoiro"), 10),
        countGoal("dudoiro-50", "Dudoiro profesional", "Remata 50 roldas do Dudoiro.", () => eventCount("dudoiro"), 50),
        countGoal("dudoiro-perfecto", "Nin unha i fóra do sitio", "Acerta as 20 palabras dunha rolda do Dudoiro á primeira.", () => eventCount("dudoiroPerfecto"), 1),
        withFeminine(countGoal("dudoiro-perfecto-10", "O rei da i", "Fai 10 roldas perfectas do Dudoiro.", () => eventCount("dudoiroPerfecto"), 10), "A raíña da i"),
      ],
    },
    {
      title: "Toda a aplicación",
      items: [
        withFeminine(overall("total-25", "O mellor da miña casa (sen contar o can)", 25), "A mellor da miña casa (sen contar o can)"),
        overall("total-50", "Creo que xa podo vivir en Santiago", 50),
        overall("total-75", "O galego é o meu", 75),
        withFeminine(overall("total-100", "Podo xa chamarme galego", 100), "Podo xa chamarme galega"),
      ],
    },
    {
      title: "Logro épico",
      items: [
        {
          id: "epico",
          epic: true,
          title: "Cando sae o Galego 2??",
          description: "Consegue un 100 % en todas as leccións e resolve todos os encrucillados.",
          reached: () => allKeys.every((key) => bestScore(key) === 100) && donePuzzles(crosswords) === crosswords.length,
        },
      ],
    },
  ];
}

// Toasts ------------------------------------------------------------------------

const queue = [];
let showing = false;

function showNextToast() {
  const achievement = queue.shift();
  if (!achievement) {
    showing = false;
    return;
  }
  showing = true;
  let timer = null;
  let closing = false;
  const toast = el(
    "button",
    {
      class: "achievement-toast",
      type: "button",
      "aria-label": `Pechar: ${achievement.title}`,
      onclick: close,
    },
    el("span", { class: "achievement-toast-label" }, achievement.epic ? "Logro épico" : "Logro conseguido"),
    el("strong", {}, achievement.title),
    el("span", {}, achievement.description)
  );

  function close() {
    if (closing) return;
    closing = true;
    clearTimeout(timer);
    toast.classList.add("leaving");
    setTimeout(() => {
      toast.remove();
      setTimeout(showNextToast, TOAST_GAP_MS);
    }, TOAST_FADE_MS);
  }

  document.getElementById("achievement-toasts").append(toast);
  timer = setTimeout(close, TOAST_MS);
}

function announce(achievements) {
  queue.push(...achievements);
  if (!showing) showNextToast();
}

// Achievements stay earned for good, even if adding lessons later lowers a percentage.
// The first check of a profile records what it had already reached, without announcing it.
export function checkAchievements(site) {
  if (!activeProfile()) return;
  const all = site.achievements.flatMap((group) => group.items);
  const earned = earnedAchievements();
  const fresh = all.filter((achievement) => !earned?.[achievement.id] && achievement.reached());
  if (earned === null) {
    addEarnedAchievements(fresh.map((achievement) => achievement.id));
  } else if (fresh.length) {
    addEarnedAchievements(fresh.map((achievement) => achievement.id));
    announce(fresh);
  }
}

// `earned` defaults to the active profile's, and can be another profile's to show it.
export function achievementCounts(site, earned = earnedAchievements() ?? {}) {
  const all = site.achievements.flatMap((group) => group.items);
  return { done: all.filter((achievement) => earned[achievement.id]).length, total: all.length };
}

export function achievementsView(site) {
  const earned = earnedAchievements() ?? {};
  const { done, total } = achievementCounts(site);
  return el(
    "div",
    {},
    el("h1", {}, "Logros"),
    el("p", { class: "lead" }, `Levas ${done} de ${total} logros.`),
    ...site.achievements.map((group) => el(
      "section",
      { class: "achievement-section" },
      el("h2", {}, group.title),
      el(
        "ul",
        { class: "achievement-list" },
        ...group.items.map((achievement) => el(
          "li",
          { class: `achievement${earned[achievement.id] ? " earned" : ""}${achievement.epic ? " epic" : ""}` },
          el("strong", {}, achievement.title),
          el("span", {}, achievement.description)
        ))
      )
    ))
  );
}
