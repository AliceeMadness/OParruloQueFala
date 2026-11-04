#!/usr/bin/env python3
"""Validate content/ and generate the data/*.json files the site loads.

Run from anywhere: python tools/build.py
GitHub Pages serves the generated files as they are, so commit data/ too.
"""
import json
import random
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
DATA = ROOT / "data"

MAX_WORDS_PER_LESSON = 20
TENSES = {
    "presente": "Presente",
    "preterito": "Pretérito",
    "copreterito": "Copretérito",
    "antepreterito": "Antepretérito",
    "futuro": "Futuro",
    "condicional": "Condicional",
    "subxuntivo": "Presente de subxuntivo",
    "preteritosubx": "Pretérito de subxuntivo",
    "futurosubx": "Futuro de subxuntivo",
    "imperativo": "Imperativo",
    "infinitivo": "Infinitivo conxugado",
}
PERSONS = ["eu", "ti", "el/ela", "nós", "vós", "eles/elas"]


class ContentError(Exception):
    pass


def slug(text):
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def lines_of(path):
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if line and not line.startswith("//"):
            yield number, line


def unique_ids(items, where):
    seen = set()
    for item in items:
        if item["id"] in seen:
            raise ContentError(f"{where}: id repetido {item['id']}")
        seen.add(item["id"])


# Vocabulary ------------------------------------------------------------------

def build_vocabulary():
    themes = []
    for path in sorted((CONTENT / "vocabulary").glob("*.txt")):
        for number, line in lines_of(path):
            where = f"{path.name}:{number}"
            if line.startswith("## "):
                themes[-1]["lessons"].append({"id": slug(line[3:]), "title": line[3:], "words": []})
            elif line.startswith("# "):
                title, level = [part.strip() for part in line[2:].split("|")]
                themes.append({"id": slug(title), "title": title, "level": int(level), "lessons": []})
            else:
                if " = " not in line:
                    raise ContentError(f"{where}: falta « = »: {line}")
                es, gl = line.split(" = ", 1)
                themes[-1]["lessons"][-1]["words"].append(
                    {"es": es.strip(), "gl": [option.strip() for option in gl.split(" / ")]}
                )

    levels = [theme["level"] for theme in themes]
    if levels != sorted(levels):
        raise ContentError("vocabulario: los temas deben ir de menor a mayor nivel")
    unique_ids(themes, "vocabulario")
    for theme in themes:
        unique_ids(theme["lessons"], theme["title"])
        for lesson in theme["lessons"]:
            words = lesson["words"]
            if not 5 <= len(words) <= MAX_WORDS_PER_LESSON:
                raise ContentError(f"{lesson['title']}: tiene {len(words)} palabras")
            spanish = [word["es"] for word in words]
            if len(set(spanish)) != len(spanish):
                raise ContentError(f"{lesson['title']}: palabra repetida")
    return themes


# Verbs -----------------------------------------------------------------------

AR = {
    "presente": ["o", "as", "a", "amos", "ades", "an"],
    "copreterito": ["aba", "abas", "aba", "abamos", "abades", "aban"],
    "preterito": ["ei", "aches", "ou", "amos", "astes", "aron"],
}
ER = {
    "presente": ["o", "es", "e", "emos", "edes", "en"],
    "copreterito": ["ía", "ías", "ía", "iamos", "iades", "ían"],
    "preterito": ["ín", "iches", "eu", "emos", "estes", "eron"],
}
IR = {
    "presente": ["o", "es", "e", "imos", "ides", "en"],
    "copreterito": ["ía", "ías", "ía", "iamos", "iades", "ían"],
    "preterito": ["ín", "iches", "iu", "imos", "istes", "iron"],
}
FUTURE = ["ei", "ás", "á", "emos", "edes", "án"]
CONDITIONAL = ["ía", "ías", "ía", "iamos", "iades", "ían"]
SUBJUNCTIVE_AR = ["e", "es", "e", "emos", "edes", "en"]
SUBJUNCTIVE_ER = ["a", "as", "a", "amos", "ades", "an"]
INFINITIVE = ["", "es", "", "mos", "des", "en"]
# These three come from the stem of «eles» in the pretérito: fala-ron, estive-ron, fo-ron.
PLUPERFECT = ["ra", "ras", "ra", "ramos", "rades", "ran"]
PAST_SUBJUNCTIVE = ["se", "ses", "se", "semos", "sedes", "sen"]
FUTURE_SUBJUNCTIVE = ["r", "res", "r", "rmos", "rdes", "ren"]
ACUTE = str.maketrans("aeiou", "áéíóú")


