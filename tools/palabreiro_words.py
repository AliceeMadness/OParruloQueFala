#!/usr/bin/env python3
"""Generate the Palabreiro word list, data/palabreiro/*.txt, from the Galician Hunspell
dictionary of Proxecto Trasno (GPLv3), the one LibreOffice uses.

    python tools/palabreiro_words.py path/to/gl_ES.aff path/to/gl_ES.dic

Both files are at https://github.com/LibreOffice/dictionaries/tree/master/gl.
Every word is expanded with its suffixes (plurals, feminines, verb forms), one level deep,
so verb forms with pronouns attached (dígocho) are left out: with them the list is 15
million words. Proper names, abbreviations and words with other characters are dropped,
and accents are removed because tiles have none (ñ stays a letter of its own).

The words are split by their first two letters, so the game only downloads the files of
the words it has to check.
"""
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "palabreiro"
VALID = re.compile(r"^[a-zñ]{2,15}$")


def read_suffixes(aff_path):
    suffixes, need_affix = defaultdict(list), set()
    for line in open(aff_path, encoding="utf-8"):
        parts = line.split()
        if parts and parts[0] == "NEEDAFFIX":
            need_affix.add(parts[1])
        if len(parts) >= 5 and parts[0] == "SFX":
            flag, strip, add, condition = parts[1:5]
            add = add.split("/", 1)[0]
            strip = "" if strip == "0" else strip
            add = "" if add == "0" else add
            pattern = None if condition == "." else re.compile(f"(?:{condition})$")
            suffixes[flag].append((strip, add, pattern))
    return suffixes, need_affix


def plain(word):
    word = word.replace("ñ", "\0")
    word = "".join(c for c in unicodedata.normalize("NFD", word) if not unicodedata.combining(c))
    return word.replace("\0", "ñ")


def file_name(word):
    """aa.txt, añ is a_.txt: the ñ is left out of file names."""
    return word[:2].replace("ñ", "_") + ".txt"


def main(aff_path, dic_path):
    suffixes, need_affix = read_suffixes(aff_path)
    words = set()
    with open(dic_path, encoding="utf-8") as dic:
        next(dic)
        for line in dic:
            entry = line.split("\t")[0].split(" ")[0].strip()
            stem, _, flag_text = entry.partition("/")
            if not stem or stem != stem.lower():
                continue
            flags = flag_text.split(",") if flag_text else []
            forms = [] if set(flags) & need_affix else [stem]
            for flag in flags:
                for strip, add, pattern in suffixes.get(flag, ()):
                    if stem.endswith(strip) and (pattern is None or pattern.search(stem)):
                        forms.append(stem[: len(stem) - len(strip)] + add)
            words.update(p for p in map(plain, forms) if VALID.match(p))

    groups = defaultdict(list)
    for word in sorted(words):
        groups[file_name(word)].append(word)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.txt"):
        old.unlink()
    for name, group in groups.items():
        (OUT / name).write_text("\n".join(group) + "\n", encoding="utf-8")
    print(f"{len(words)} palabras en {len(groups)} ficheiros")


if __name__ == "__main__":
    main(*sys.argv[1:3])
