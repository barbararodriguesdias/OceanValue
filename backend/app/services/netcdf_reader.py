"""Service for reading local NetCDF wind and wave datasets."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple
import os

import xarray as xr
import numpy as np

LEGACY_BASE_DIR = Path(
    r"C:\Users\Barbara.dias\Downloads\climada_python-project\climada_python-main\OMARSAT_climada\climada-risk-analysis\src\data\Netcdf"
)
EXTERNAL_BASE_DIR = Path(r"D:\OceanPact\Netcdf")
WORKSPACE_BASE_DIR = Path(__file__).resolve().parents[3] / "data" / "netcdf"


def _resolve_base_dir() -> Path:
    configured = os.getenv("NETCDF_BASE_DIR")
    if configured:
        return Path(configured).expanduser()

    for candidate in (EXTERNAL_BASE_DIR, LEGACY_BASE_DIR, WORKSPACE_BASE_DIR):
        if candidate.exists():
            return candidate

    return WORKSPACE_BASE_DIR


BASE_DIR = _resolve_base_dir()


@dataclass
class NetcdfPaths:
    wind_hist_mean: Path = BASE_DIR / "historico" / "vento" / "sfcWind_hist_processado.nc"
    wind_hist_max: Path = BASE_DIR / "historico" / "vento" / "sfcWindmax_hist_processado.nc"
    wind_pred_mean: Path = BASE_DIR / "preditivo" / "vento" / "sfcWind_ssp585_processado.nc"
    wind_pred_max: Path = BASE_DIR / "preditivo" / "vento" / "sfcWindmax_ssp585_processado.nc"
    wave_hist_mean: Path = BASE_DIR / "historico" / "onda" / "hsmean_ww3_mri_1979_2015.nc"
    wave_hist_max: Path = BASE_DIR / "historico" / "onda" / "hsmax_ww3_mri_1979_2015.nc"
    wave_pred_mean_early: Path = BASE_DIR / "preditivo" / "onda" / "hsmean_ww3_mri_2015_2030.nc"
    wave_pred_mean_late: Path = BASE_DIR / "preditivo" / "onda" / "hsmean_ww3_mri_2031_2060.nc"
    wave_pred_max_early: Path = BASE_DIR / "preditivo" / "onda" / "hsmax_ww3_mri_2015_2030.nc"
    wave_pred_max_late: Path = BASE_DIR / "preditivo" / "onda" / "hsmax_ww3_mri_2031_2060.nc"


class NetcdfReader:
    def __init__(self) -> None:
        self.paths = NetcdfPaths()
        self._cache: Dict[Path, xr.Dataset] = {}

    def _open(self, path: Path) -> xr.Dataset:
        if not path.exists():
            raise FileNotFoundError(
                f"Arquivo NetCDF não encontrado: {path}. "
                f"Configure NETCDF_BASE_DIR para o diretório raiz dos NetCDFs."
            )
        if path not in self._cache:
            self._cache[path] = xr.open_dataset(path)
        return self._cache[path]

    @staticmethod
    def _sanitize(values: np.ndarray) -> list:
        arr = np.asarray(values)
        arr = np.where(np.isfinite(arr), arr, np.nan)
        data = arr.astype(object).tolist()

        def replace(item):
            if isinstance(item, list):
                return [replace(x) for x in item]
            if isinstance(item, float):
                if np.isnan(item) or np.isinf(item):
                    return None
            return item

        return replace(data)

    @staticmethod
    def _find_coord(ds: xr.Dataset, candidates: list[str]) -> str:
        for name in candidates:
            if name in ds.coords:
                return name
        raise KeyError(f"Nenhuma coordenada encontrada entre: {candidates}")

    @staticmethod
    def _slice_coord(da: xr.DataArray, coord: str, min_val: Optional[float], max_val: Optional[float]) -> xr.DataArray:
        if min_val is None and max_val is None:
            return da
        coords = da[coord].values
        if min_val is None:
            min_val = float(coords.min())
        if max_val is None:
            max_val = float(coords.max())
        if coords[0] < coords[-1]:
            return da.sel({coord: slice(min_val, max_val)})
        return da.sel({coord: slice(max_val, min_val)})

    @staticmethod
    def _select_time(da: xr.DataArray, time_value: str, time_name: str) -> xr.DataArray:
        return da.sel({time_name: time_value}, method="nearest")

    def _parse_year(self, time_value: str) -> int:
        try:
            return datetime.fromisoformat(time_value.replace("Z", "")).year
        except ValueError:
            return int(time_value[:4])

    def _pick_wind_path(self, time_value: str, stat: str) -> Path:
        year = self._parse_year(time_value)
        if year < 2015:
            return self.paths.wind_hist_max if stat == "max" else self.paths.wind_hist_mean
        return self.paths.wind_pred_max if stat == "max" else self.paths.wind_pred_mean

    def _pick_wind_future_path(self, scenario: str, stat: str) -> Path:
        scenario_norm = (scenario or "ssp585").lower()
        if scenario_norm != "ssp585":
            raise ValueError("Cenário não suportado para vento no momento. Use 'ssp585'.")
        return self.paths.wind_pred_max if stat == "max" else self.paths.wind_pred_mean

    def _pick_wave_future_paths(self, scenario: str, stat: str, start_year: int, end_year: int) -> list[Path]:
        scenario_norm = (scenario or "ssp585").lower()
        if scenario_norm != "ssp585":
            raise ValueError("Cenário não suportado para onda no momento. Use 'ssp585'.")

        paths: list[Path] = []
        if start_year <= 2030 and end_year >= 2015:
            paths.append(self.paths.wave_pred_max_early if stat == "max" else self.paths.wave_pred_mean_early)
        if start_year <= 2060 and end_year >= 2031:
            paths.append(self.paths.wave_pred_max_late if stat == "max" else self.paths.wave_pred_mean_late)
        return paths

    def _pick_wave_path(self, time_value: str, stat: str) -> Path:
        year = self._parse_year(time_value)
        if year < 2015:
            return self.paths.wave_hist_max if stat == "max" else self.paths.wave_hist_mean
        if year < 2031:
            return self.paths.wave_pred_max_early if stat == "max" else self.paths.wave_pred_mean_early
        return self.paths.wave_pred_max_late if stat == "max" else self.paths.wave_pred_mean_late

    def get_wind_snapshot(
        self,
        time: str,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        stat: str = "mean",
    ) -> Dict:
        path = self._pick_wind_path(time, stat)
        ds = self._open(path)
        time_name = self._find_coord(ds, ["time", "t"])
        lat_name = self._find_coord(ds, ["lat", "latitude", "y"])
        lon_name = self._find_coord(ds, ["lon", "longitude", "x"])

        var_name = "sfcWind_corr" if "sfcWind_corr" in ds.data_vars else "sfcWind"
        data = ds[var_name]
        data = self._select_time(data, time, time_name)
        data = self._slice_coord(data, lat_name, lat_min, lat_max)
        data = self._slice_coord(data, lon_name, lon_min, lon_max)
        data = data.load()

        return {
            "lat": self._sanitize(np.asarray(data[lat_name].values)),
            "lon": self._sanitize(np.asarray(data[lon_name].values)),
            "values": self._sanitize(data.values),
            "time": str(data[time_name].values),
        }

    def get_wave_snapshot(
        self,
        time: str,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        stat: str = "mean",
    ) -> Dict:
        path = self._pick_wave_path(time, stat)
        ds = self._open(path)
        time_name = self._find_coord(ds, ["time", "t"])
        lat_name = self._find_coord(ds, ["lat", "latitude", "y"])
        lon_name = self._find_coord(ds, ["lon", "longitude", "x"])

        var_name = "hs" if "hs" in ds.data_vars else list(ds.data_vars)[0]
        data = ds[var_name]
        data = self._select_time(data, time, time_name)
        data = self._slice_coord(data, lat_name, lat_min, lat_max)
        data = self._slice_coord(data, lon_name, lon_min, lon_max)
        data = data.load()

        return {
            "lat": self._sanitize(np.asarray(data[lat_name].values)),
            "lon": self._sanitize(np.asarray(data[lon_name].values)),
            "values": self._sanitize(data.values),
            "time": str(data[time_name].values),
        }

    @staticmethod
    def _period_to_years(period: str) -> Tuple[int, int]:
        raw = (period or "").strip()
        if not raw or "-" not in raw:
            raise ValueError("Período inválido. Use o formato 'YYYY-YYYY'.")

        chunks = [part.strip() for part in raw.split("-") if part.strip()]
        if len(chunks) != 2:
            raise ValueError("Período inválido. Use o formato 'YYYY-YYYY'.")

        start_year = int(chunks[0])
        end_year = int(chunks[1])
        if end_year < start_year:
            raise ValueError("Período inválido: ano final menor que ano inicial.")
        return start_year, end_year

    @staticmethod
    def _array_summary_knots(values_knots: np.ndarray, op_knots: float, att_knots: float) -> Dict:
        values = np.asarray(values_knots).astype(float)
        values = values[np.isfinite(values)]
        if values.size == 0:
            return {
                "samples": 0,
                "mean_knots": 0.0,
                "p90_knots": 0.0,
                "p95_knots": 0.0,
                "max_knots": 0.0,
                "operational_samples": 0,
                "attention_samples": 0,
                "stop_samples": 0,
            }

        stop_mask = values >= att_knots
        attention_mask = (values >= op_knots) & (values < att_knots)
        operational_mask = values < op_knots

        return {
            "samples": int(values.size),
            "mean_knots": float(np.mean(values)),
            "p90_knots": float(np.percentile(values, 90)),
            "p95_knots": float(np.percentile(values, 95)),
            "max_knots": float(np.max(values)),
            "operational_samples": int(np.sum(operational_mask)),
            "attention_samples": int(np.sum(attention_mask)),
            "stop_samples": int(np.sum(stop_mask)),
        }

    @staticmethod
    def _array_summary_meters(values_meters: np.ndarray, op_meters: float, att_meters: float) -> Dict:
        values = np.asarray(values_meters).astype(float)
        values = values[np.isfinite(values)]
        if values.size == 0:
            return {
                "samples": 0,
                "mean_meters": 0.0,
                "p90_meters": 0.0,
                "p95_meters": 0.0,
                "max_meters": 0.0,
                "operational_samples": 0,
                "attention_samples": 0,
                "stop_samples": 0,
            }

        stop_mask = values >= att_meters
        attention_mask = (values >= op_meters) & (values < att_meters)
        operational_mask = values < op_meters

        return {
            "samples": int(values.size),
            "mean_meters": float(np.mean(values)),
            "p90_meters": float(np.percentile(values, 90)),
            "p95_meters": float(np.percentile(values, 95)),
            "max_meters": float(np.max(values)),
            "operational_samples": int(np.sum(operational_mask)),
            "attention_samples": int(np.sum(attention_mask)),
            "stop_samples": int(np.sum(stop_mask)),
        }

    def _load_wave_point_period(
        self,
        *,
        lat: float,
        lon: float,
        stat: str,
        start_year: int,
        end_year: int,
        source: str,
    ) -> xr.DataArray:
        if source == "historical":
            paths = [self.paths.wave_hist_max if stat == "max" else self.paths.wave_hist_mean]
        else:
            paths = self._pick_wave_future_paths("ssp585", stat, start_year, end_year)

        points: list[xr.DataArray] = []
        for path in paths:
            ds = self._open(path)
            time_name = self._find_coord(ds, ["time", "t"])
            lat_name = self._find_coord(ds, ["lat", "latitude", "y"])
            lon_name = self._find_coord(ds, ["lon", "longitude", "x"])
            var_name = "hs" if "hs" in ds.data_vars else list(ds.data_vars)[0]

            point = ds[var_name].sel({lat_name: lat, lon_name: lon}, method="nearest")
            time_values = point[time_name]
            mask = (time_values.dt.year >= start_year) & (time_values.dt.year <= end_year)
            filtered = point.where(mask, drop=True).load()
            if filtered.sizes.get(time_name, 0) > 0:
                points.append(filtered)

        if not points:
            empty_time = np.array([], dtype="datetime64[ns]")
            return xr.DataArray(np.array([], dtype=float), coords={"time": empty_time}, dims=["time"])

        if len(points) == 1:
            return points[0]

        combined = xr.concat(points, dim="time")
        return combined.sortby("time")

    def get_wind_scenario_comparison(
        self,
        lat: float,
        lon: float,
        scenario: str = "ssp585",
        stat: str = "mean",
        historical_period: str = "1985-2014",
        future_period: str = "2035-2064",
        operational_max_knots: float = 15.0,
        attention_max_knots: float = 20.0,
    ) -> Dict:
        if stat not in {"mean", "max"}:
            raise ValueError("Parâmetro stat inválido. Use 'mean' ou 'max'.")

        hist_start, hist_end = self._period_to_years(historical_period)
        fut_start, fut_end = self._period_to_years(future_period)

        hist_path = self.paths.wind_hist_max if stat == "max" else self.paths.wind_hist_mean
        fut_path = self._pick_wind_future_path(scenario, stat)

        hist_ds = self._open(hist_path)
        fut_ds = self._open(fut_path)

        hist_time_name = self._find_coord(hist_ds, ["time", "t"])
        hist_lat_name = self._find_coord(hist_ds, ["lat", "latitude", "y"])
        hist_lon_name = self._find_coord(hist_ds, ["lon", "longitude", "x"])

        fut_time_name = self._find_coord(fut_ds, ["time", "t"])
        fut_lat_name = self._find_coord(fut_ds, ["lat", "latitude", "y"])
        fut_lon_name = self._find_coord(fut_ds, ["lon", "longitude", "x"])

        hist_var = "sfcWind_corr" if "sfcWind_corr" in hist_ds.data_vars else "sfcWind"
        fut_var = "sfcWind_corr" if "sfcWind_corr" in fut_ds.data_vars else "sfcWind"

        hist_point = hist_ds[hist_var].sel({hist_lat_name: lat, hist_lon_name: lon}, method="nearest")
        fut_point = fut_ds[fut_var].sel({fut_lat_name: lat, fut_lon_name: lon}, method="nearest")

        hist_time_values = hist_point[hist_time_name]
        fut_time_values = fut_point[fut_time_name]

        hist_mask = (hist_time_values.dt.year >= hist_start) & (hist_time_values.dt.year <= hist_end)
        fut_mask = (fut_time_values.dt.year >= fut_start) & (fut_time_values.dt.year <= fut_end)

        hist_filtered = hist_point.where(hist_mask, drop=True).load()
        fut_filtered = fut_point.where(fut_mask, drop=True).load()

        to_knots = 1.9438444924406
        hist_values_knots = np.asarray(hist_filtered.values) * to_knots
        fut_values_knots = np.asarray(fut_filtered.values) * to_knots

        hist_summary = self._array_summary_knots(hist_values_knots, operational_max_knots, attention_max_knots)
        fut_summary = self._array_summary_knots(fut_values_knots, operational_max_knots, attention_max_knots)

        hist_yearly = (hist_filtered * to_knots).groupby(f"{hist_time_name}.year").mean(skipna=True)
        fut_yearly = (fut_filtered * to_knots).groupby(f"{fut_time_name}.year").mean(skipna=True)
        hist_monthly = (hist_filtered * to_knots).groupby(f"{hist_time_name}.month").mean(skipna=True)
        fut_monthly = (fut_filtered * to_knots).groupby(f"{fut_time_name}.month").mean(skipna=True)

        hist_month_values = {
            int(month): float(value)
            for month, value in zip(np.asarray(hist_monthly["month"].values), np.asarray(hist_monthly.values))
            if np.isfinite(value)
        }
        fut_month_values = {
            int(month): float(value)
            for month, value in zip(np.asarray(fut_monthly["month"].values), np.asarray(fut_monthly.values))
            if np.isfinite(value)
        }

        return {
            "meta": {
                "scenario": scenario.lower(),
                "stat": stat,
                "lat": float(lat),
                "lon": float(lon),
                "historical_period": historical_period,
                "future_period": future_period,
                "operational_max_knots": float(operational_max_knots),
                "attention_max_knots": float(attention_max_knots),
            },
            "historical": hist_summary,
            "future": fut_summary,
            "delta": {
                "mean_knots": float(fut_summary["mean_knots"] - hist_summary["mean_knots"]),
                "p95_knots": float(fut_summary["p95_knots"] - hist_summary["p95_knots"]),
                "stop_samples": int(fut_summary["stop_samples"] - hist_summary["stop_samples"]),
            },
            "series": {
                "historical_years": self._sanitize(np.asarray(hist_yearly["year"].values)),
                "historical_yearly_mean_knots": self._sanitize(np.asarray(hist_yearly.values)),
                "future_years": self._sanitize(np.asarray(fut_yearly["year"].values)),
                "future_yearly_mean_knots": self._sanitize(np.asarray(fut_yearly.values)),
                "monthly_labels": [f"{month:02d}" for month in range(1, 13)],
                "historical_monthly_mean_knots": [hist_month_values.get(month) for month in range(1, 13)],
                "future_monthly_mean_knots": [fut_month_values.get(month) for month in range(1, 13)],
            },
        }

    def get_wave_scenario_comparison(
        self,
        lat: float,
        lon: float,
        scenario: str = "ssp585",
        stat: str = "mean",
        historical_period: str = "1985-2014",
        future_period: str = "2035-2064",
        operational_max_meters: float = 2.0,
        attention_max_meters: float = 4.0,
    ) -> Dict:
        if stat not in {"mean", "max"}:
            raise ValueError("Parâmetro stat inválido. Use 'mean' ou 'max'.")

        hist_start, hist_end = self._period_to_years(historical_period)
        fut_start, fut_end = self._period_to_years(future_period)

        hist_filtered = self._load_wave_point_period(
            lat=lat,
            lon=lon,
            stat=stat,
            start_year=hist_start,
            end_year=hist_end,
            source="historical",
        )
        fut_filtered = self._load_wave_point_period(
            lat=lat,
            lon=lon,
            stat=stat,
            start_year=fut_start,
            end_year=fut_end,
            source="future",
        )

        hist_values_meters = np.asarray(hist_filtered.values)
        fut_values_meters = np.asarray(fut_filtered.values)

        hist_summary = self._array_summary_meters(hist_values_meters, operational_max_meters, attention_max_meters)
        fut_summary = self._array_summary_meters(fut_values_meters, operational_max_meters, attention_max_meters)

        hist_yearly = hist_filtered.groupby("time.year").mean(skipna=True)
        fut_yearly = fut_filtered.groupby("time.year").mean(skipna=True)
        hist_monthly = hist_filtered.groupby("time.month").mean(skipna=True)
        fut_monthly = fut_filtered.groupby("time.month").mean(skipna=True)

        hist_month_values = {
            int(month): float(value)
            for month, value in zip(np.asarray(hist_monthly["month"].values), np.asarray(hist_monthly.values))
            if np.isfinite(value)
        }
        fut_month_values = {
            int(month): float(value)
            for month, value in zip(np.asarray(fut_monthly["month"].values), np.asarray(fut_monthly.values))
            if np.isfinite(value)
        }

        return {
            "meta": {
                "scenario": scenario.lower(),
                "stat": stat,
                "lat": float(lat),
                "lon": float(lon),
                "historical_period": historical_period,
                "future_period": future_period,
                "operational_max_meters": float(operational_max_meters),
                "attention_max_meters": float(attention_max_meters),
            },
            "historical": hist_summary,
            "future": fut_summary,
            "delta": {
                "mean_meters": float(fut_summary["mean_meters"] - hist_summary["mean_meters"]),
                "p95_meters": float(fut_summary["p95_meters"] - hist_summary["p95_meters"]),
                "stop_samples": int(fut_summary["stop_samples"] - hist_summary["stop_samples"]),
            },
            "series": {
                "historical_years": self._sanitize(np.asarray(hist_yearly["year"].values)),
                "historical_yearly_mean_meters": self._sanitize(np.asarray(hist_yearly.values)),
                "future_years": self._sanitize(np.asarray(fut_yearly["year"].values)),
                "future_yearly_mean_meters": self._sanitize(np.asarray(fut_yearly.values)),
                "monthly_labels": [f"{month:02d}" for month in range(1, 13)],
                "historical_monthly_mean_meters": [hist_month_values.get(month) for month in range(1, 13)],
                "future_monthly_mean_meters": [fut_month_values.get(month) for month in range(1, 13)],
            },
        }


netcdf_reader = NetcdfReader()