def soft_stem(stem):
    """Spelling of an -ar stem before e: toc-e is toque, pag-e pague, comez-e comece."""
    if stem.endswith("c"):
        return stem[:-1] + "qu"
    if stem.endswith("g"):
        return stem[:-1] + "gu"
    if stem.endswith("z"):
        return stem[:-1] + "c"
    return stem


def stressed(base):
    """falá-semos, estivé-semos, fó-semos: the last vowel of the stem takes the accent."""
    if any(vowel in base for vowel in "áéíóú"):
        return base
    for index in range(len(base) - 1, -1, -1):
        if base[index] in "aeiou":
            return base[:index] + base[index].translate(ACUTE) + base[index + 1:]
    return base


def conjugate(infinitive, overrides):
    plain = infinitive.replace("í", "i")
    stem, ending = plain[:-2], plain[-2:]
    table = {"ar": AR, "er": ER, "ir": IR}[ending]
    forms = {}
    for tense, endings in table.items():
        forms[tense] = [stem + suffix for suffix in endings]
    if ending == "ar":
        forms["preterito"][0] = soft_stem(stem) + "ei"
    elif stem.endswith("c"):
        forms["presente"][0] = stem[:-1] + "zo"
    forms["futuro"] = [plain + suffix for suffix in FUTURE]
    forms["condicional"] = [plain + suffix for suffix in CONDITIONAL]
    forms["infinitivo"] = [infinitive + suffix for suffix in INFINITIVE]
    forms.update(overrides)
    if "subxuntivo" not in forms:
        if ending == "ar":
            forms["subxuntivo"] = [soft_stem(stem) + suffix for suffix in SUBJUNCTIVE_AR]
        else:
            base = forms["presente"][0][:-1]
            forms["subxuntivo"] = [base + suffix for suffix in SUBJUNCTIVE_ER]
    base = forms["preterito"][5][:-3]
    forms.setdefault("antepreterito", [base + suffix for suffix in PLUPERFECT])
    past = [base + suffix for suffix in PAST_SUBJUNCTIVE]
    past[3] = stressed(base) + PAST_SUBJUNCTIVE[3]
    forms.setdefault("preteritosubx", past)
    forms.setdefault("futurosubx", [base + suffix for suffix in FUTURE_SUBJUNCTIVE])
    # Only «ti» and «vós»; the other persons are left empty and the lesson doesn't ask them.
    if "imperativo" not in forms:
        present = forms["presente"]
        forms["imperativo"] = ["", present[2], "", "", present[4].removesuffix("s"), ""]
    elif forms["imperativo"] is None:
        del forms["imperativo"]
    return {tense: forms[tense] for tense in TENSES if tense in forms}


def read_verbs():
    verbs = {}
    for number, line in lines_of(CONTENT / "verbs" / "verbs.txt"):
        where = f"verbs.txt:{number}"
        head, *parts = [part.strip() for part in line.split("|")]
        infinitive, translation = [part.strip() for part in head.split(" = ")]
        if infinitive in verbs:
            raise ContentError(f"{where}: verbo repetido {infinitive}")
        overrides = {}
        for part in parts:
            tense, forms = part.split(":")
            tense = tense.strip()
            forms = [form.strip() for form in forms.split(",")]
            if tense == "imperativo" and forms == ["-"]:
                overrides[tense] = None
                continue
            if tense == "imperativo" and len(forms) == 2:
                forms = ["", forms[0], "", "", forms[1], ""]
            if tense not in TENSES or len(forms) != 6:
                raise ContentError(f"{where}: tiempo mal escrito en {infinitive}: {tense}")
            overrides[tense] = forms
        verbs[infinitive] = {"es": translation, "forms": conjugate(infinitive, overrides)}
    return verbs


