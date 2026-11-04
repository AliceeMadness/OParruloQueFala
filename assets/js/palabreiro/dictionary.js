// The word list is split by the first two letters of each word (tools/palabreiro_words.py),
// so checking a move only downloads the files of the words it forms.
const files = new Map();

function fileFor(word) {
  const name = `${word.slice(0, 2).replace("ñ", "_")}.txt`;
  if (!files.has(name)) {
    files.set(name, fetch(`data/palabreiro/${name}`)
      .then((response) => (response.status === 404 ? "" : response.ok ? response.text() : Promise.reject(new Error(`${name}: ${response.status}`))))
      .then((text) => new Set(text.split("\n")))
      .catch((error) => {
        files.delete(name);
        throw error;
      }));
  }
  return files.get(name);
}

// Returns the words that aren't in the dictionary. Throws if the list can't be downloaded.
export async function unknownWords(words) {
  const checks = await Promise.all(words.map(async (word) => ((await fileFor(word)).has(word) ? null : word)));
  return checks.filter(Boolean);
}
