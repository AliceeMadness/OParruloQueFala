// Duck animations: the welcome on opening the site and the party after a good lesson.
import { activeProfile, PROFILES } from "./store.js";
import { el } from "./ui.js";

export const MASCOT = "assets/img/parrulo.svg";
const SPLASH_MS = 2600;
const PARTY_MS = 5000;

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function duckOf(profile) {
  return profile ? profile.duck : MASCOT;
}

export function showSplash() {
  const splash = el(
    "div",
    { class: "splash", "aria-hidden": "true" },
    el(
      "div",
      { class: "splash-duck" },
      el("p", { class: "bubble" }, "O Parrulo que Fala!"),
      el("img", { src: MASCOT, alt: "" })
    ),
    el("p", { class: "splash-quack" }, "cuac cuac")
  );
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    splash.classList.add("leaving");
    setTimeout(() => splash.remove(), 500);
  }
  splash.addEventListener("click", close);
  window.addEventListener("keydown", close, { once: true });
  setTimeout(close, calm() ? 1200 : SPLASH_MS);
  document.body.append(splash);
}

const random = (min, max) => min + Math.random() * (max - min);

// Ducks of every profile rain down; a perfect score adds a duck family on parade.
export function celebrate(perfect) {
  if (calm()) return;
  const ducks = [MASCOT, ...PROFILES.map((profile) => profile.duck)];
  const party = el("div", { class: "duck-party", "aria-hidden": "true" });

  const count = perfect ? 28 : 16;
  for (let i = 0; i < count; i++) {
    party.append(el("img", {
      class: "falling-duck",
      src: ducks[i % ducks.length],
      alt: "",
      style: [
        `left: ${random(-4, 96)}vw`,
        `width: ${random(36, 70)}px`,
        `animation-delay: ${random(0, 1.6)}s`,
        `animation-duration: ${random(2.4, 3.8)}s`,
        `--spin: ${random(-540, 540)}deg`,
      ].join("; "),
    }));
  }
  for (let i = 0; i < (perfect ? 5 : 3); i++) {
    party.append(el("span", {
      class: "quack",
      style: `left: ${random(8, 80)}vw; top: ${random(15, 70)}vh; animation-delay: ${random(0.2, 2.2)}s`,
    }, i % 2 ? "Cuac!" : "Parabéns!"));
  }
  if (perfect) {
    party.append(el(
      "div",
      { class: "duck-parade" },
      el("img", { src: duckOf(activeProfile()), alt: "", class: "mother" }),
      ...[0, 1, 2, 3].map(() => el("img", { src: MASCOT, alt: "" }))
    ));
  }

  document.body.append(party);
  setTimeout(() => party.remove(), PARTY_MS + 2000);
}

const SAYINGS = [
  "Cuac!",
  "Sabías que «parrulo» quere dicir «pato»?",
  "Fala galego, que non doe!",
  "Hoxe toca vocabulario?",
  "Cuac cuac! Iso, en pato, é «ánimo».",
  "Os verbos irregulares tamén me custan a min.",
  "Un parrulo que fala galego vale por dous.",
  "Pica aquí outra vez, que teño moito que contar.",
];

// The home page duck greets the player and says something new on every click.
export function talkingDuck() {
  const profile = activeProfile();
  const bubble = el("p", { class: "bubble", "aria-live": "polite" }, profile ? `Ola, ${profile.name}!` : "Ola!");
  let last = -1;
  const button = el(
    "button",
    {
      class: "talking-duck",
      type: "button",
      title: "Fálalle ao parrulo",
      onclick() {
        let next;
        do next = Math.floor(Math.random() * SAYINGS.length); while (next === last);
        last = next;
        bubble.textContent = SAYINGS[next];
        button.classList.remove("hop");
        void button.offsetWidth;
        button.classList.add("hop");
      },
    },
    el("img", { src: MASCOT, alt: "O parrulo" })
  );
  return el("div", { class: "talking-wrap" }, bubble, button);
}