def read_sentence_lessons(path, label):
    """Groups of fill-the-gap lessons, as in grammar.txt."""
    groups = []
    for number, line in lines_of(path):
        where = f"{path.name}:{number}"
        if line.startswith("## "):
            groups[-1]["lessons"].append({"id": slug(line[3:]), "title": line[3:], "intro": "", "items": []})
        elif line.startswith("# "):
            title, level = [part.strip() for part in line[2:].split("|")]
            groups.append({"id": slug(title), "title": title, "level": int(level), "lessons": []})
        elif line.startswith(">"):
            groups[-1]["lessons"][-1]["intro"] = line[1:].strip()
        elif line.startswith("= "):
            groups[-1]["lessons"][-1]["items"][-1]["es"] = line[2:].strip()
        else:
            parts = [part.strip() for part in line.split("|")]
            if len(parts) not in (4, 5):
                raise ContentError(f"{where}: se esperaban 2 o 3 opciones y explicación")
            sentence, answer, *wrong, why = parts
            if "___" not in sentence:
                raise ContentError(f"{where}: falta el hueco ___")
            if answer in wrong or not all(wrong) or not why:
                raise ContentError(f"{where}: opciones incorrectas")
            groups[-1]["lessons"][-1]["items"].append(
                {"text": sentence, "answer": answer, "wrong": wrong, "why": why}
            )
    unique_ids(groups, label)
    for group in groups:
        unique_ids(group["lessons"], group["title"])
        for lesson in group["lessons"]:
            if not lesson["intro"] or len(lesson["items"]) < 5:
                raise ContentError(f"{lesson['title']}: lección incompleta")
            for item in lesson["items"]:
                if "es" not in item:
                    raise ContentError(f"{item['text']}: falta la traducción")
    return groups


def build_verbs():
    """Sections of verbs from lessons.txt, each verb a group with a lesson per tense,
    and then the sentence lessons of periphrasis.txt as their own section."""
    verbs = read_verbs()
    themes, used, section = [], set(), None
    for number, line in lines_of(CONTENT / "verbs" / "lessons.txt"):
        where = f"lessons.txt:{number}"
        if line.startswith("= "):
            section = line[2:].strip()
            continue
        if section is None:
            raise ContentError(f"{where}: verbo antes de cualquier sección")
        name, level = [part.strip() for part in line.split("|")]
        if name not in verbs:
            raise ContentError(f"{where}: verbo sin definir {name}")
        if name in used:
            raise ContentError(f"{where}: verbo repetido {name}")
        used.add(name)
        es = verbs[name]["es"]
        themes.append({
            "id": slug(name),
            "title": name if es == name else f"{name} ({es})",
            "section": section,
            "level": int(level),
            "lessons": [
                {"id": slug(TENSES[tense]), "title": TENSES[tense], "tense": tense, "verbs": [name]}
                for tense in verbs[name]["forms"]
            ],
        })

    for group in read_sentence_lessons(CONTENT / "verbs" / "periphrasis.txt", "perífrases"):
        group["section"] = "Perífrases e outras expresións"
        themes.append(group)
    unique_ids(themes, "verbos")

    return {
        "tenses": TENSES,
        "persons": PERSONS,
        "verbs": {name: verbs[name] for name in sorted(used)},
        "themes": themes,
    }


# Grammar ---------------------------------------------------------------------

def build_grammar():
    return read_sentence_lessons(CONTENT / "grammar.txt", "gramática")


# Daily word ------------------------------------------------------------------

# The list opens with this expression on its first day.
FIRST_EXPRESSION = "vaites, vaites!"


def build_daily():
    sections = {"Palabras": [], "Expresións": []}
    current = None
    for number, line in lines_of(CONTENT / "daily.txt"):
        if line.startswith("# "):
            current = sections[line[2:].strip()]
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) != 3 or not all(parts):
            raise ContentError(f"daily.txt:{number}: se esperaba «galego | definición | traducción»")
        current.append({"gl": parts[0], "def": parts[1], "es": parts[2]})
    for entries in sections.values():
        terms = [entry["gl"] for entry in entries]
        repeated = {term for term in terms if terms.count(term) > 1}
        if repeated:
            raise ContentError(f"daily.txt: repetido {sorted(repeated)}")
        # The file is grouped by topic; a fixed shuffle mixes the topics from day to day.
        random.Random("daily").shuffle(entries)
    expressions = sections["Expresións"]
    first = next((entry for entry in expressions if entry["gl"] == FIRST_EXPRESSION), None)
    if first is None:
        raise ContentError(f"daily.txt: falta la primera expresión, {FIRST_EXPRESSION}")
    expressions.remove(first)
    expressions.insert(0, first)
    return {"words": sections["Palabras"], "expressions": expressions}


# Crosswords ------------------------------------------------------------------

def grid_letters(word):
    """Remove accents but keep Ñ, which is its own letter in Galician."""
    result = []
    for char in word.upper():
        if char == "Ñ":
            result.append(char)
        else:
            result.append(unicodedata.normalize("NFD", char)[0])
    return "".join(result)


