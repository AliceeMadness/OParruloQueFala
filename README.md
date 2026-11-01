# O Parrulo que Fala

A free website for Spanish speakers to learn Galician through short games.

**Play it at https://aliceemadness.github.io/OParruloQueFala/** (requires GitHub Pages to be enabled, see [Publishing](#publishing)).

## What's inside

| Mode | Content | How it works |
|---|---|---|
| **Vocabulario** | 1,531 words in 82 lessons | Type the Galician word for a Spanish one. Lessons have 20 words at most and go from easiest to hardest, grouped by theme. |
| **Verbos** | 203 verbs in 337 lessons | Conjugate the six persons of a verb, by theme and tense. |
| **Gramática** | 298 sentences in 37 lessons | Choose the word that fills the gap. A wrong answer explains the rule. Every sentence shows its Spanish translation. |
| **Encrucillados** | 20 crosswords | Clues start with Spanish translations and move to Galician definitions as puzzles get harder. |
| **Repaso** | Your mistakes | Vocabulary you got wrong comes back here until you get it right. |

Scores are colour-coded in the lesson lists: green for 100%, yellow from 70%, orange from 50% and red below that.

The interface, titles and rules are in Galician. Spanish appears only where an exercise needs it: words to translate, verb meanings, sentence translations and some crossword clues.

The Galician content was written with AI assistance and checked against a spelling dictionary, but has not yet been reviewed by an expert. Corrections are welcome.

## Profiles and progress

Players choose a profile when they arrive: Alice, Raquel or Marina. Each profile has its own progress, which follows it to any device.

- **Offline play:** progress is saved in the browser first. If the connection fails, a ⚠ appears next to the profile name, and progress is uploaded when the connection returns.
- **Playing on several devices:** progress is combined. Each lesson keeps its best score, while each crossword and the review list keep their most recent version.
- **No passwords:** anyone with access to the site can open any profile and change its progress. Store only game progress in it, never personal data.

## How it's built

The site is plain HTML, CSS and JavaScript with no framework, so GitHub Pages can serve it as it is. Python is only needed to regenerate the lesson data. Progress is stored in Firebase Firestore, because GitHub Pages can only serve files.

```
index.html         The page that loads the app
assets/            Styles, images and JavaScript
  js/config.js     Address of the progress database
  js/store.js      Profiles and saved progress
  js/sync.js       Communication with the database
  js/modes/        One file per game mode
content/           Lessons in plain text: edit these
data/              JSON generated from content/: do not edit by hand
tools/build.py     Checks content/ and generates data/
firestore.rules    Access rules for the database
.nojekyll          Tells GitHub Pages not to process the files
```

Two conventions keep the site working on GitHub Pages:

- Links and assets use relative paths, because the site lives under `/OParruloQueFala/` rather than at the domain root.
- Pages inside the site use `#/` addresses, so reloading a lesson never gives a 404 error.

## Running it locally

You need Python 3. Run this from the folder that **contains** the repository, so the address matches the one on GitHub Pages:

```
python -m http.server 8000 --bind 127.0.0.1
```

Then open http://localhost:8000/OParruloQueFala/

The local site uses the same database as the published one, so anything you do in a profile changes its real progress.

## Editing the lessons

1. Edit the files in `content/`.
2. Regenerate the data. This also stops with an error if something is wrong, such as a lesson with more than 20 words, an undefined verb or a sentence with no gap:

   ```
   python tools/build.py
   ```

3. Commit both `content/` and `data/`.

| File | Format |
|---|---|
| `content/vocabulary/*.txt` | `# Theme \| level`, then `## Lesson`, then `el perro = o can`. Separate alternative answers with ` / `. |
| `content/verbs/verbs.txt` | `falar = hablar`. Regular verbs conjugate automatically. For irregular tenses, add `\| presente: eu, ti, el, nós, vós, eles`. |
| `content/verbs/lessons.txt` | `# Theme \| level \| tenses`, then `Group name: verb, verb, verb`. Each group and tense becomes a lesson. |
| `content/grammar.txt` | `# Group \| level`, then `## Lesson`, then `> Rule`, then `Sentence with ___ \| right \| wrong \| [wrong] \| Explanation`, followed by `= Spanish translation` on the next line. |
| `content/crosswords.txt` | `# Number \| Title`, then `WORD = Clue`. The grid is generated automatically. |

Levels go from 1 to 4, and themes must be in ascending order. Lines starting with `//` are comments.

Renaming a lesson changes its address, which resets its saved progress.

## Adding a profile

Draw its duck as `assets/img/pato-<id>.svg`, starting from one of the existing ducks so it keeps the same look. Add the profile, with that image as `duck`, to `PROFILES` in `assets/js/store.js`, and add it to both lists in `firestore.rules`. Then paste the updated rules into the Firebase console and publish them.

## How sync works

The browser talks directly to the Firestore REST API, with no server or SDK in between. `assets/js/store.js` decides when to sync and `assets/js/sync.js` makes the requests. The site uses the Firebase project `oparrulo-cd79d`.

**What is stored:** each profile is one document, `profiles/<id>` (for example `profiles/alice`), with a single text field, `progress`. That field holds the profile's scores, review list and crosswords as JSON. A copy is also kept in the browser's `localStorage`, which is what lets the site work offline.

**When progress is downloaded:**

- When the site opens.
- When a profile is chosen.
- When the player returns to the tab.
- When the connection comes back.

The page waits up to 4 seconds for the download on opening or choosing a profile, then continues with the browser's copy. If the reply arrives later, it is merged and the page redraws, unless a lesson or the review is in progress.

**When progress is uploaded:**

- 1.5 seconds after a change, so that several quick changes become one upload.
- Straight away when there is a pending change and the player leaves the tab or page, or switches profile.
- After a download, if this device has something the database lacks.

Each upload reads the latest version from the database first and merges it, so that it doesn't overwrite what another device saved in the meantime. This isn't an atomic transaction, so two devices uploading at the same moment could still lose a change from one of them.

**What the rules allow:** `firestore.rules` only allows reading, creating and updating the documents of the three known profiles. A document can only contain the `progress` field, as text of fewer than 300,000 characters. Listing or deleting profiles and accessing anything else is refused.

The rules live in the Firebase console, so editing `firestore.rules` in this repository doesn't change them until they are pasted there and published.

## Setting up the database

The project is already connected to a database. To use your own, for example in a fork:

1. Create a project at https://console.firebase.google.com. The free Spark plan doesn't need a card.
2. In **Firestore Database**, create a database in production mode.
3. In the **Rules** tab, paste the contents of `firestore.rules` and publish.
4. In `assets/js/config.js`, put your project ID in `SYNC_URL`:

   ```
   https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default)/documents/profiles
   ```

If `SYNC_URL` is empty, the site still works, but progress stays in each browser. The address isn't a secret: `firestore.rules` is what controls access.

## Publishing

In the repository on GitHub, go to **Settings > Pages** and set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`. After that, every push to `main` updates the site.
