# O Parrulo que Fala

A free website for Spanish speakers to learn Galician through short games.

**Play it at https://aliceemadness.github.io/OParruloQueFala/**, or [install it on your phone](#installing-it-as-an-app).

## What's inside

| Mode | Content | How it works |
|---|---|---|
| **Vocabulario** | 1,531 words in 82 lessons | Type the Galician word for a Spanish one. Lessons have 20 words at most and go from easiest to hardest, grouped by theme. |
| **Verbos** | 203 verbs in 337 lessons | Conjugate the six persons of a verb, by theme and tense. |
| **Gramática** | 394 sentences in 49 lessons | Fill the gap by choosing the word (easy mode) or typing it (hard mode). A wrong answer explains the rule. Every sentence shows its Spanish translation. |
| **Encrucillados** | 60 crosswords | Clues start with Spanish translations and move to Galician definitions as puzzles get harder. |
| **Repaso** | Your mistakes | Vocabulary you got wrong comes back here until you get it right. |
| **A miña colección** | What you save | Save what you don't know yet: vocabulary words and grammar sentences with *Engadir á miña colección*, and single verb forms with the *+* next to each person. The collection has a section for each, studied 20 random items at a time, and items stay until you remove them. Each profile has its own. |

Every page has two side panels. **Progreso total** shows how much of the site each profile has completed, and **Palabra do día** shows a different Galician word or expression every day. It links to a list where the ones already shown are visible and the rest appear as question marks, so a new one is unlocked each day (see [Daily words](#daily-words)).

The profile picture at the top right opens a menu with **Perfil** (progress, description and favourite word), **Logros** (achievements) and **Cambiar de perfil**.

Scores are colour-coded in the lesson lists: green for 100%, yellow from 70%, orange from 50% and red below that. When every lesson in a group is done, the group takes the colour of its lowest score.

The interface, titles and rules are in Galician. Spanish appears only where an exercise needs it: words to translate, verb meanings, sentence translations and some crossword clues.

The Galician content was written with AI assistance and checked against a spelling dictionary, but has not yet been reviewed by an expert. Corrections are welcome.

## Profiles and progress

Players choose a profile when they arrive: Alice, Raquel or Marina. Each profile has its own progress, which follows it to any device.

- **Offline play:** progress is saved in the browser first. If the connection fails, a ⚠ appears next to the profile name, and progress is uploaded when the connection returns.
- **Playing on several devices:** progress is combined. Each lesson keeps its best score, achievements earned on any device are kept, and each crossword, the review list, the collection and the profile details keep their most recent version.
- **No passwords:** anyone with access to the site can open any profile and change its progress. Store only game progress in it, never personal data.

## How it's built

The site is plain HTML, CSS and JavaScript with no framework, so GitHub Pages can serve it as it is. Python is only needed to regenerate the lesson data. Progress is stored in Firebase Firestore, because GitHub Pages can only serve files.

```
index.html         The page that loads the app
assets/            Styles, images and JavaScript
  js/config.js     Address of the progress database
  js/store.js      Profiles and saved progress
  js/sync.js       Communication with the database
  js/daily.js      Daily word panel and list
  js/achievements.js  Achievements and their pop-ups
  js/modes/        One file per game mode
content/           Lessons in plain text: edit these
data/              JSON generated from content/: do not edit by hand
tools/build.py     Checks content/ and generates data/
firestore.rules    Access rules for the database
manifest.webmanifest  Name and icons used when the site is installed as an app
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
| `content/crosswords.txt` | `# Number \| Title \| level` (1 easy, 2 medium, 3 hard), then `WORD = Clue`. The grid is generated automatically. Never renumber a crossword, because the number identifies its saved progress. |
| `content/daily.txt` | Under `# Palabras` or `# Expresións`: `Galician \| Definition in Galician \| Spanish translation`. See [Daily words](#daily-words) before adding entries. |

Levels go from 1 to 4, and themes must be in ascending order. Lines starting with `//` are comments.

Renaming a lesson changes its address, which resets its saved progress.

## Achievements

There are 33 achievements, defined in `assets/js/achievements.js`. Those not yet earned appear faded in **Logros**, and those earned have a rainbow border. Earning one shows a pop-up at the top of the page.

- **What counts:** a lesson counts once it is finished, whatever its score, and a crossword once it is solved.
- **Permanent:** an achievement stays earned even if adding lessons later lowers a percentage, or if words leave the collection.
- **First check:** the first time a profile is checked, whatever it had already reached is recorded without any pop-ups.
- **Epic achievement:** "Cando sae o Galego 2??" requires a score of 100% in every lesson and every crossword solved.
- **Titles by profile:** the `gender` of each profile in `PROFILES` decides the grammatical form of titles such as "Sabio" or "Sabia" and "Rei" or "Raíña".
- **Grammar and crosswords:** "Sabio" requires the advanced level, and "Rei" or "Raíña" requires the whole section.

## Daily words

The list has 300 words and 51 expressions, and one new entry is unlocked each day, starting on 2 November 2026 (`FIRST_DAY` in `assets/js/daily.js`).

- **Order:** `tools/build.py` shuffles each list in a fixed random order, and `FIRST_EXPRESSION` in the same file comes first. The first day shows that expression, and then every fifth day shows an expression and the rest show words. When the expressions run out, only words follow.
- **Duration:** every day brings something new for 351 days. After that the sequence starts again, with everything already unlocked.
- **Who sees what:** unlocking depends only on the date, so all profiles see the same entries. It uses the device's clock, so changing the clock changes what appears.
- **Hidden entries:** the page doesn't show them, but they are in the public file `data/daily.json`, so this hides them from players rather than protecting them.
- **Adding entries:** this changes the shuffled order of the whole list, including entries already shown. To avoid that, `tools/build.py` would first need changing to keep the published order.

## Adding a profile

Draw its duck as `assets/img/pato-<id>.svg`, starting from one of the existing ducks so it keeps the same look. Add the profile, with that image as `duck`, to `PROFILES` in `assets/js/store.js`, and add it to both lists in `firestore.rules`. Then paste the updated rules into the Firebase console and publish them.

## How sync works

The browser talks directly to the Firestore REST API, with no server or SDK in between. `assets/js/store.js` decides when to sync and `assets/js/sync.js` makes the requests. The site uses the Firebase project `oparrulo-cd79d`.

**What is stored:** each profile is one document, `profiles/<id>` (for example `profiles/alice`), with a single text field, `progress`. That field holds the profile's scores, review list, collection, crosswords, description, favourite word and achievements as JSON. A copy is also kept in the browser's `localStorage`, which is what lets the site work offline.

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

## Installing it as an app

The site can be installed on a phone as a progressive web app (PWA), using the name and icons in `manifest.webmanifest`. An Android APK can also be generated from it. All of them load the published site and share the same progress for each profile.

| Option | Works on | Cost | Drawback |
|---|---|---|---|
| **PWA** | iPhone and Android | Free | Installed from the browser rather than from a store |
| **APK** | Android only | Free | Requires allowing installs from unknown sources |
| **App Store** | iPhone only | About $99 a year | Requires a developer account and Apple's review. Not set up |

iPhones can't install APK files, so the PWA is the way to install it on an iPhone.

### Installing the PWA

To share the app, send the site's address. There is no file to send.

- **iPhone:** open the site in **Safari**, tap **Share**, then **Add to Home Screen**.
- **Android:** open the site in **Chrome**, open the ⋮ menu, then tap **Install app** or **Add to Home screen**.

To pick up a new icon or name, remove the installed copy and add it again.

### Generating the APK

The APK is generated from the published site, so the manifest must be on GitHub Pages first.

1. Go to https://www.pwabuilder.com and enter the site's address.
2. Choose **Package For Stores**, then **Android**, and download the ZIP.
3. Keep the signing key from the ZIP somewhere safe and **outside this repository**, which is public. Later versions must be signed with the same key, or they can't be installed over the previous one.
4. Send the APK to the phone and open it, allowing installs from that source when Android asks.

PWABuilder's warning about a missing service worker is a recommendation related to offline use.

To remove the address bar from the APK, Android requires a verification file at the root of the domain, `aliceemadness.github.io/.well-known/assetlinks.json`. It can't live in this repository, because the site is served from `/OParruloQueFala/`. It needs a separate public repository named `AliceeMadness.github.io`, containing the `assetlinks.json` file from the ZIP. Until then the APK works, with the bar showing.

### Updates

Every push to `main` reaches the PWA and the APK without reinstalling. It isn't instant: GitHub Pages takes about a minute to publish, the phone may keep the previous version for up to 10 minutes, and an open app has to be closed and reopened. A new APK is only needed to change the app's own icon or name.

### Limitations

- **No offline start:** the app needs a connection to open, because there is no service worker yet. If one is added, it must check for new versions first, or phones could stay on an old version.
- **Testing:** the manifest and icons are published and were checked as files, but installation hasn't been tested on real phones yet.

## Publishing

In the repository on GitHub, go to **Settings > Pages** and set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`. After that, every push to `main` updates the site.