def can_place(grid, word, row, col, across):
    dr, dc = (0, 1) if across else (1, 0)
    if grid.get((row - dr, col - dc)) or grid.get((row + dr * len(word), col + dc * len(word))):
        return None
    crossings = 0
    for index, letter in enumerate(word):
        cell = (row + dr * index, col + dc * index)
        existing = grid.get(cell)
        if existing:
            if existing != letter:
                return None
            crossings += 1
        elif grid.get((cell[0] + dc, cell[1] + dr)) or grid.get((cell[0] - dc, cell[1] - dr)):
            return None
    return crossings


def layout_once(words, rng, max_size):
    grid, placed = {}, []
    first = words[0]
    for index, letter in enumerate(first):
        grid[(0, index)] = letter
    placed.append((first, 0, 0, True))
    remaining = words[1:]
    rng.shuffle(remaining)
    # Words that do not fit yet get more chances once the grid has grown.
    for _ in range(3):
        left = []
        for word in remaining:
            options = []
            for (row, col), letter in list(grid.items()):
                for index, char in enumerate(word):
                    if char != letter:
                        continue
                    for across in (True, False):
                        start_row = row - (0 if across else index)
                        start_col = col - (index if across else 0)
                        crossings = can_place(grid, word, start_row, start_col, across)
                        if not crossings:
                            continue
                        cells = list(grid) + [
                            (start_row + (0 if across else i), start_col + (i if across else 0))
                            for i in range(len(word))
                        ]
                        rows = [cell[0] for cell in cells]
                        cols = [cell[1] for cell in cells]
                        height = max(rows) - min(rows) + 1
                        width = max(cols) - min(cols) + 1
                        if max(height, width) <= max_size:
                            options.append((crossings * 6 - max(height, width) + rng.random(),
                                            start_row, start_col, across))
            if not options:
                left.append(word)
                continue
            _, row, col, across = max(options)
            for i, letter in enumerate(word):
                grid[(row + (0 if across else i), col + (i if across else 0))] = letter
            placed.append((word, row, col, across))
        remaining = left
        if not remaining:
            break
    return grid, placed, remaining


def layout(words, seed):
    rng = random.Random(seed)
    longest = max(len(word) for word in words)
    best = None
    for max_size in range(max(longest, 9), 22):
        for _ in range(600):
            ordered = sorted(words, key=len, reverse=True)
            grid, placed, missing = layout_once(ordered, rng, max_size)
            if missing:
                continue
            crossings = sum(len(word) for word, *_ in placed) - len(grid)
            score = crossings * 3 - max_size
            if best is None or score > best[0]:
                best = (score, grid, placed)
        if best:
            return best[1], best[2]
    raise ContentError(f"no se pudo colocar el crucigrama {seed}")


def build_crosswords():
    puzzles = []
    for number, line in lines_of(CONTENT / "crosswords.txt"):
        if line.startswith("# "):
            position, title, level = [part.strip() for part in line[2:].split("|")]
            puzzles.append({"id": f"encrucillado-{position}", "number": int(position), "title": title, "level": int(level), "clues": {}})
        else:
            word, clue = line.split(" = ", 1)
            letters = grid_letters(word.strip())
            if letters in puzzles[-1]["clues"]:
                raise ContentError(f"crosswords.txt:{number}: palabra repetida {letters}")
            puzzles[-1]["clues"][letters] = clue.strip()

    numbers = [puzzle["number"] for puzzle in puzzles]
    if len(set(numbers)) != len(numbers):
        raise ContentError("crosswords.txt: número de crucigrama repetido")
    if any(puzzle["level"] not in (1, 2, 3) for puzzle in puzzles):
        raise ContentError("crosswords.txt: el nivel debe ser 1, 2 o 3")

    result = []
    for puzzle in puzzles:
        grid, placed = layout(list(puzzle["clues"]), puzzle["number"])
        min_row = min(row for row, _ in grid)
        min_col = min(col for _, col in grid)
        rows = max(row for row, _ in grid) - min_row + 1
        cols = max(col for _, col in grid) - min_col + 1

        starts = sorted({(row - min_row, col - min_col) for _, row, col, _ in placed})
        numbers = {cell: index + 1 for index, cell in enumerate(starts)}
        entries = []
        for word, row, col, across in placed:
            cell = (row - min_row, col - min_col)
            entries.append({
                "number": numbers[cell], "row": cell[0], "col": cell[1],
                "across": across, "answer": word, "clue": puzzle["clues"][word],
            })
        entries.sort(key=lambda entry: (not entry["across"], entry["number"]))
        result.append({
            "id": puzzle["id"], "number": puzzle["number"], "title": puzzle["title"], "level": puzzle["level"],
            "rows": rows, "cols": cols, "entries": entries,
        })
    return result


