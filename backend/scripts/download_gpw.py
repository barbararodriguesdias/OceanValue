#!/usr/bin/env python
"""
Download GPW v4.11 (2020) diretamente do servidor NASA usando credenciais Earthdata.

Este script automatiza o download do arquivo GPW necessário para LitPop.

Uso:
    python backend/scripts/download_gpw.py --email seu@email.com --output C:\path\to\save
    python backend/scripts/download_gpw.py --email seu@email.com  # salva em Downloads/

Requisitos:
    - Conta NASA Earthdata ativa (https://urs.earthdata.nasa.gov/users/new)
    - Pacote earthaccess instalado: pip install earthaccess
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import earthaccess
except ImportError:
    print("ERROR: earthaccess não está instalado.")
    print("Instale com: pip install earthaccess")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download GPW v4.11 2020 do servidor NASA Earthdata"
    )
    parser.add_argument(
        "--email",
        dest="email",
        required=True,
        help="Email da conta NASA Earthdata",
    )
    parser.add_argument(
        "--password",
        dest="password",
        default=None,
        help="Senha NASA Earthdata (será pedida interativamente se omitida)",
    )
    parser.add_argument(
        "--output",
        dest="output_dir",
        default=None,
        help="Diretório de saída (padrão: ~/Downloads)",
    )
    parser.add_argument(
        "--no-unzip",
        action="store_true",
        help="Não descompactar o arquivo após download",
    )
    return parser.parse_args()


def resolve_output_dir(output_dir: str | None) -> Path:
    if output_dir:
        path = Path(output_dir)
    else:
        path = Path.home() / "Downloads"

    path.mkdir(parents=True, exist_ok=True)
    return path


def download_gpw(email: str, password: str | None, output_dir: Path) -> Path:
    """Download GPW v4.11 2020 do servidor SEDAC/Earthdata."""

    print(f"[INFO] Autenticando com email: {email}")
    if password is None:
        # earthaccess pedirá a senha interativamente
        earthaccess.login(strategy="interactive", persist=True)
    else:
        earthaccess.login(username=email, password=password, persist=True)

    print("[INFO] Conectado ao NASA Earthdata.")

    # URL direta do arquivo GPW v4.11 2020
    gpw_url = "https://sedac.ciesin.columbia.edu/downloads/data/gpw-v4/gpw-v4-population-count-rev11/gpw-v4-population-count-rev11_2020_30_sec_tif.zip"
    filename = "gpw-v4-population-count-rev11_2020_30_sec_tif.zip"
    file_path = output_dir / filename

    print(f"[INFO] Baixando GPW v4.11 2020...")
    print(f"[INFO] URL: {gpw_url}")
    print(f"[INFO] Destino: {file_path}")
    print(f"[INFO] Tamanho esperado: ~580 MB (pode levar 10-20 minutos)")

    try:
        import urllib.request
        import shutil
        
        # Download com barra de progresso e timeout aumentado
        def download_with_progress(url: str, filepath: Path, timeout: int = 600) -> None:
            with urllib.request.urlopen(url, timeout=timeout) as response:
                total_size = int(response.headers.get('Content-Length', 0))
                chunk_size = 8192
                downloaded = 0
                
                with open(filepath, 'wb') as out_file:
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        out_file.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            print(f"  [{percent:.1f}%] {downloaded / 1e6:.1f} MB de {total_size / 1e6:.1f} MB", end='\r')
        
        download_with_progress(gpw_url, file_path, timeout=600)
        print()  # Nova linha após progresso
        
        if file_path.exists():
            size_gb = file_path.stat().st_size / 1e9
            print(f"[OK] Download concluído: {file_path}")
            print(f"[INFO] Tamanho: {size_gb:.2f} GB")
            return file_path
        else:
            print("[ERROR] Arquivo não foi criado após download.")
            return None
                
    except Exception as exc:
        print(f"[ERROR] Falha no download: {exc}")
        return None


def main() -> int:
    args = parse_args()
    output_dir = resolve_output_dir(args.output_dir)

    try:
        file_path = download_gpw(
            email=args.email,
            password=args.password,
            output_dir=output_dir,
        )

        if file_path is None:
            return 1

        print(f"\n[SUCCESS] Arquivo disponível em: {file_path}")
        print(f"\nPróximo passo: provisionar no OceanValue com:")
        print(
            f'  python backend/scripts/setup_litpop_data.py --zip "{file_path}" --run-smoke-test'
        )

        return 0

    except Exception as exc:
        print(f"[ERROR] {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
