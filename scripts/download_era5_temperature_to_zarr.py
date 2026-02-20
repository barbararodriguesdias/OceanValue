import argparse
import calendar
from pathlib import Path
from typing import Iterable, List, Tuple

import cdsapi
import fiona
import xarray as xr

DEFAULT_SHAPEFILES = [
    "frontend/public/data/santos/Santos-polygon.shp",
    "frontend/public/data/campos/Campos-polygon.shp",
]


def _resolve_paths(paths: Iterable[str], workspace_root: Path) -> List[Path]:
    resolved: List[Path] = []
    for item in paths:
        path = Path(item)
        if not path.is_absolute():
            path = workspace_root / path
        resolved.append(path)
    return resolved


def bbox_from_shapefiles(shapefiles: Iterable[Path]) -> Tuple[float, float, float, float]:
    min_lon = float("inf")
    min_lat = float("inf")
    max_lon = float("-inf")
    max_lat = float("-inf")

    for shp_path in shapefiles:
        if not shp_path.exists():
            raise FileNotFoundError(f"Shapefile não encontrado: {shp_path}")
        with fiona.open(shp_path) as src:
            bounds = src.bounds
            min_lon = min(min_lon, float(bounds[0]))
            min_lat = min(min_lat, float(bounds[1]))
            max_lon = max(max_lon, float(bounds[2]))
            max_lat = max(max_lat, float(bounds[3]))

    if not all(map(lambda value: value != float("inf") and value != float("-inf"), [min_lon, min_lat, max_lon, max_lat])):
        raise RuntimeError("Não foi possível calcular bounding box dos shapefiles.")

    north = max_lat
    west = min_lon
    south = min_lat
    east = max_lon
    return north, west, south, east


def download_month(cds: cdsapi.Client, year: int, month: int, area: Tuple[float, float, float, float], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"era5_temperature_{year}_{month:02d}.nc"
    if out_file.exists():
        return out_file

    days_in_month = calendar.monthrange(year, month)[1]
    days = [f"{d:02d}" for d in range(1, days_in_month + 1)]
    hours = [f"{h:02d}:00" for h in range(24)]

    cds.retrieve(
        "reanalysis-era5-single-levels",
        {
            "product_type": "reanalysis",
            "variable": ["2m_temperature"],
            "year": str(year),
            "month": f"{month:02d}",
            "day": days,
            "time": hours,
            "area": list(area),
            "format": "netcdf",
        },
        str(out_file),
    )

    return out_file


def append_to_zarr(nc_file: Path, zarr_path: Path, first_write: bool) -> None:
    ds = xr.open_dataset(nc_file)

    rename_map = {}
    if "valid_time" in ds.dims and "time" not in ds.dims:
        rename_map["valid_time"] = "time"
    if "latitude" in ds.coords and "lat" not in ds.coords:
        rename_map["latitude"] = "lat"
    if "longitude" in ds.coords and "lon" not in ds.coords:
        rename_map["longitude"] = "lon"
    if rename_map:
        ds = ds.rename(rename_map)

    if "t2m" in ds:
        ds["t2m_c"] = ds["t2m"] - 273.15
        ds["t2m_c"].attrs.update({"units": "degC", "long_name": "2m_temperature_celsius"})

    ds = ds.chunk({"time": 168, "lat": 64, "lon": 64})

    if first_write:
        ds.to_zarr(zarr_path, mode="w", consolidated=True, safe_chunks=False)
    else:
        ds.to_zarr(zarr_path, mode="a", append_dim="time", consolidated=True, safe_chunks=False)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download ERA5 temperature and build Zarr cache")
    parser.add_argument("--start-year", type=int, default=1979)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument("--raw-dir", type=str, default="D:/OceanPact/climate_data/raw/era5_temperature")
    parser.add_argument("--out-zarr", type=str, default="D:/OceanPact/climate_data/zarr/era5_temperature/era5_temperature.zarr")
    parser.add_argument(
        "--shapefiles",
        nargs="+",
        default=DEFAULT_SHAPEFILES,
        help="Lista de shapefiles para calcular o recorte espacial (bbox).",
    )
    args = parser.parse_args()

    workspace_root = Path(__file__).resolve().parents[1]
    shapefiles = _resolve_paths(args.shapefiles, workspace_root)
    area = bbox_from_shapefiles(shapefiles)

    raw_dir = Path(args.raw_dir)
    zarr_path = Path(args.out_zarr)
    zarr_path.parent.mkdir(parents=True, exist_ok=True)

    cds = cdsapi.Client()

    first_write = not zarr_path.exists()
    for year in range(args.start_year, args.end_year + 1):
        for month in range(1, 13):
            nc_file = download_month(cds, year, month, area, raw_dir)
            append_to_zarr(nc_file, zarr_path, first_write)
            first_write = False
            print(f"✅ ERA5 temperatura processado: {year}-{month:02d}")

    print("\n✅ Concluído.")
    print(f"Zarr: {zarr_path}")
    print(f"BBox (N, W, S, E): {area}")


if __name__ == "__main__":
    main()
