# O Parrulo que Fala

A free website for Spanish speakers to learn Galician through short games.

**Play it at https://aliceemadness.github.io/OParruloQueFala/**, or [install it on your phone](#installing-it-as-an-app).

## What's inside

| Mode | Content | How it works |
|---|---|---|
| **Vocabulario** | 1,531 words in 82 lessons | Type the Galician word for a Spanish one. Lessons have 20 words at most and go from easiest to hardest, grouped by theme. |
| **Verbos** | 33 verbs in 360 lessons, plus 9 lessons of periphrases | Four sections: one regular model verb for each conjugation (*falar*, *comer*, *partir*), basic irregular verbs and advanced irregular verbs, each verb with a lesson for every tense (11: presente, pretérito, copretérito, antepretérito, futuro, condicional, the three subjunctive tenses, imperativo and infinitivo conxugado). Type the six persons, or just *ti* and *vós* in the imperative; a verb answered wrong comes back at the end. The last section, **Perífrases e outras expresións**, has sentences with a gap played as in grammar: *ir + infinitivo*, *ter que*, *estar a*, *haber de*, *deber de*, *gústame*, *hai*… |
| **Gramática** | 394 sentences in 49 lessons | Fill the gap by choosing the word (easy mode) or typing it (hard mode). A wrong answer explains the rule. Every sentence shows its Spanish translation. |
| **Encrucillados** | 60 crosswords | Clues start with Spanish translations and move to Galician definitions as puzzles get harder. |
| **Repaso** | Your mistakes | Words, verb forms and grammar sentences you got wrong, in lessons, the exam or the collection, come back here until you get them right. It mixes the three, 20 at a time, oldest first, and you type every answer. Something leaves the review when you answer it right without having failed it in the same go, wherever that happens. |
| **Non hai que esquecer o aprendido** | What you've done | An exam of up to 20 random questions from the vocabulary, verb and grammar lessons already done, mixing the three. It can be played as often as you like, and is different every time: no word, verb or sentence comes up twice in one exam, and nothing asked in the last 6 hours comes up again, with the same question or the same answer. When few new questions are left, the exam is shorter instead. A question answered wrong comes back at the end of the exam until it is answered right, as in the lessons; the score counts the first go. The mistakes are listed at the end, and also go to the review. It has a card on the home page once a profile has done 3 lessons, and a reminder every 3 days (`EXAM_EVERY_MS`, `EXAM_FRESH_MS` and `MIN_DONE_LESSONS` in `assets/js/modes/exam.js`). |
| **Dudoiro** | 170 words | Does it have an «i»? Galician words ending in *-eiro*, *-eira*, *-oiro* and similar, mixed with words spelt as in Spanish, such as *neveira* but *lavadora*. Each round has 20 random words, dealt so none repeats until all have come up. Choose between the right spelling and the same word with an «i» too many or too few; a word answered wrong comes back at the end of the round until it is right. |
| **Palabreiro** | 393,000 Galician words | A word board game for 2 to 4 profiles, played by turns. Each player has 7 tiles and forms words on a 15×15 board, across or down, touching the words already there. Squares marked L×2 and L×3 multiply a letter, and P×2 and P×3 the whole word; using all 7 tiles in one move adds 50 points. There are 100 tiles, with no J, K, W or Y, an Ñ and 2 blanks, and accents don't matter. Players can also swap tiles, pass or resign. The game ends when someone uses their last tile with the bag empty, which adds the others' remaining tiles to their score, or when every player has passed twice in a row. Words are checked against a dictionary (see [Palabreiro word list](#palabreiro-word-list)). The menu shows how many games are waiting for your move, and an open game refreshes every few seconds. |
| **A miña colección** | What you save | Save what you don't know yet: vocabulary words and grammar sentences with *Engadir á miña colección*, and single verb forms with the *+* next to each person. The collection has a section for each, studied 20 random items at a time, and items stay until you remove them. Each profile has its own. |

Every page has two side panels. **Progreso total** shows how much of the site each profile has completed. Clicking a name opens that profile's page to look at, without changing profile: its progress, number of achievements, play time, description and favourite word. **Palabra do día** shows a different Galician word or expression every day. It links to a list where the ones already shown are visible and the rest appear as question marks, so a new one is unlocked each day (see [Daily words](#daily-words)).

The profile picture at the top right opens a menu with **Perfil** (progress, description and favourite word), **Logros** (achievements) and **Cambiar de perfil**.

Scores are colour-coded in the lesson lists: green for 100%, yellow from 70%, orange from 50% and red below that. When every lesson in a group is done, the group takes the colour of its lowest score.

The interface, titles and rules are in Galician. Spanish appears only where an exercise needs it: words to translate, verb meanings, sentence translations and some crossword clues.

The Galician content was written with AI assistance and checked against a spelling dictionary, but has not yet been reviewed by an expert. Corrections are welcome.

## Profiles and progress

Players choose a profile when they arrive: Alice, Raquel, Marina or Japolo. Each profile has its own password and its own progress, which follows it to any device. Once a profile is open, the browser stays in it until someone changes profile.

**Xogar sen perfil** opens everything except the collection, with no password. That progress stays in the browser and is never uploaded.

- **Offline play:** progress is saved in the browser first. If the connection fails, a ⚠ appears next to the profile name, and progress is uploaded when the connection returns.
- **Playing on several devices:** progress is combined. Each lesson keeps its best score, achievements earned on any device are kept, the latest exam counts on every device, and each crossword, the review list, the collection and the profile details keep their most recent version.
- **Play time:** the profile page shows the time spent doing exercises: lessons, crosswords, the review, the exam, Dudoiro and studying the collection. Lists and menus don't count, and neither does time with the tab hidden or more than 2 minutes without pressing a key or tapping. Each device keeps its own count, and the profile shows them added up.
- **Passwords only prevent mistakes:** they stop someone opening the wrong profile by accident, not someone determined. The site has no server, so the check runs in the browser, and the database accepts changes from anyone. Store only game progress in a profile, never personal data. Passwords are stored as SHA-256 hashes in `assets/js/store.js` and ignore upper and lower case.

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

   It needs Python 3.10 or later.

3. Commit both `content/` and `data/`.

| File | Format |
|---|---|
| `content/vocabulary/*.txt` | `# Theme \| level`, then `## Lesson`, then `el perro = o can`. Separate alternative answers with ` / `. |
| `content/verbs/verbs.txt` | `falar = hablar`. Regular verbs conjugate automatically. For irregular tenses, add `\| presente: eu, ti, el, nós, vós, eles`. The antepretérito and the past and future subjunctive come from *eles* in the pretérito, so an irregular pretérito fixes them too. The imperative comes from the present; `\| imperativo: ti, vós` changes it and `\| imperativo: -` removes it. |
| `content/verbs/lessons.txt` | `= Section`, then one `verb \| level` per line. Each verb becomes a group with a lesson for every tense it has. |
| `content/verbs/periphrasis.txt` | Same format as `content/grammar.txt`. Its groups come after the verbs, in their own section. |
| `content/grammar.txt` | `# Group \| level`, then `## Lesson`, then `> Rule`, then `Sentence with ___ \| right \| wrong \| [wrong] \| Explanation`, followed by `= Spanish translation` on the next line. |
| `content/crosswords.txt` | `# Number \| Title \| level` (1 easy, 2 medium, 3 hard), then `WORD = Clue`. The grid is generated automatically. Never renumber a crossword, because the number identifies its saved progress. |
| `content/dudoiro.txt` | `Spanish = Galician \| trap`, where the trap is the same word with an «i» too many or too few. `#` lines only group the words. |
| `content/daily.txt` | Under `# Palabras` or `# Expresións`: `Galician \| Definition in Galician \| Spanish translation`. See [Daily words](#daily-words) before adding entries. |

Levels go from 1 to 4, and themes must be in ascending order. Lines starting with `//` are comments.

Renaming a lesson changes its address, which resets its saved progress.

## Achievements

There are 81 achievements, defined in `assets/js/achievements.js`: by section and level, by share of the site done, and for streaks of days in a row, days and hours played, playing late at night or early in the morning, lessons done and lessons at 100%, the exam and Dudoiro rounds. Those not yet earned appear faded in **Logros**, and those earned have a rainbow border. Earning one shows a pop-up at the top of the page. When several are earned at once, each pop-up waits until the previous one has faded away.

- **What counts:** a lesson counts once it is finished, whatever its score, and a crossword once it is solved.
- **Permanent:** an achievement stays earned even if adding lessons later lowers a percentage, or if words leave the collection.
- **First check:** the first time a profile is checked, whatever it had already reached is recorded without any pop-ups.
- **Epic achievement:** "Cando sae o Galego 2??" requires a score of 100% in every lesson and every crossword solved.
- **Days and counts:** a day counts as played when exercises are done that day, by the device's local date. Each profile keeps the days it has played, and each device counts its own exams and Dudoiro rounds, added up like the play time. Neither was recorded before these achievements existed, so they start from zero.
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

Draw its duck as `assets/img/pato-<id>.svg`, starting from one of the existing ducks so it keeps the same look. Add the profile, with that image as `duck` and the SHA-256 of its lowercase password as `password`, to `PROFILES` in `assets/js/store.js`, and add it to both lists in `firestore.rules`. Then paste the updated rules into the Firebase console and publish them.

## Palabreiro word list

The dictionary is `data/palabreiro/*.txt`, one file per first two letters, so a move only downloads the files of the words it forms. It is generated from the Galician spell-checking dictionary of [Proxecto Trasno](https://github.com/LibreOffice/dictionaries/tree/master/gl), the one LibreOffice uses, which is under the GPLv3; the word list is therefore under the GPLv3 too. To regenerate it, download `gl_ES.aff` and `gl_ES.dic` and run:

```
python tools/palabreiro_words.py gl_ES.aff gl_ES.dic
```

It keeps every word with its plurals, feminines and verb forms, but not verb forms with pronouns attached (*dígocho*), which would make the list 15 million words long. Proper names and abbreviations are left out, and accents are removed because tiles have none.

## How sync works

The browser talks directly to the Firestore REST API, with no server or SDK in between. `assets/js/store.js` decides when to sync and `assets/js/sync.js` makes the requests. The site uses the Firebase project `oparrulo-cd79d`.

**What is stored:** each Palabreiro game is one document, `games/<id>`, with the whole game as JSON in a `game` field. Every move first reads the game and then saves it on condition that nobody saved it in between, so two players can't overwrite each other's moves. Each profile is one document, `profiles/<id>` (for example `profiles/alice`), with a single text field, `progress`. That field holds the profile's scores, review list, collection, crosswords, description, favourite word and achievements as JSON. A copy is also kept in the browser's `localStorage`, which is what lets the site work offline.

**When progress is downloaded:**

- When the site opens.
- When a profile is chosen.
- When the player returns to the tab.
- When the connection comes back.

The page waits up to 4 seconds for the download on opening or choosing a profile, then continues with the browser's copy. If the reply arrives later, it is merged and the page redraws, unless a lesson or the review is in progress.

**When progress is uploaded:**

- 1.5 seconds after a change, so that several quick changes become one upload.
- Straight away when there is a pending change and the player leaves the tab or page, or switches profile. Closing the page can cut this upload short, because it reads the database before writing. Nothing is lost: the change stays in the browser and is uploaded the next time the site opens on that device.
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

## Ideas

Ideas for later. None of them is planned yet.

- **Accounts and friends:** real accounts instead of the three fixed profiles, so anyone can sign up and add friends. It could use Firebase Authentication in the same project, with one document per account that only its owner can change. That would also stop anyone from overwriting a profile, which the current rules allow. The three current profiles would need a way to bring their progress over. Friends would send and accept requests, and "Progreso total" would show you and your friends instead of the fixed list, with a public summary so friends see your progress but not your whole collection.
