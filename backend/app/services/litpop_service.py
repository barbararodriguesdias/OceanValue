from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

import numpy as np


@dataclass
class PopulationResult:
    total_population: int
    affected_population: int
    source: str
    note: Optional[str] = None


class LitPopPopulationService:
    """Population metrics using CLIMADA LitPop with graceful fallback."""

    def __init__(self) -> None:
        self._litpop = None
        self._load_error: Optional[str] = None

    def _load_litpop(self):
        if self._litpop is not None:
            return self._litpop

        try:
            from climada.entity import LitPop  # type: ignore

            self._litpop = LitPop
            return self._litpop
        except Exception as exc:  # pragma: no cover - depends on runtime env
            self._load_error = str(exc)
            return None

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: np.ndarray, lon2: np.ndarray) -> np.ndarray:
        earth_radius_km = 6371.0
        lat1_rad = np.radians(lat1)
        lon1_rad = np.radians(lon1)
        lat2_rad = np.radians(lat2)
        lon2_rad = np.radians(lon2)

        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad

        a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2.0) ** 2
        c = 2.0 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
        return earth_radius_km * c

    def _compute_litpop_population(
        self,
        lat: float,
        lon: float,
        stop_ratio: float,
        radius_km: float = 50.0,
    ) -> PopulationResult:
        LitPop = self._load_litpop()
        if LitPop is None:
            raise RuntimeError(self._load_error or "LitPop indisponível")

        exposure = LitPop.from_countries(
            countries=["BRA"],
            res_arcsec=300,
            exponents=(0, 1),
            fin_mode="pc",
            reference_year=2020,
        )

        gdf = exposure.gdf
        if gdf is None or gdf.empty:
            return PopulationResult(total_population=0, affected_population=0, source="litpop", note="Sem dados LitPop para o ponto.")

        lat_values = np.asarray(gdf.geometry.y, dtype=float)
        lon_values = np.asarray(gdf.geometry.x, dtype=float)
        pop_values = np.asarray(gdf["value"], dtype=float)

        finite_mask = np.isfinite(lat_values) & np.isfinite(lon_values) & np.isfinite(pop_values)
        if not np.any(finite_mask):
            return PopulationResult(total_population=0, affected_population=0, source="litpop", note="Sem valores válidos no LitPop.")

        lat_values = lat_values[finite_mask]
        lon_values = lon_values[finite_mask]
        pop_values = np.maximum(pop_values[finite_mask], 0.0)

        distances = self._haversine_km(lat, lon, lat_values, lon_values)
        near_mask = distances <= float(max(radius_km, 1.0))

        if not np.any(near_mask):
            nearest_idx = int(np.argmin(distances))
            total_population = int(round(float(pop_values[nearest_idx])))
        else:
            total_population = int(round(float(np.nansum(pop_values[near_mask]))))

        affected_population = int(round(float(total_population) * float(np.clip(stop_ratio, 0.0, 1.0))))

        return PopulationResult(
            total_population=max(total_population, 0),
            affected_population=max(affected_population, 0),
            source="litpop",
        )

    def _compute_proxy_population(
        self,
        stop_ratio: float,
        exposure_reference: Optional[Dict],
    ) -> PopulationResult:
        exposure_points = (exposure_reference or {}).get("exposure_points") or {}
        n_points = len(exposure_points.get("value", []))
        total_population = int(max(n_points, 50) * 120)
        affected_population = int(round(total_population * float(np.clip(stop_ratio, 0.0, 1.0))))
        return PopulationResult(
            total_population=total_population,
            affected_population=affected_population,
            source="proxy",
            note="LitPop indisponível no ambiente atual; usando estimativa proxy baseada na malha de exposição.",
        )

    def compute_population_metrics(
        self,
        *,
        lat: float,
        lon: float,
        stop_ratio: float,
        exposure_reference: Optional[Dict] = None,
        state_name: Optional[str] = None,
    ) -> Dict:
        try:
            result = self._compute_litpop_population(lat=lat, lon=lon, stop_ratio=stop_ratio)
            payload = {
                "total_population": result.total_population,
                "affected_population": result.affected_population,
                "population_source": result.source,
            }
            if state_name:
                payload["population_scope"] = {
                    "country": "Brazil",
                    "state_filter_requested": state_name,
                    "state_filter_applied": False,
                }
            if result.note:
                payload["population_note"] = result.note
            return payload
        except Exception:
            proxy = self._compute_proxy_population(
                stop_ratio=stop_ratio,
                exposure_reference=exposure_reference,
            )
            payload = {
                "total_population": proxy.total_population,
                "affected_population": proxy.affected_population,
                "population_source": proxy.source,
            }
            if state_name:
                payload["population_scope"] = {
                    "country": "Brazil",
                    "state_filter_requested": state_name,
                    "state_filter_applied": False,
                }
            if proxy.note:
                payload["population_note"] = proxy.note
            return payload


litpop_population_service = LitPopPopulationService()
