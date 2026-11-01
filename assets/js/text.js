const ARTICLE = /^(o|a|os|as) (.+)$/;

export function clean(text) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Removes acute accents and diaeresis but keeps ñ, which is its own letter.
export function withoutAccents(text) {
  return text
    .replace(/ñ/g, "\u0000")
    .normalize("NFD")
    .replace(/[́̈]/g, "")
    .normalize("NFC")
    .replace(/\u0000/g, "ñ");
}

// Returns { ok, note } where note is "accent" or "article" for a forgivable slip.
export function checkAnswer(input, answers) {
  const given = clean(input);
  if (!given) return { ok: false };
  const options = answers.map(clean);

  if (options.includes(given)) return { ok: true };
  const plain = withoutAccents(given);
  if (options.some((option) => withoutAccents(option) === plain)) {
    return { ok: true, note: "accent" };
  }
  for (const option of options) {
    const match = option.match(ARTICLE);
    if (match && withoutAccents(match[2]) === plain) return { ok: true, note: "article" };
  }
  return { ok: false };
}

// Crossword cells hold a single capital letter without accents.
export function gridLetter(text) {
  const letters = withoutAccents(text.toLowerCase()).toUpperCase().match(/[A-ZÑ]/g);
  return letters ? letters[letters.length - 1] : "";
}

export function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
