"""Utility to provision CLIMADA LitPop GPW population data from a local ZIP file.

Usage:
  C:/Users/Barbara.dias/.conda/envs/climada-env/python.exe scripts/setup_litpop_data.py --zip "C:/path/to/gpw-v4-population-count-rev11_2020_30_sec_tif.zip"

Optional:
  --target-dir "C:/Users/Barbara.dias/climada/data"
  --run-smoke-test
"""

from __future__ import annotations

import argparse
import os
import sys
import zipfile
from pathlib import Path


EXPECTED_FOLDER = "gpw-v4-population-count-rev11_2020_30_sec_tif"
EXPECTED_FILE = "gpw_v4_population_count_rev11_2020_30_sec.tif"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Setup LitPop GPW dataset for CLIMADA")
    parser.add_argument("--zip", dest="zip_path", required=True, help="Path to GPW zip file")
    parser.add_argument("--target-dir", dest="target_dir", default=None, help="CLIMADA data directory")
    parser.add_argument("--run-smoke-test", action="store_true", help="Run LitPop smoke test after extraction")
    return parser.parse_args()


def resolve_target_dir(target_dir: str | None) -> Path:
    if target_dir:
        return Path(target_dir)

    try:
        from climada.util.constants import SYSTEM_DIR  # type: ignore

        return Path(str(SYSTEM_DIR))
    except Exception:
        home = Path.home()
        return home / "climada" / "data"


def extract_zip(zip_path: Path, target_dir: Path) -> None:
    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP not found: {zip_path}")

    target_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(target_dir)


def validate_dataset(target_dir: Path) -> Path:
    dataset_file = target_dir / EXPECTED_FOLDER / EXPECTED_FILE
    if not dataset_file.exists():
        raise FileNotFoundError(
            "Expected GPW file not found after extraction: "
            f"{dataset_file}"
        )
    return dataset_file


def run_smoke_test() -> None:
    from climada.entity import LitPop  # type: ignore

    exposure = LitPop.from_countries(
        countries=["BRA"],
        res_arcsec=300,
        exponents=(0, 1),
        fin_mode="pc",
        reference_year=2020,
    )

    gdf = exposure.gdf
    size = 0 if gdf is None else len(gdf)
    print(f"[OK] LitPop smoke test executed. Exposure rows: {size}")


def main() -> int:
    args = parse_args()
    zip_path = Path(args.zip_path)
    target_dir = resolve_target_dir(args.target_dir)

    print(f"[INFO] ZIP: {zip_path}")
    print(f"[INFO] Target dir: {target_dir}")

    try:
        extract_zip(zip_path, target_dir)
        dataset_file = validate_dataset(target_dir)
        print(f"[OK] GPW dataset ready: {dataset_file}")

        if args.run_smoke_test:
            run_smoke_test()

        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
