#!/usr/bin/env python3
"""WaveOps: baixa e vendoriza os módulos ESM usados pelos islands React.

Regenera assets/vendor/. Rodar com: python _fetch_vendor.py

Por que as duas flags do esm.sh são obrigatórias juntas:
  bundle-deps  inlina motion-dom, motion-utils e scheduler.
  deps=        força react e react-dom para UMA versão. Sem isso o framer-motion
               resolve react@^19.2.0 por conta própria, a página carrega dois
               Reacts e os hooks quebram com "Invalid hook call".
"""
import re
import sys
import urllib.request
from pathlib import Path

REACT = "19.2.8"
FRAMER_MOTION = "11.18.2"
QUERY = f"bundle-deps&deps=react@{REACT},react-dom@{REACT}&target=es2022"
OUT = Path(__file__).parent / "assets" / "vendor"

MODULES = {
    "react.mjs": f"react@{REACT}",
    "jsx-runtime.mjs": f"react@{REACT}/jsx-runtime",
    "react-dom-client.mjs": f"react-dom@{REACT}/client",
    "framer-motion.mjs": f"framer-motion@{FRAMER_MOTION}",
    "emotion-is-prop-valid.mjs": "@emotion/is-prop-valid",
}

# Caminho absoluto do esm.sh para arquivo local. A ordem importa: jsx-runtime
# antes de react, senão o padrão mais curto casa primeiro.
REWRITES = [
    (re.compile(r'"/react@[^"]*?/jsx-runtime\.mjs"'), '"./jsx-runtime.mjs"'),
    (re.compile(r'"/react@[^"]*?/react\.mjs"'), '"./react.mjs"'),
    (re.compile(r'"/@emotion/is-prop-valid[^"]*"'), '"./emotion-is-prop-valid.mjs"'),
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "waveops-vendor"})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read().decode("utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in MODULES.items():
        stub = fetch(f"https://esm.sh/{spec}?{QUERY}")
        paths = re.findall(r'"(/[^"]+\.m?js)"', stub)
        if not paths:
            sys.exit(f"esm.sh não devolveu caminho de bundle para {spec}")
        code = fetch("https://esm.sh" + paths[-1])
        for pattern, replacement in REWRITES:
            code = pattern.sub(replacement, code)
        leftover = sorted(set(re.findall(r'from\s*"(/[^"]+)"', code)))
        if leftover:
            sys.exit(f"{name} ainda tem import absoluto: {leftover}")
        (OUT / name).write_text(code, encoding="utf-8")
        print(f"{name:28} {len(code.encode('utf-8')):>8} B")
    print("OK: assets/vendor regenerado")


if __name__ == "__main__":
    main()
