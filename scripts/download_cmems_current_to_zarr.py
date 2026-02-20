import argparse
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Tuple

import fiona
import xarray as xr

try:
    import copernicusmarine  # type: ignore
except Exception:
    copernicusmarine = None

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


def _detect_coord(ds: xr.Dataset, names: List[str]) -> str:
    for name in names:
        if name in ds.coords:
            return name
    raise KeyError(f"Nenhuma coordenada encontrada entre: {names}")


def _slice_by_bounds(data: xr.DataArray, coord_name: str, lower: float, upper: float) -> xr.DataArray:
    coord_values = data[coord_name].values
    if coord_values.size < 2:
        return data.sel({coord_name: slice(lower, upper)})

    ascending = bool(coord_values[0] < coord_values[-1])
    if ascending:
        return data.sel({coord_name: slice(lower, upper)})
    return data.sel({coord_name: slice(upper, lower)})


def _normalize_longitude_bounds(ds: xr.Dataset, lon_name: str, west: float, east: float) -> Tuple[float, float]:
    lon_vals = ds[lon_name].values
    lon_min = float(lon_vals.min())
    lon_max = float(lon_vals.max())

    if lon_min >= 0 and west < 0:
        west = west % 360
        east = east % 360

    if west > east:
        west, east = min(west, east), max(west, east)

    return west, east


def month_ranges(start: datetime, end: datetime):
    cursor = datetime(start.year, start.month, 1)
    while cursor <= end:
        if cursor.month == 12:
            next_month = datetime(cursor.year + 1, 1, 1)
        else:
            next_month = datetime(cursor.year, cursor.month + 1, 1)

        month_start = max(cursor, start)
        month_end = min(end, next_month)
        yield month_start, month_end
        cursor = next_month


def append_to_zarr(ds_month: xr.Dataset, zarr_path: Path, first_write: bool) -> None:
    rename_map = {}
    if "latitude" in ds_month.coords and "lat" not in ds_month.coords:
        rename_map["latitude"] = "lat"
    if "longitude" in ds_month.coords and "lon" not in ds_month.coords:
        rename_map["longitude"] = "lon"
    if "valid_time" in ds_month.coords and "time" not in ds_month.coords:
        rename_map["valid_time"] = "time"
    if rename_map:
        ds_month = ds_month.rename(rename_map)

    ds_month = ds_month.chunk({"time": 168, "lat": 80, "lon": 80})

    if first_write:
        ds_month.to_zarr(zarr_path, mode="w", consolidated=True, safe_chunks=False)
    else:
        ds_month.to_zarr(zarr_path, mode="a", append_dim="time", consolidated=True, safe_chunks=False)


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Download CMEMS current (uo/vo) and build Zarr cache")
    parser.add_argument("--dataset-id", type=str, default="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m")
    parser.add_argument("--u-var", type=str, default="uo")
    parser.add_argument("--v-var", type=str, default="vo")
    parser.add_argument("--start", type=str, default="2021-01-01")
    parser.add_argument("--end", type=str, default="2024-12-31")
    parser.add_argument("--raw-dir", type=str, default="D:/OceanPact/climate_data/raw/cmems_current")
    parser.add_argument("--out-zarr", type=str, default="D:/OceanPact/climate_data/zarr/cmems_current/cmems_current.zarr")
    parser.add_argument("--username", type=str, default="")
    parser.add_argument("--password", type=str, default="")
    parser.add_argument(
        "--shapefiles",
        nargs="+",
        default=DEFAULT_SHAPEFILES,
        help="Lista de shapefiles para calcular o recorte espacial (bbox).",
    )
    args = parser.parse_args()

    if copernicusmarine is None:
        raise RuntimeError("Pacote copernicusmarine não está instalado no ambiente Python.")

    workspace_root = Path(__file__).resolve().parents[1]
    shapefiles = _resolve_paths(args.shapefiles, workspace_root)
    north, west, south, east = bbox_from_shapefiles(shapefiles)

    start_dt = datetime.fromisoformat(args.start)
    end_dt = datetime.fromisoformat(args.end)
    if end_dt <= start_dt:
        raise ValueError("Data final deve ser maior que data inicial.")

    username = args.username or None
    password = args.password or None

    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    zarr_path = Path(args.out_zarr)
    zarr_path.parent.mkdir(parents=True, exist_ok=True)

    ds = copernicusmarine.open_dataset(
        dataset_id=args.dataset_id,
        username=username,
        password=password,
    )

    lat_name = _detect_coord(ds, ["lat", "latitude", "y"])
    lon_name = _detect_coord(ds, ["lon", "longitude", "x"])
    time_name = _detect_coord(ds, ["time", "t"])

    west_ds, east_ds = _normalize_longitude_bounds(ds, lon_name, west, east)

    first_write = not zarr_path.exists()
    for month_start, month_end in month_ranges(start_dt, end_dt):
        month_tag = month_start.strftime("%Y_%m")
        nc_path = raw_dir / f"cmems_current_{month_tag}.nc"

        vars_ds = ds[[args.u_var, args.v_var]]
        subset = vars_ds.sel({time_name: slice(month_start.isoformat(), month_end.isoformat())})
        subset_u = _slice_by_bounds(subset[args.u_var], lat_name, south, north)
        subset_u = _slice_by_bounds(subset_u, lon_name, west_ds, east_ds)
        subset_v = _slice_by_bounds(subset[args.v_var], lat_name, south, north)
        subset_v = _slice_by_bounds(subset_v, lon_name, west_ds, east_ds)

        subset_ds = xr.Dataset({args.u_var: subset_u, args.v_var: subset_v})
        subset_ds = subset_ds.load()

        if subset_ds.sizes.get(time_name, 0) == 0:
            print(f"⚠️ Sem dados em {month_tag}, pulando.")
            continue

        subset_ds.to_netcdf(nc_path)
        append_to_zarr(subset_ds, zarr_path, first_write)
        first_write = False
        print(f"✅ CMEMS corrente processado: {month_tag}")

    print("\n✅ Concluído.")
    print(f"Zarr: {zarr_path}")
    print(f"BBox (N, W, S, E): {(north, west, south, east)}")


if __name__ == "__main__":
    asyncio.run(main_async())