def check_crossword(puzzle):
    """Every run of two or more letters in the grid must be one of the entries."""
    grid = {}
    expected = set()
    for entry in puzzle["entries"]:
        dr, dc = (0, 1) if entry["across"] else (1, 0)
        for i, letter in enumerate(entry["answer"]):
            cell = (entry["row"] + dr * i, entry["col"] + dc * i)
            if grid.setdefault(cell, letter) != letter:
                raise ContentError(f"{puzzle['id']}: cruce incoherente en {cell}")
        expected.add((entry["row"], entry["col"], entry["across"]))
    for (row, col) in grid:
        for across, (dr, dc) in ((True, (0, 1)), (False, (1, 0))):
            if (row - dr, col - dc) in grid or (row + dr, col + dc) not in grid:
                continue
            if (row, col, across) not in expected:
                raise ContentError(f"{puzzle['id']}: palabra no prevista en ({row}, {col})")
    # All the words must be reachable from the first one.
    seen, stack = set(), [next(iter(grid))]
    while stack:
        cell = stack.pop()
        if cell in seen or cell not in grid:
            continue
        seen.add(cell)
        row, col = cell
        stack += [(row + 1, col), (row - 1, col), (row, col + 1), (row, col - 1)]
    if len(seen) != len(grid):
        raise ContentError(f"{puzzle['id']}: la cuadrícula está partida")


# Dudoiro ---------------------------------------------------------------------

def build_dudoiro():
    """Returns [{es, gl, trap}]: a Galician word and the same word with an «i» too many or too few."""
    words = []
    for number, line in lines_of(CONTENT / "dudoiro.txt"):
        where = f"dudoiro.txt:{number}"
        if line.startswith("#"):
            continue
        match = re.fullmatch(r"(.+?)\s*=\s*(.+?)\s*\|\s*(.+)", line)
        if not match:
            raise ContentError(f"{where}: se esperaba «castellano = gallego | trampa»")
        es, gl, trap = match.groups()
        if gl == trap:
            raise ContentError(f"{where}: la trampa es igual que la respuesta")
        words.append({"es": es, "gl": gl, "trap": trap})
    repeated = {word["gl"] for word in words if [other["gl"] for other in words].count(word["gl"]) > 1}
    if repeated:
        raise ContentError(f"dudoiro.txt: repetido {sorted(repeated)}")
    return words


# Output ----------------------------------------------------------------------

def write(name, value):
    DATA.mkdir(exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    (DATA / name).write_text(text + "\n", encoding="utf-8", newline="\n")


def main():
    vocabulary = build_vocabulary()
    verbs = build_verbs()
    grammar = build_grammar()
    crosswords = build_crosswords()
    daily = build_daily()
    dudoiro = build_dudoiro()
    for puzzle in crosswords:
        check_crossword(puzzle)

    write("vocabulary.json", vocabulary)
    write("verbs.json", verbs)
    write("grammar.json", grammar)
    write("crosswords.json", crosswords)
    write("daily.json", daily)
    write("dudoiro.json", dudoiro)

    words = sum(len(lesson["words"]) for theme in vocabulary for lesson in theme["lessons"])
    print(f"Vocabulario: {len(vocabulary)} temas, "
          f"{sum(len(theme['lessons']) for theme in vocabulary)} lecciones, {words} palabras")
    print(f"Verbos: {len(verbs['themes'])} temas, "
          f"{sum(len(theme['lessons']) for theme in verbs['themes'])} lecciones, {len(verbs['verbs'])} verbos")
    print(f"Gramática: {len(grammar)} grupos, "
          f"{sum(len(group['lessons']) for group in grammar)} lecciones, "
          f"{sum(len(lesson['items']) for group in grammar for lesson in group['lessons'])} frases")
    sizes = ", ".join(f"{puzzle['cols']}x{puzzle['rows']}" for puzzle in crosswords)
    print(f"Crucigramas: {len(crosswords)} ({sizes})")
    print(f"Dudoiro: {sum(word['gl'].count('i') > word['trap'].count('i') for word in dudoiro)} con «i», "
          f"{sum(word['gl'].count('i') < word['trap'].count('i') for word in dudoiro)} sin ella")
    print(f"Palabra del día: {len(daily['words'])} palabras, {len(daily['expressions'])} expresiones")


if __name__ == "__main__":
    try:
        main()
    except ContentError as error:
        sys.exit(f"Error de contenido: {error}")
