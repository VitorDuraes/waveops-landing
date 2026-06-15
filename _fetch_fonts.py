#!/usr/bin/env python3
# Baixa os woff2 das fontes ativas do Google Fonts e gera assets/fonts.css local.
# Uso unico (build-time). Nao faz parte do runtime do site.
import os, re, sys, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(BASE, "assets", "fonts")
CSS_OUT = os.path.join(BASE, "assets", "fonts.css")
os.makedirs(FONTS_DIR, exist_ok=True)

# So as familias/pesos realmente usados no styles.css
CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Space+Grotesk:wght@400;500;600;700"
    "&family=Hanken+Grotesk:wght@400;500;600;700"
    "&family=Space+Mono:wght@400;700"
    "&display=swap"
)
# UA de Chrome => Google devolve woff2 (mais leve)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
SUBSETS_KEEP = {"latin", "latin-ext"}  # cobre pt-BR (acentos)


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read() if binary else r.read().decode("utf-8")


def slug(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def main():
    css = fetch(CSS_URL)
    # Cada bloco vem precedido por um comentario /* subset */
    blocks = re.findall(
        r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S
    )
    if not blocks:
        print("ERRO: nenhum @font-face encontrado", file=sys.stderr)
        sys.exit(1)

    out = ["/* WaveOps — fontes auto-hospedadas (geradas por _fetch_fonts.py). Nao editar a mao. */", ""]
    count = 0
    for subset, body in blocks:
        if subset not in SUBSETS_KEEP:
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body)
        weight = re.search(r"font-weight:\s*(\d+)", body)
        style = re.search(r"font-style:\s*(\w+)", body)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", body)
        urange = re.search(r"unicode-range:\s*([^;]+);", body)
        if not (fam and weight and url):
            continue
        fam_s, w, st = fam.group(1), weight.group(1), (style.group(1) if style else "normal")
        fname = f"{slug(fam_s)}-{w}-{st}-{subset}.woff2"
        fpath = os.path.join(FONTS_DIR, fname)
        data = fetch(url.group(1), binary=True)
        with open(fpath, "wb") as f:
            f.write(data)
        count += 1
        rule = [
            "@font-face {",
            f"  font-family: '{fam_s}';",
            f"  font-style: {st};",
            f"  font-weight: {w};",
            "  font-display: swap;",
            f"  src: url('fonts/{fname}') format('woff2');",
        ]
        if urange:
            rule.append(f"  unicode-range: {urange.group(1).strip()};")
        rule.append("}")
        out.append("\n".join(rule))
        print(f"  baixado {fname} ({len(data)//1024} KB)")

    with open(CSS_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"OK: {count} arquivos woff2, fonts.css gerado.")


if __name__ == "__main__":
    main()
