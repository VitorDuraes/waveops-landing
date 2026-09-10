#!/usr/bin/env python3
"""
Gera a sequencia de quadros do painel de fluxo WaveOps, para a secao
"Como funciona" da landing raspar por scroll (fase 2 do plano de islands
React, ImageSequence).

Fluxo:
1. Sobe um servidor HTTP local servindo a raiz do repo. E preciso porque
   dev/_gen-sequence.html importa assets/fonts.css, assets/styles.css e
   assets/cinematic.css por caminho relativo, e isso nao carrega direito
   por file://.
2. Para cada quadro i em [0, N-1], abre o Chrome headless nessa pagina com
   ?t=i/(N-1), captura um PNG em 960x720 e converte para WebP com Pillow.
3. Grava os quadros em assets/sequence/frame-XXX.webp e imprime o peso
   total, o peso medio por quadro e a qualidade usada.
4. Nunca ultrapassa o teto de 400 KB para o conjunto inteiro: se a
   qualidade inicial estourar, o script cai a qualidade WebP em passos e
   tenta de novo. Se mesmo na qualidade minima nao couber, falha alto
   (exit code diferente de zero) em vez de gravar um conjunto pesado
   demais para uma pagina de captacao de lead.

Uso:
    python _gen_sequence.py
    python _gen_sequence.py --frames 48 --quality 75
"""
import argparse
import http.server
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
GEN_PAGE = "dev/_gen-sequence.html"
OUT_DIR = ROOT / "assets" / "sequence"
WIDTH, HEIGHT = 960, 720
PESO_MAXIMO_BYTES = 400 * 1024
QUALIDADE_MINIMA = 20
PASSO_QUALIDADE = 10
PARALELISMO = 6


def achar_porta_livre():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class ServidorSilencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, formato, *args):
        pass


def subir_servidor(porta):
    def fabrica(*args, **kwargs):
        return ServidorSilencioso(*args, directory=str(ROOT), **kwargs)

    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", porta), fabrica)
    thread = threading.Thread(target=servidor.serve_forever, daemon=True)
    thread.start()
    return servidor


def capturar_quadro(porta, indice, total, tmp_dir):
    t = indice / (total - 1) if total > 1 else 1.0
    url = f"http://127.0.0.1:{porta}/{GEN_PAGE}?t={t:.5f}"
    png_path = tmp_dir / f"frame-{indice:03d}.png"
    cmd = [
        CHROME,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-color-profile=srgb",
        f"--screenshot={png_path}",
        f"--window-size={WIDTH},{HEIGHT}",
        "--virtual-time-budget=2000",
        url,
    ]
    resultado = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if resultado.returncode != 0 or not png_path.exists():
        raise RuntimeError(
            f"Chrome headless falhou no quadro {indice} (t={t:.3f}): "
            f"{resultado.stderr.strip()}"
        )
    return indice, png_path


def gerar_pngs(porta, total):
    tmp_dir = Path(tempfile.mkdtemp(prefix="waveops-sequence-"))
    resultados = {}
    with ThreadPoolExecutor(max_workers=PARALELISMO) as pool:
        futuros = [
            pool.submit(capturar_quadro, porta, i, total, tmp_dir)
            for i in range(total)
        ]
        for futuro in as_completed(futuros):
            indice, png_path = futuro.result()
            resultados[indice] = png_path
    return tmp_dir, [resultados[i] for i in range(total)]


def converter_para_webp(png_paths, qualidade, out_dir):
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    caminhos = []
    for i, png_path in enumerate(png_paths):
        with Image.open(png_path) as img:
            rgb = img.convert("RGB")
            destino = out_dir / f"frame-{i:03d}.webp"
            rgb.save(destino, "WEBP", quality=qualidade, method=6)
        caminhos.append(destino)
    return caminhos


def peso_total(caminhos):
    return sum(p.stat().st_size for p in caminhos)


def main():
    parser = argparse.ArgumentParser(
        description="Gera a sequencia de quadros do painel de fluxo WaveOps"
    )
    parser.add_argument("--frames", type=int, default=48, help="numero de quadros")
    parser.add_argument(
        "--quality",
        type=int,
        default=75,
        help="qualidade WebP inicial, cai automaticamente se estourar o teto de 400 KB",
    )
    args = parser.parse_args()

    if not Path(CHROME).exists():
        sys.exit(f"Chrome nao encontrado em {CHROME}")

    porta = achar_porta_livre()
    servidor = subir_servidor(porta)
    tmp_dir = None
    try:
        print(f"Servidor local em http://127.0.0.1:{porta}, raiz {ROOT}")
        print(f"Capturando {args.frames} quadros em {WIDTH}x{HEIGHT}...")
        tmp_dir, pngs = gerar_pngs(porta, args.frames)

        qualidade = args.quality
        caminhos = None
        total_bytes = None
        coube = False
        while qualidade >= QUALIDADE_MINIMA:
            caminhos = converter_para_webp(pngs, qualidade, OUT_DIR)
            total_bytes = peso_total(caminhos)
            print(
                f"Qualidade {qualidade}: {total_bytes / 1024:.1f} KB "
                f"para {len(caminhos)} quadros"
            )
            if total_bytes <= PESO_MAXIMO_BYTES:
                coube = True
                break
            qualidade -= PASSO_QUALIDADE

        if not coube:
            sys.exit(
                "ERRO: nao coube no teto de 400 KB nem na qualidade minima "
                f"({QUALIDADE_MINIMA}) com {args.frames} quadros. "
                "Rode de novo com --frames menor."
            )

        media = total_bytes / len(caminhos)
        folga = (PESO_MAXIMO_BYTES - total_bytes) / 1024
        print("---")
        print(f"Quadros: {len(caminhos)}")
        print(f"Resolucao: {WIDTH}x{HEIGHT}")
        print(f"Qualidade WebP final: {qualidade}")
        print(f"Peso total: {total_bytes / 1024:.1f} KB ({total_bytes} bytes)")
        print(f"Peso medio por quadro: {media / 1024:.2f} KB")
        print(f"Teto: {PESO_MAXIMO_BYTES / 1024:.0f} KB, folga de {folga:.1f} KB")
    finally:
        servidor.shutdown()
        if tmp_dir is not None:
            shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
