"""Service for CMEMS current data via Copernicus Marine Toolbox."""

from __future__ import annotations

import os
import time
from typing import Optional, Dict

import numpy as np
import xarray as xr

try:
    import copernicusmarine  # type: ignore
except Exception as exc:  # pragma: no cover - optional dependency
    copernicusmarine = None


class CmemsCurrentReader:
    """Read CMEMS current data without local storage."""

    def __init__(self) -> None:
        self.dataset_id = os.getenv(
            "CMEMS_DATASET_ID",
            "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
        )
        self.username = os.getenv("CMEMS_USERNAME")
        self.password = os.getenv("CMEMS_PASSWORD")
        self.u_var = os.getenv("CMEMS_U_VAR", "uo")
        self.v_var = os.getenv("CMEMS_V_VAR", "vo")
        self.cache_ttl = int(os.getenv("CMEMS_CACHE_TTL_SECONDS", "300"))
        self.downsample_target = int(os.getenv("CMEMS_DOWNSAMPLE_TARGET", "2500"))
        self._ds: Optional[xr.Dataset] = None
        self._cache: Dict[str, Dict[str, object]] = {}

    def _open_dataset(self) -> xr.Dataset:
        if self._ds is not None:
            return self._ds

        if copernicusmarine is None:
            raise RuntimeError("copernicusmarine não está instalado")

        if not self.username or not self.password:
            raise RuntimeError("CMEMS_USERNAME/CMEMS_PASSWORD não configurados")

        self._ds = copernicusmarine.open_dataset(
            dataset_id=self.dataset_id,
            username=self.username,
            password=self.password,
        )

        return self._ds

    @staticmethod
    def _find_coord(ds: xr.Dataset, candidates: list[str]) -> str:
        for name in candidates:
            if name in ds.coords:
                return name
        raise KeyError(f"Nenhuma coordenada encontrada entre: {candidates}")

    def get_current_snapshot(
        self,
        time: str,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
    ) -> Dict:
        cache_key = f"{self.dataset_id}|{time}|{lat_min}|{lat_max}|{lon_min}|{lon_max}"
        cached = self._cache.get(cache_key)
        if cached and (time.time() - float(cached["ts"]) < self.cache_ttl):
            return cached["data"]  # type: ignore[return-value]

        ds = self._open_dataset()

        lat_name = self._find_coord(ds, ["lat", "latitude", "y"])
        lon_name = self._find_coord(ds, ["lon", "longitude", "x"])
        time_name = self._find_coord(ds, ["time", "t"])

        data_u = ds[self.u_var]
        data_v = ds[self.v_var]

        data_u = data_u.sel({time_name: time}, method="nearest")
        data_v = data_v.sel({time_name: time}, method="nearest")

        if lat_min is not None or lat_max is not None:
            if lat_min is None:
                lat_min = float(data_u[lat_name].min().values)
            if lat_max is None:
                lat_max = float(data_u[lat_name].max().values)
            data_u = data_u.sel({lat_name: slice(lat_min, lat_max)})
            data_v = data_v.sel({lat_name: slice(lat_min, lat_max)})

        if lon_min is not None or lon_max is not None:
            if lon_min is None:
                lon_min = float(data_u[lon_name].min().values)
            if lon_max is None:
                lon_max = float(data_u[lon_name].max().values)
            data_u = data_u.sel({lon_name: slice(lon_min, lon_max)})
            data_v = data_v.sel({lon_name: slice(lon_min, lon_max)})

        data_u = data_u.load()
        data_v = data_v.load()

        speed = np.sqrt(np.square(data_u.values) + np.square(data_v.values))

        lat_values = data_u[lat_name].values
        lon_values = data_u[lon_name].values

        total_points = lat_values.size * lon_values.size
        step = max(1, int(np.ceil(np.sqrt(total_points / max(self.downsample_target, 1)))))

        if step > 1:
            lat_values = lat_values[::step]
            lon_values = lon_values[::step]
            speed = speed[::step, ::step]

        payload = {
            "lat": lat_values.tolist(),
            "lon": lon_values.tolist(),
            "values": speed.tolist(),
            "time": str(data_u[time_name].values),
        }

        self._cache[cache_key] = {
            "ts": time.time(),
            "data": payload,
        }

        return payload


cmems_current_reader = CmemsCurrentReader()
