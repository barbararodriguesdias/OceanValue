from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import xarray as xr
from scipy import sparse

from climada.engine import Impact, ImpactCalc
from climada.entity import Exposures, ImpactFunc, ImpactFuncSet
from climada.hazard.base import Hazard
from climada.hazard.centroids import Centroids

from .climada_petals import climada_petals_engine
from .netcdf_reader import netcdf_reader
from .oceanpact_data_reader import get_netcdf_series, find_netcdf_file


@dataclass
class HazardConfig:
    name: str
    code: str
    unit: str


@dataclass
class AssetVulnerabilityProfile:
    wind_operational_max: float
    wind_attention_max: float
    wave_operational_max: float
    wave_attention_max: float
    wind_attention_loss_factor: float
    wind_stop_loss_factor: float
    wave_attention_loss_factor: float
    wave_stop_loss_factor: float


class ClimadaWindWaveService:
    _CONFIG: Dict[str, HazardConfig] = {
        "wind": HazardConfig(name="wind", code="WND", unit="knots"),
        "wave": HazardConfig(name="wave", code="WAV", unit="m"),
    }

    _ASSET_PROFILES: Dict[str, AssetVulnerabilityProfile] = {
        "platform": AssetVulnerabilityProfile(
            wind_operational_max=15.0,
            wind_attention_max=20.0,
            wave_operational_max=2.0,
            wave_attention_max=4.0,
            wind_attention_loss_factor=0.28,
            wind_stop_loss_factor=0.85,
            wave_attention_loss_factor=0.34,
            wave_stop_loss_factor=0.95,
        ),
        "fpso": AssetVulnerabilityProfile(
            wind_operational_max=18.0,
            wind_attention_max=24.0,
            wave_operational_max=2.8,
            wave_attention_max=4.8,
            wind_attention_loss_factor=0.24,
            wind_stop_loss_factor=0.75,
            wave_attention_loss_factor=0.3,
            wave_stop_loss_factor=0.88,
        ),
        "subsea": AssetVulnerabilityProfile(
            wind_operational_max=22.0,
            wind_attention_max=28.0,
            wave_operational_max=3.5,
            wave_attention_max=5.8,
            wind_attention_loss_factor=0.16,
            wind_stop_loss_factor=0.58,
            wave_attention_loss_factor=0.2,
            wave_stop_loss_factor=0.66,
        ),
        "windfarm": AssetVulnerabilityProfile(
            wind_operational_max=14.0,
            wind_attention_max=19.0,
            wave_operational_max=2.2,
            wave_attention_max=3.8,
            wind_attention_loss_factor=0.32,
            wind_stop_loss_factor=0.92,
            wave_attention_loss_factor=0.3,
            wave_stop_loss_factor=0.85,
        ),
        "port": AssetVulnerabilityProfile(
            wind_operational_max=13.0,
            wind_attention_max=18.0,
            wave_operational_max=1.8,
            wave_attention_max=3.2,
            wind_attention_loss_factor=0.3,
            wind_stop_loss_factor=0.9,
            wave_attention_loss_factor=0.34,
            wave_stop_loss_factor=0.9,
        ),
        "infrastructure": AssetVulnerabilityProfile(
            wind_operational_max=16.0,
            wind_attention_max=22.0,
            wave_operational_max=2.4,
            wave_attention_max=4.2,
            wind_attention_loss_factor=0.26,
            wind_stop_loss_factor=0.82,
            wave_attention_loss_factor=0.28,
            wave_stop_loss_factor=0.82,
        ),
        "industrial": AssetVulnerabilityProfile(
            wind_operational_max=15.0,
            wind_attention_max=21.0,
            wave_operational_max=2.2,
            wave_attention_max=4.0,
            wind_attention_loss_factor=0.29,
            wind_stop_loss_factor=0.86,
            wave_attention_loss_factor=0.3,
            wave_stop_loss_factor=0.86,
        ),
        "population": AssetVulnerabilityProfile(
            wind_operational_max=14.0,
            wind_attention_max=19.0,
            wave_operational_max=1.7,
            wave_attention_max=3.0,
            wind_attention_loss_factor=0.35,
            wind_stop_loss_factor=1.0,
            wave_attention_loss_factor=0.4,
            wave_stop_loss_factor=1.0,
        ),
    }

    def get_asset_profile(self, asset_type: Optional[str]) -> AssetVulnerabilityProfile:
        key = str(asset_type or "platform").strip().lower()
        return self._ASSET_PROFILES.get(key, self._ASSET_PROFILES["platform"])

    @staticmethod
    def _exceedance_probs(n: int, method: str = "weibull") -> np.ndarray:
        if n <= 0:
            return np.array([], dtype=float)
        rank = np.arange(1, n + 1, dtype=float)
        m = (method or "weibull").lower()
        if m == "weibull":
            return rank / (n + 1)
        elif m == "gringorten":
            return (rank - 0.44) / (n + 0.12)
        elif m == "cunnane":
            return (rank - 0.4) / (n + 0.2)
        else:
            return rank / (n + 1)

        # ...existing code for response (sanitized block remains)...

    @staticmethod
    def _to_serializable(obj):
        """Recursively cast numpy/scalars to JSON-friendly types."""
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.generic,)):
            return obj.item()
        if isinstance(obj, dict):
            return {k: ClimadaWindWaveService._to_serializable(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [ClimadaWindWaveService._to_serializable(v) for v in obj]
        return obj
    @staticmethod
    def _build_exposures(lat: float, lon: float, asset_value: float, haz_code: str) -> Exposures:
        impf_column = f"impf_{haz_code}"
        frame = pd.DataFrame(
            {
                "latitude": [float(lat)],
                "longitude": [float(lon)],
                "value": [float(max(asset_value, 0.0))],
                impf_column: [1],
            }
        )
        exposures = Exposures(frame)
        exposures.check()
        return exposures

    def _build_impact_func_set(
        self,
        *,
        haz_code: str,
        unit: str,
        operational_max: float,
        attention_max: float,
        attention_loss_factor: float,
        stop_loss_factor: float,
    ) -> ImpactFuncSet:
        op = float(max(0.0, operational_max))
        att = float(max(op + 1e-6, attention_max))
        upper = float(max(att + 1e-6, att * 1.6))

        attention_factor = float(np.clip(attention_loss_factor, 0.0, 1.0))
        stop_factor = float(np.clip(max(stop_loss_factor, attention_factor), 0.0, 1.0))

        impact_func = ImpactFunc(
            haz_type=haz_code,
            id=1,
            name=f"{haz_code}-operational-threshold",
            intensity=np.array([0.0, op, att, upper], dtype=float),
            mdd=np.array([0.0, 0.0, attention_factor, stop_factor], dtype=float),
            paa=np.array([1.0, 1.0, 1.0, 1.0], dtype=float),
            intensity_unit=unit,
        )

        impf_set = ImpactFuncSet()
        impf_set.append(impact_func)
        impf_set.check()
        return impf_set

    @staticmethod
    def _impact_summary(
        impact: Impact,
        *,
        risk_quantile: float,
        annualization: float,
        risk_load_method: str,
        expense_ratio: float,
    ) -> Dict[str, float | Dict]:
        at_event = np.asarray(impact.at_event, dtype=float)
        clean_events = at_event[np.isfinite(at_event)]
        if clean_events.size == 0:
            clean_events = np.array([0.0], dtype=float)

        frequency = np.asarray(getattr(impact, "frequency", np.array([], dtype=float)), dtype=float)
        frequency = frequency[np.isfinite(frequency)]

        aal_raw = float(getattr(impact, "aai_agg", np.nan))
        if not np.isfinite(aal_raw) or aal_raw <= 0.0:
            if frequency.size == clean_events.size and frequency.size > 0:
                aal_raw = float(np.sum(clean_events * frequency))
            else:
                aal_raw = float(np.mean(clean_events)) * float(max(annualization, 1e-9))

        quantile = float(np.clip(risk_quantile, 0.5, 0.999))
        return_period = 1.0 / float(max(1e-6, 1.0 - quantile))

        var_q = 0.0
        try:
            curve_rp = impact.calc_freq_curve(return_per=[return_period])
            var_q = float(np.asarray(curve_rp.impact, dtype=float)[0])
        except Exception as exc:
            import logging
            logging.error(f"Erro ao calcular VaR: {exc}")
            var_q = 0.0
            raise ValueError(f"Erro ao calcular VaR: {exc}")
        if not np.isfinite(var_q) or var_q <= 0.0:
            var_q = float(np.nanquantile(clean_events, quantile))

        threshold = float(np.nanquantile(clean_events, quantile))
        tail = clean_events[clean_events >= threshold]
        tvar_q = float(np.nanmean(tail)) if tail.size else threshold

        pricing = climada_petals_engine.compute_pricing(
            loss_per_step=clean_events,
            annualization=float(max(annualization, 1e-9)),
            risk_quantile=quantile,
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
        )

        return {
            "aal": float(aal_raw),
            "pml": float(np.nanmax(clean_events)) if clean_events.size else 0.0,
            "var": float(var_q),
            "tvar": float(tvar_q),
            # ...removed duplicate/old pricing_models block...
        }

    def _compute_single_hazard(
        self,
        *,
        hazard_name: str,
        series: xr.DataArray,
        lat: float,
        lon: float,
        asset_value: float,
        annualization: float,
        operational_max: float,
        attention_max: float,
        hazard_attention_loss_factor: float,
        hazard_stop_loss_factor: float,
        exceedance_method: str,
        risk_quantile: float,
        risk_load_method: str,
        expense_ratio: float,
    ) -> Dict:
        cfg = self._CONFIG[hazard_name]
        values = np.asarray(series.values, dtype=float)
        clean = values[np.isfinite(values)]
        if clean.size == 0:
            clean = np.array([0.0], dtype=float)

        # Build hazard/exposure/vulnerability using CLIMADA classes
        from climada.hazard import Hazard, Centroids
        from scipy.sparse import csr_matrix

        n_events = int(clean.size)

        # Estimate event spacing from the time coordinate to derive per-event frequency
        spacing_hours = 1.0
        if "time" in series.coords and series["time"].size >= 2:
            time_vals = pd.to_datetime(series["time"].values)
            diffs = pd.Series(time_vals).diff().dropna().dt.total_seconds() / 3600.0
            if not diffs.empty and np.isfinite(diffs.median()):
                spacing_hours = float(max(diffs.median(), 1e-6))

        total_hours = float(max(spacing_hours * max(n_events, 1), 1e-6))
        annualization = float(8760.0 / total_hours) if annualization <= 0 else float(annualization)
        per_event_frequency = float(max(annualization, 1e-9)) / max(n_events, 1)

        hazard = Hazard()
        hazard.haz_type = cfg.code
        # CLIMADA expects intensity matrix shaped (n_event, n_centroid); we have 1 centroid.
        hazard.intensity = csr_matrix(clean.reshape(n_events, 1))
        hazard.frequency = np.full(n_events, per_event_frequency, dtype=float)
        hazard.event_id = np.arange(1, n_events + 1, dtype=int)
        hazard.event_name = np.array([f"event_{i}" for i in range(1, n_events + 1)], dtype=object)
        hazard.date = np.arange(n_events, dtype=int)
        hazard.units = cfg.unit
        hazard.centroids = Centroids.from_lat_lon([float(lat)], [float(lon)])

        exposures = self._build_exposures(lat=lat, lon=lon, asset_value=asset_value, haz_code=cfg.code)
        impf_set = self._build_impact_func_set(
            haz_code=cfg.code,
            unit=cfg.unit,
            operational_max=operational_max,
            attention_max=attention_max,
            attention_loss_factor=hazard_attention_loss_factor,
            stop_loss_factor=hazard_stop_loss_factor,
        )

        # Run native CLIMADA impact; if flat/invalid, rebuild per-event losses from AAL to avoid zeroed outputs
        impact = ImpactCalc(exposures, impf_set, hazard).impact(save_mat=False, assign_centroids=True)
        raw_at_event = np.asarray(getattr(impact, "at_event", np.array([], dtype=float)), dtype=float)

        # Use CLIMADA frequency when present; otherwise derive evenly across events
        frequency = np.asarray(getattr(impact, "frequency", np.zeros(n_events)), dtype=float)
        if not np.isfinite(frequency).any():
            frequency = np.full(n_events, per_event_frequency, dtype=float)

        max_raw = float(np.nanmax(raw_at_event)) if raw_at_event.size else 0.0
        min_raw = float(np.nanmin(raw_at_event)) if raw_at_event.size else 0.0
        spread_raw = max_raw - min_raw
        is_flat = (
            raw_at_event.size == 0
            or not np.isfinite(raw_at_event).any()
            or max_raw <= 0.0
            or spread_raw <= max(1e-6, 1e-6 * max_raw)
        )
        flat_warning = None
        if is_flat:
            flat_warning = (
                f"CLIMADA impact returned flat/invalid results for {hazard_name}. "
                "Rebuilt per-event losses from intensity thresholds to restore variability; check units/thresholds."
            )

            # Manual loss curve (same breakpoints as ImpactFunc) to reintroduce variability
            stop_max = float(max(attention_max + 1e-6, attention_max * 1.6))
            intensity_vals = clean
            mdd = np.zeros_like(intensity_vals, dtype=float)
            # attention to stop: linear ramp
            mid_mask = (intensity_vals >= attention_max) & (intensity_vals < stop_max)
            if np.any(mid_mask):
                mdd[mid_mask] = hazard_attention_loss_factor + (
                    (hazard_stop_loss_factor - hazard_attention_loss_factor)
                    * (intensity_vals[mid_mask] - attention_max)
                    / max(stop_max - attention_max, 1e-6)
                )
            # stop or above
            mdd[intensity_vals >= stop_max] = hazard_stop_loss_factor
            # below attention stays zero

            rebuilt_losses = float(max(asset_value, 0.0)) * mdd
            impact.at_event = np.asarray(rebuilt_losses, dtype=float)
            raw_at_event = impact.at_event

        # Normalize frequency to annualization/n_events to keep AAL consistent
        impact.frequency = np.asarray(frequency, dtype=float)
        impact.aai_agg = float(np.sum(np.asarray(impact.at_event, dtype=float) * np.asarray(impact.frequency, dtype=float)))

        logger = __import__("logging").getLogger(__name__)
        logger.info(
            "Impacto calculado | hazard=%s at_event_max=%s at_event_min=%s aai_agg=%s freq_len=%s fallback=%s",
            hazard_name,
            float(np.nanmax(raw_at_event)) if raw_at_event.size else 0.0,
            float(np.nanmin(raw_at_event)) if raw_at_event.size else 0.0,
            getattr(impact, "aai_agg", None),
            len(getattr(impact, "frequency", [])),
            False,
        )

        status = np.zeros(clean.size, dtype=np.uint8)
        status[(clean >= operational_max) & (clean < attention_max)] = 1
        status[clean >= attention_max] = 2

        counts, bin_edges = np.histogram(clean, bins=20)
        bin_centers = 0.5 * (bin_edges[1:] + bin_edges[:-1])

        # Loss-based exceedance curve per hazard
        loss_values = np.asarray(impact.at_event, dtype=float)
        loss_freq = np.asarray(impact.frequency, dtype=float)
        mask = np.isfinite(loss_values)
        if mask.any():
            sort_idx = np.argsort(loss_values[mask])[::-1]
            sorted_losses = loss_values[mask][sort_idx]
            sorted_freq = loss_freq[mask][sort_idx] if loss_freq.size == loss_values.size else np.zeros_like(sorted_losses)
            cum = np.cumsum(sorted_freq)
            total = float(np.sum(sorted_freq)) if np.isfinite(sorted_freq).any() else 0.0
            if total <= 0.0:
                exceedance = self._exceedance_probs(sorted_losses.size, exceedance_method)
            else:
                exceedance = 1.0 - np.clip(cum / total, 0.0, 1.0)
            exceedance_vals = sorted_losses.tolist()
            exceedance_probs = np.asarray(exceedance, dtype=float).tolist()
        else:
            exceedance_vals = []
            exceedance_probs = []

        pricing_summary = self._impact_summary(
            impact,
            risk_quantile=risk_quantile,
            annualization=float(annualization),
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
        )
        pml_value = float(pricing_summary.get("pml", 0.0))
        return_curve = impact.calc_freq_curve(return_per=[2, 5, 10, 20, 50, 100])

        return {
            "hazard": hazard_name,
            "hazard_code": cfg.code,
            "units": cfg.unit,
            "status": status,
            "at_event": np.asarray(impact.at_event, dtype=float),
            "frequency": np.asarray(impact.frequency, dtype=float),
            "operational_max": float(operational_max),
            "attention_max": float(attention_max),
            "attention_loss_factor": float(hazard_attention_loss_factor),
            "stop_loss_factor": float(hazard_stop_loss_factor),
            "flat_warning": flat_warning,
            "curve_definition": {
                "intensity": [
                    0.0,
                    float(operational_max),
                    float(attention_max),
                    float(max(attention_max + 1e-6, attention_max * 1.6)),
                ],
                "mdd": [
                    0.0,
                    0.0,
                    float(hazard_attention_loss_factor),
                    float(hazard_stop_loss_factor),
                ],
                "paa": [1.0, 1.0, 1.0, 1.0],
            },
            "metrics": {
                "mean": float(np.nanmean(clean)),
                "max": float(np.nanmax(clean)),
                "p50": float(np.nanpercentile(clean, 50)),
                "p90": float(np.nanpercentile(clean, 90)),
                "p95": float(np.nanpercentile(clean, 95)),
                "p99": float(np.nanpercentile(clean, 99)),
                "operational_hours": int(np.sum(status == 0)),
                "attention_hours": int(np.sum(status == 1)),
                "stop_hours": int(np.sum(status == 2)),
            },
            "pricing": pricing_summary,
            "pml": pml_value,
            "charts": {
                "hist_bins": bin_centers.tolist(),
                "hist_counts": counts.astype(int).tolist(),
                "exceedance_values": exceedance_vals,
                "exceedance_probs": exceedance_probs,
                "return_period": [float(v) for v in return_curve.return_per],
                "impact": [float(v) for v in np.asarray(return_curve.impact, dtype=float)],
            },
        }

    def _build_combined_impact(
        self,
        *,
        at_event_by_hazard: Dict[str, np.ndarray],
        frequency_by_hazard: Dict[str, np.ndarray],
        annualization: float,
        risk_quantile: float,
        risk_load_method: str,
        expense_ratio: float,
    ) -> Dict:
        if not at_event_by_hazard:
            return {
                "at_event": np.array([0.0], dtype=float),
                "frequency": np.array([annualization], dtype=float),
                "pricing": {
                    "aal": 0.0,
                    "pml": 0.0,
                    "var": 0.0,
                    "tvar": 0.0,
                    "risk_load": 0.0,
                    "pure_premium": 0.0,
                    "technical_premium": 0.0,
                    "petals_appendix": {},
                },
                "return_period": [2.0, 5.0, 10.0, 20.0, 50.0, 100.0],
                "impact_curve": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            }

        hazard_arrays = list(at_event_by_hazard.values())
        base_n = min(arr.size for arr in hazard_arrays)
        stacked_losses = np.vstack([arr[:base_n] for arr in hazard_arrays])
        stacked_freq = np.vstack([
            np.asarray(frequency_by_hazard.get(name, np.zeros_like(arr)), dtype=float)[:base_n]
            for name, arr in at_event_by_hazard.items()
        ])

        combined_at_event = np.sum(stacked_losses, axis=0)
        combined_frequency = np.sum(stacked_freq, axis=0)
        if not np.isfinite(combined_frequency).any():
            combined_frequency = np.full(base_n, float(max(annualization, 1e-9)) / max(base_n, 1), dtype=float)

        combined_impact = Impact()
        combined_impact.at_event = np.asarray(combined_at_event, dtype=float)
        combined_impact.frequency = np.asarray(combined_frequency, dtype=float)
        combined_impact.event_id = np.arange(1, base_n + 1, dtype=int)
        combined_impact.date = np.arange(737000, 737000 + base_n, dtype=int)
        combined_impact.unit = "BRL"

        pricing = self._impact_summary(
            combined_impact,
            risk_quantile=risk_quantile,
            annualization=annualization,
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
        )
        return_curve = combined_impact.calc_freq_curve(return_per=[2, 5, 10, 20, 50, 100])

        return {
            "at_event": combined_at_event,
            "frequency": np.asarray(combined_impact.frequency, dtype=float),
            "pricing": pricing,
            "return_period": [float(v) for v in return_curve.return_per],
            "impact_curve": [float(v) for v in np.asarray(return_curve.impact, dtype=float)],
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
    def _classify_counts(values: np.ndarray, operational_max: float, attention_max: float) -> Tuple[int, int, int]:
        clean = np.asarray(values, dtype=float)
        clean = clean[np.isfinite(clean)]
        if clean.size == 0:
            return 0, 0, 0

        stop = int(np.sum(clean >= attention_max))
        attention = int(np.sum((clean >= operational_max) & (clean < attention_max)))
        operational = int(np.sum(clean < operational_max))
        return operational, attention, stop

    def _load_wind_period_series(
        self,
        *,
        lat: float,
        lon: float,
        stat: str,
        start_year: int,
        end_year: int,
        source: str,
        scenario: str,
    ) -> xr.DataArray:
        if source == "historical":
            path = netcdf_reader.paths.wind_hist_max if stat == "max" else netcdf_reader.paths.wind_hist_mean
        else:
            path = netcdf_reader._pick_wind_future_path(scenario, stat)

        ds = netcdf_reader._open(path)
        time_name = netcdf_reader._find_coord(ds, ["time", "t"])
        lat_name = netcdf_reader._find_coord(ds, ["lat", "latitude", "y"])
        lon_name = netcdf_reader._find_coord(ds, ["lon", "longitude", "x"])
        # Suporta variáveis corrigidas e máx: preferir sfcWindmax_corr -> sfcWindmax -> sfcWind_corr -> sfcWind
        candidates = [
            "sfcWindmax_corr",
            "sfcWindmax",
            "sfcWind_corr",
            "sfcWind",
        ]
        var_name = next((v for v in candidates if v in ds.data_vars), None)
        if var_name is None:
            raise ValueError(f"Nenhuma variável de vento encontrada no dataset. Disponíveis: {list(ds.data_vars)}")

        point = ds[var_name].sel({lat_name: lat, lon_name: lon}, method="nearest")
        mask = (point[time_name].dt.year >= start_year) & (point[time_name].dt.year <= end_year)
        filtered = point.where(mask, drop=True).load()

        to_knots = 1.9438444924406
        values_knots = np.asarray(filtered.values, dtype=float) * to_knots
        return xr.DataArray(values_knots, coords={"time": filtered[time_name].values}, dims=["time"])

    def _load_wave_period_series(
        self,
        *,
        lat: float,
        lon: float,
        stat: str,
        start_year: int,
        end_year: int,
        source: str,
    ) -> xr.DataArray:
        filtered = netcdf_reader._load_wave_point_period(
            lat=lat,
            lon=lon,
            stat=stat,
            start_year=start_year,
            end_year=end_year,
            source=source,
        )
        values_meters = np.asarray(filtered.values, dtype=float)
        return xr.DataArray(values_meters, coords={"time": filtered["time"].values}, dims=["time"])

    def get_scenario_comparison(
        self,
        *,
        hazard_name: str,
        lat: float,
        lon: float,
        scenario: str,
        stat: str,
        historical_period: str,
        future_period: str,
        operational_max: float,
        attention_max: float,
        asset_value: float = 1.0,
        attention_loss_factor: float = 0.35,
        stop_loss_factor: float = 1.0,
        risk_quantile: float = 0.95,
        risk_load_method: str = "none",
        expense_ratio: float = 0.15,
    ) -> Dict:
        if hazard_name not in self._CONFIG:
            raise ValueError("Hazard inválido. Use 'wind' ou 'wave'.")
        if stat not in {"mean", "max"}:
            raise ValueError("Parâmetro stat inválido. Use 'mean' ou 'max'.")

        hist_start, hist_end = self._period_to_years(historical_period)
        fut_start, fut_end = self._period_to_years(future_period)

        if hazard_name == "wind":
            historical = self._load_wind_period_series(
                lat=lat,
                lon=lon,
                stat=stat,
                start_year=hist_start,
                end_year=hist_end,
                source="historical",
                scenario=scenario,
            )
            future = self._load_wind_period_series(
                lat=lat,
                lon=lon,
                stat=stat,
                start_year=fut_start,
                end_year=fut_end,
                source="future",
                scenario=scenario,
            )
            metric_key_mean = "mean_knots"
            metric_key_p95 = "p95_knots"
            metric_key_max = "max_knots"
        else:
            historical = self._load_wave_period_series(
                lat=lat,
                lon=lon,
                stat=stat,
                start_year=hist_start,
                end_year=hist_end,
                source="historical",
            )
            future = self._load_wave_period_series(
                lat=lat,
                lon=lon,
                stat=stat,
                start_year=fut_start,
                end_year=fut_end,
                source="future",
            )
            metric_key_mean = "mean_meters"
            metric_key_p95 = "p95_meters"
            metric_key_max = "max_meters"

        profile = self.get_asset_profile("platform")
        if hazard_name == "wind":
            profile_attention_factor = profile.wind_attention_loss_factor
            profile_stop_factor = profile.wind_stop_loss_factor
        else:
            profile_attention_factor = profile.wave_attention_loss_factor
            profile_stop_factor = profile.wave_stop_loss_factor

        hazard_attention_factor = max(float(attention_loss_factor), float(profile_attention_factor))
        hazard_stop_factor = max(float(stop_loss_factor), float(profile_stop_factor), hazard_attention_factor)

        hist_annualization = 8760.0 / max(float(historical.size), 1.0)
        fut_annualization = 8760.0 / max(float(future.size), 1.0)

        hist_result = self._compute_single_hazard(
            hazard_name=hazard_name,
            series=historical,
            lat=lat,
            lon=lon,
            asset_value=float(max(asset_value, 1e-6)),
            annualization=hist_annualization,
            operational_max=operational_max,
            attention_max=attention_max,
            hazard_attention_loss_factor=hazard_attention_factor,
            hazard_stop_loss_factor=hazard_stop_factor,
            exceedance_method="weibull",
            risk_quantile=risk_quantile,
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
        )
        fut_result = self._compute_single_hazard(
            hazard_name=hazard_name,
            series=future,
            lat=lat,
            lon=lon,
            asset_value=float(max(asset_value, 1e-6)),
            annualization=fut_annualization,
            operational_max=operational_max,
            attention_max=attention_max,
            hazard_attention_loss_factor=hazard_attention_factor,
            hazard_stop_loss_factor=hazard_stop_factor,
            exceedance_method="weibull",
            risk_quantile=risk_quantile,
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
        )

        hist_values = np.asarray(historical.values, dtype=float)
        fut_values = np.asarray(future.values, dtype=float)

        hist_min = float(np.nanmin(hist_values)) if hist_values.size else 0.0
        hist_mean = float(np.nanmean(hist_values)) if hist_values.size else 0.0
        hist_max = float(np.nanmax(hist_values)) if hist_values.size else 0.0
        fut_min = float(np.nanmin(fut_values)) if fut_values.size else 0.0
        fut_mean = float(np.nanmean(fut_values)) if fut_values.size else 0.0
        fut_max = float(np.nanmax(fut_values)) if fut_values.size else 0.0

        hist_operational, hist_attention, hist_stop = self._classify_counts(
            hist_values, operational_max, attention_max
        )
        fut_operational, fut_attention, fut_stop = self._classify_counts(
            fut_values, operational_max, attention_max
        )

        hist_metrics = hist_result.get("metrics", {}) or {}
        fut_metrics = fut_result.get("metrics", {}) or {}

        hist_yearly = historical.groupby("time.year").mean(skipna=True)
        fut_yearly = future.groupby("time.year").mean(skipna=True)
        hist_monthly = historical.groupby("time.month").mean(skipna=True)
        fut_monthly = future.groupby("time.month").mean(skipna=True)

        def _monthly_quantiles(da: xr.DataArray) -> Dict[str, List[float]]:
            if da.size == 0 or "time" not in da.coords:
                return {"p50": [None] * 12, "p90": [None] * 12, "p95": [None] * 12, "p99": [None] * 12}
            quantiles = [0.5, 0.9, 0.95, 0.99]
            q_da = da.groupby("time.month").quantile(quantiles, skipna=True)
            out: Dict[str, List[float]] = {}
            for q, label in zip(quantiles, ["p50", "p90", "p95", "p99"]):
                vals = q_da.sel(quantile=q)
                month_vals = []
                for month in range(1, 13):
                    v = vals.sel(month=month).values.item() if month in vals["month"].values else np.nan
                    month_vals.append(float(v) if np.isfinite(v) else None)
                out[label] = month_vals
            return out

        hist_monthly_quant = _monthly_quantiles(historical)
        fut_monthly_quant = _monthly_quantiles(future)

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

        historical_payload = {
            "samples": int(hist_values[np.isfinite(hist_values)].size),
            metric_key_mean: float(hist_metrics.get("mean", 0.0)),
            ("min_knots" if hazard_name == "wind" else "min_meters"): hist_min,
            f"p90_{'knots' if hazard_name == 'wind' else 'meters'}": float(hist_metrics.get("p90", 0.0)),
            metric_key_p95: float(hist_metrics.get("p95", 0.0)),
            metric_key_max: float(hist_metrics.get("max", 0.0)),
            "operational_samples": int(hist_operational),
            "attention_samples": int(hist_attention),
            "stop_samples": int(hist_stop),
            "climada_impact": hist_result.get("pricing", {}),
        }
        future_payload = {
            "samples": int(fut_values[np.isfinite(fut_values)].size),
            metric_key_mean: float(fut_metrics.get("mean", 0.0)),
            ("min_knots" if hazard_name == "wind" else "min_meters"): fut_min,
            f"p90_{'knots' if hazard_name == 'wind' else 'meters'}": float(fut_metrics.get("p90", 0.0)),
            metric_key_p95: float(fut_metrics.get("p95", 0.0)),
            metric_key_max: float(fut_metrics.get("max", 0.0)),
            "operational_samples": int(fut_operational),
            "attention_samples": int(fut_attention),
            "stop_samples": int(fut_stop),
            "climada_impact": fut_result.get("pricing", {}),
        }

        response = {
            "meta": {
                "scenario": scenario.lower(),
                "stat": stat,
                "lat": float(lat),
                "lon": float(lon),
                "historical_period": historical_period,
                "future_period": future_period,
            },
            "historical": historical_payload,
            "future": future_payload,
            "delta": {
                metric_key_mean: float(future_payload[metric_key_mean] - historical_payload[metric_key_mean]),
                metric_key_p95: float(future_payload[metric_key_p95] - historical_payload[metric_key_p95]),
                "stop_samples": int(future_payload["stop_samples"] - historical_payload["stop_samples"]),
            },
            "series": {
                "historical_years": [int(v) for v in np.asarray(hist_yearly["year"].values, dtype=int).tolist()],
                f"historical_yearly_{'mean_knots' if hazard_name == 'wind' else 'mean_meters'}": [float(v) for v in np.asarray(hist_yearly.values, dtype=float).tolist()],
                "future_years": [int(v) for v in np.asarray(fut_yearly["year"].values, dtype=int).tolist()],
                f"future_yearly_{'mean_knots' if hazard_name == 'wind' else 'mean_meters'}": [float(v) for v in np.asarray(fut_yearly.values, dtype=float).tolist()],
                "monthly_labels": [f"{month:02d}" for month in range(1, 13)],
                f"historical_monthly_{'mean_knots' if hazard_name == 'wind' else 'mean_meters'}": [hist_month_values.get(month) for month in range(1, 13)],
                f"future_monthly_{'mean_knots' if hazard_name == 'wind' else 'mean_meters'}": [fut_month_values.get(month) for month in range(1, 13)],
                "historical_time": historical["time"].values.astype(str).tolist() if "time" in historical.coords else [],
                "historical_values": hist_values[np.isfinite(hist_values)].astype(float).tolist(),
                "future_time": future["time"].values.astype(str).tolist() if "time" in future.coords else [],
                "future_values": fut_values[np.isfinite(fut_values)].astype(float).tolist(),
                "historical_monthly_quantiles": hist_monthly_quant,
                "future_monthly_quantiles": fut_monthly_quant,
            },
            "climada_graphs": {
                "historical_return_period_curve": {
                    "return_period": hist_result.get("charts", {}).get("return_period", []),
                    "impact": hist_result.get("charts", {}).get("impact", []),
                },
                "future_return_period_curve": {
                    "return_period": fut_result.get("charts", {}).get("return_period", []),
                    "impact": fut_result.get("charts", {}).get("impact", []),
                },
                "historical_loss_exceedance_curve": {
                    "probability": hist_result.get("charts", {}).get("exceedance_probs", []),
                    "loss": hist_result.get("charts", {}).get("exceedance_values", []),
                },
                "future_loss_exceedance_curve": {
                    "probability": fut_result.get("charts", {}).get("exceedance_probs", []),
                    "loss": fut_result.get("charts", {}).get("exceedance_values", []),
                },
            },
            "pricing_engine": "climada",
            "petals_enabled": True,
        }

        # Monte Carlo uncertainty using CLIMADA path only
        mc_runs = 150
        aal_samples: List[float] = []
        pml_samples: List[float] = []
        var_samples: List[float] = []
        tvar_samples: List[float] = []
        curve_samples: List[List[float]] = []
        return_period_axis: List[float] = []

        rng = np.random.default_rng()

        for _ in range(mc_runs):
            intensity_factor = float(np.clip(rng.lognormal(mean=0.0, sigma=0.1), 0.7, 1.4))
            freq_factor = float(np.clip(rng.lognormal(mean=0.0, sigma=0.2), 0.3, 3.0))
            threshold_factor = float(np.clip(rng.normal(loc=1.0, scale=0.1), 0.6, 1.4))

            op_adj = float(operational_max * threshold_factor)
            att_adj = float(attention_max * threshold_factor)
            series_adj = future * intensity_factor
            annual_adj = float(fut_annualization * freq_factor)

            res = self._compute_single_hazard(
                hazard_name=hazard_name,
                series=series_adj,
                lat=lat,
                lon=lon,
                asset_value=float(max(asset_value, 1e-6)),
                annualization=annual_adj,
                operational_max=op_adj,
                attention_max=att_adj,
                hazard_attention_loss_factor=hazard_attention_factor,
                hazard_stop_loss_factor=hazard_stop_factor,
                exceedance_method="weibull",
                risk_quantile=risk_quantile,
                risk_load_method=risk_load_method,
                expense_ratio=expense_ratio,
            )

            pricing_res = res.get("pricing", {}) or {}
            aal_samples.append(float(pricing_res.get("aal", 0.0)))
            pml_samples.append(float(pricing_res.get("pml", 0.0)))
            var_samples.append(float(pricing_res.get("var", 0.0)))
            tvar_samples.append(float(pricing_res.get("tvar", 0.0)))

            charts = res.get("charts", {}) or {}
            rp_axis = charts.get("return_period", [])
            impacts_axis = charts.get("impact", [])
            if return_period_axis and len(return_period_axis) != len(rp_axis):
                # Skip inconsistent axes to avoid mixing different shapes
                continue
            if not return_period_axis:
                return_period_axis = list(rp_axis)
            curve_samples.append([float(v) for v in impacts_axis])

        def _pct(arr: List[float], q: float) -> float:
            return float(np.nanpercentile(np.asarray(arr, dtype=float), q)) if arr else 0.0

        def _curve_pct(samples: List[List[float]], q: float) -> List[float]:
            if not samples or not return_period_axis:
                return []
            mat = np.asarray(samples, dtype=float)
            return [float(np.nanpercentile(mat[:, idx], q)) for idx in range(mat.shape[1])]

        response["uncertainty"] = {
            "parameters": {
                "intensity_factor": "lognormal mean=0 sigma=0.1 clipped [0.7,1.4]",
                "frequency_factor": "lognormal mean=0 sigma=0.2 clipped [0.3,3.0]",
                "threshold_factor": "normal mean=1 sigma=0.1 clipped [0.6,1.4]",
                "runs": mc_runs,
            },
            "future": {
                "aal": {"p05": _pct(aal_samples, 5), "p50": _pct(aal_samples, 50), "p95": _pct(aal_samples, 95)},
                "pml": {"p05": _pct(pml_samples, 5), "p50": _pct(pml_samples, 50), "p95": _pct(pml_samples, 95)},
                "var": {"p05": _pct(var_samples, 5), "p50": _pct(var_samples, 50), "p95": _pct(var_samples, 95)},
                "tvar": {"p05": _pct(tvar_samples, 5), "p50": _pct(tvar_samples, 50), "p95": _pct(tvar_samples, 95)},
                "return_period_curve": {
                    "return_period": return_period_axis,
                    "p05": _curve_pct(curve_samples, 5),
                    "p50": _curve_pct(curve_samples, 50),
                    "p95": _curve_pct(curve_samples, 95),
                },
            },
        }

        if hazard_name == "wind":
            response["meta"]["operational_max_knots"] = float(operational_max)
            response["meta"]["attention_max_knots"] = float(attention_max)
        else:
            response["meta"]["operational_max_meters"] = float(operational_max)
            response["meta"]["attention_max_meters"] = float(attention_max)

        return self._to_serializable(response)

    def analyze_point(
        self,
        *,
        lat: float,
        lon: float,
        asset_type: Optional[str],
        hazards: List[str],
        start_time: Optional[str],
        end_time: Optional[str],
        thresholds: Dict[str, Dict[str, float]],
        asset_value: float,
        attention_loss_factor: float,
        stop_loss_factor: float,
        exceedance_method: str,
        risk_quantile: float,
        risk_load_method: str,
        expense_ratio: float,
        region: str = "campos",
        period: str = "historico",
        stat: str = "max",
    ) -> Dict:
        import logging

        logger = logging.getLogger(__name__)
        selected_hazards = [h for h in hazards if h in self._CONFIG]
        if not selected_hazards:
            selected_hazards = ["wind"]

        profile = self.get_asset_profile(asset_type)

        hazard_map = {"wind": "vento", "wave": "onda"}

        series_map = {}
        for hazard in selected_hazards:
            hazard_key = hazard_map.get(hazard, hazard)

            # Escolhe estatística: vento máx (histórico/preditivo) e onda máx (histórica/preditiva) para risco
            # Se quisermos média, podemos expor via `stat`, mas aqui focamos em máx para risco operacional/parada
            stat = "max"

            if hazard == "wind":
                wind_values = netcdf_reader.get_wind_speed_series(
                    lat=lat,
                    lon=lon,
                    start_time=start_time,
                    end_time=end_time,
                    stat=stat,
                )
                time_index = np.arange(wind_values.size)
                series = xr.DataArray(wind_values, coords={"time": time_index}, dims=["time"], attrs={"units": "knots"})
            else:
                # Onda: carrega max (hist/pred) em metros
                wave_values = netcdf_reader.get_point_series(
                    variable="hs",
                    lat=lat,
                    lon=lon,
                    start_time=start_time,
                    end_time=end_time,
                    stat=stat,
                )
                time_index = np.arange(wave_values.size)
                series = xr.DataArray(wave_values, coords={"time": time_index}, dims=["time"], attrs={"units": "m"})

            series_map[hazard] = series
        logger.info(
            "Series carregadas", extra={
                "hazards": list(series_map.keys()),
                "region": region,
                "period": period,
                "lat": lat,
                "lon": lon,
            }
        )

        if not series_map:
            raise ValueError("Nenhuma série temporal NetCDF encontrada para os parâmetros informados.")

        # Alinhar as séries temporais (usando xarray)
        aligned = xr.align(*series_map.values(), join="inner")
        aligned_map = dict(zip(series_map.keys(), aligned))
        for name, da in aligned_map.items():
            stats_min = float(np.nanmin(da.values)) if da.size else None
            stats_max = float(np.nanmax(da.values)) if da.size else None
            stats_mean = float(np.nanmean(da.values)) if da.size else None
            logger.info(
                f"Série alinhada | hazard={name} dims={dict(da.sizes)} coords={list(da.coords)} "
                f"min={stats_min} max={stats_max} mean={stats_mean}")

        event_count = int(aligned[0].size) if aligned else 0
        total_hours = max(float(event_count), 1.0)
        annualization = 8760.0 / total_hours
        logger.info(
            f"Séries alinhadas - contagem de eventos={event_count} annualization={annualization}")

        hazard_out: Dict[str, Dict] = {}
        status_stack: List[np.ndarray] = []
        at_event_by_hazard: Dict[str, np.ndarray] = {}
        frequency_by_hazard: Dict[str, np.ndarray] = {}

        for hazard_name, data in aligned_map.items():
            cfg = self._CONFIG[hazard_name]
            hazard_limits = thresholds.get(hazard_name, {})
            if hazard_name == "wind":
                default_operational = profile.wind_operational_max
                default_attention = profile.wind_attention_max
                profile_attention_factor = profile.wind_attention_loss_factor
                profile_stop_factor = profile.wind_stop_loss_factor
            else:
                default_operational = profile.wave_operational_max
                default_attention = profile.wave_attention_max
                profile_attention_factor = profile.wave_attention_loss_factor
                profile_stop_factor = profile.wave_stop_loss_factor

            operational_max = float(hazard_limits.get("operational_max", default_operational))
            attention_max = float(hazard_limits.get("attention_max", default_attention))
            hazard_attention_factor = max(float(attention_loss_factor), float(profile_attention_factor))
            hazard_stop_factor = max(float(stop_loss_factor), float(profile_stop_factor), hazard_attention_factor)

            hazard_result = self._compute_single_hazard(
                hazard_name=hazard_name,
                series=data,
                lat=lat,
                lon=lon,
                asset_value=asset_value,
                annualization=annualization,
                operational_max=operational_max,
                attention_max=attention_max,
                hazard_attention_loss_factor=hazard_attention_factor,
                hazard_stop_loss_factor=hazard_stop_factor,
                exceedance_method=exceedance_method,
                risk_quantile=risk_quantile,
                risk_load_method=risk_load_method,
                expense_ratio=expense_ratio,
            )

            logger.info(
                "Resumo hazard | "
                f"hazard={hazard_name} max={float(np.nanmax(data.values)) if data.size else None} "
                f"mean={float(np.nanmean(data.values)) if data.size else None} "
                f"operational_max={operational_max} attention_max={attention_max} "
                f"operational_hours={int(np.sum(hazard_result['status'] == 0))} "
                f"attention_hours={int(np.sum(hazard_result['status'] == 1))} "
                f"stop_hours={int(np.sum(hazard_result['status'] == 2))}")

            status_stack.append(np.asarray(hazard_result.pop("status"), dtype=np.uint8))
            at_event_by_hazard[hazard_name] = np.asarray(hazard_result.pop("at_event"), dtype=float)
            frequency_by_hazard[hazard_name] = np.asarray(hazard_result.get("frequency", []), dtype=float)
            hazard_out[hazard_name] = hazard_result

        combined_status = np.maximum.reduce(status_stack) if status_stack else np.array([], dtype=np.uint8)
        combined = {
            "operational_hours": int(np.sum(combined_status == 0)),
            "attention_hours": int(np.sum(combined_status == 1)),
            "stop_hours": int(np.sum(combined_status == 2)),
            "total_hours": int(combined_status.size),
        }

        combined_impact = self._build_combined_impact(
            at_event_by_hazard=at_event_by_hazard,
            frequency_by_hazard=frequency_by_hazard,
            annualization=annualization,
            risk_quantile=risk_quantile,
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
        )

        combined_events = np.asarray(combined_impact["at_event"], dtype=float)
        combined_freq = np.asarray(combined_impact.get("frequency", []), dtype=float)
        clean_mask = np.isfinite(combined_events)
        sorted_idx = np.argsort(combined_events[clean_mask])[::-1] if clean_mask.any() else np.array([], dtype=int)
        sorted_losses = combined_events[clean_mask][sorted_idx]
        sorted_freq = combined_freq[clean_mask][sorted_idx] if combined_freq.size == combined_events.size else np.zeros_like(sorted_losses)
        # Frequency-based exceedance: running exceedance probability = 1 - cumulative frequency
        exceedance = []
        if sorted_losses.size:
            cum = np.cumsum(sorted_freq)
            total = float(np.sum(sorted_freq)) if np.isfinite(sorted_freq).any() else 0.0
            if total <= 0.0:
                exceedance = self._exceedance_probs(sorted_losses.size, exceedance_method)
            else:
                exceedance = 1.0 - np.clip(cum / total, 0.0, 1.0)
        exceedance_list = np.asarray(exceedance, dtype=float).tolist() if len(np.atleast_1d(exceedance)) else []

        hazard_labels = list(hazard_out.keys())
        hazard_aal_values = [float(hazard_out[h]["pricing"].get("aal", 0.0)) for h in hazard_labels]

        def _safe_float_or_dict(val):
            if isinstance(val, dict):
                # Recursively sanitize dict values
                return {k: _safe_float_or_dict(v) for k, v in val.items()}
            try:
                return float(val)
            except Exception:
                return 0.0

        pricing = combined_impact["pricing"]
        petals_appendix = pricing.get("petals_appendix", {})
        if not isinstance(petals_appendix, dict):
            petals_appendix = {}
        else:
            petals_appendix = _safe_float_or_dict(petals_appendix)

        response = {
            "time": aligned[0].time.values.astype(str).tolist() if aligned else [],
            "hazards": {
                hazard: {
                    **payload["metrics"],
                    "operational_max": payload["operational_max"],
                    "attention_max": payload["attention_max"],
                    "impact": payload["pricing"],
                    "pml": payload.get("pml", 0.0),
                    "aal": payload.get("pricing", {}).get("aal", 0.0),
                }
                for hazard, payload in hazard_out.items()
            },
            "hazard_breakdown": hazard_out,
            "combined": combined,
            "pricing_models": {
                "aal": _safe_float_or_dict(pricing.get("aal", 0.0)),
                "pml": _safe_float_or_dict(pricing.get("pml", 0.0)),
                "var": _safe_float_or_dict(pricing.get("var", 0.0)),
                "tvar": _safe_float_or_dict(pricing.get("tvar", 0.0)),
                "risk_load": _safe_float_or_dict(pricing.get("risk_load", 0.0)),
                "pure_premium": _safe_float_or_dict(pricing.get("pure_premium", 0.0)),
                "technical_premium": _safe_float_or_dict(pricing.get("technical_premium", 0.0)),
                "petals_appendix": petals_appendix,
                "annualization_factor": annualization,
                "asset_value": float(max(asset_value, 0.0)),
                "asset_profile": str(asset_type or "platform").lower(),
                "risk_load_method": risk_load_method,
                "risk_quantile": float(np.clip(risk_quantile, 0.5, 0.999)),
                "expense_ratio": float(max(expense_ratio, 0.0)),
            },
            "pricing_engine": "climada",
            "petals_enabled": True,
            "climada_graphs": {
                "return_period_curve": {
                    "return_period": combined_impact["return_period"],
                    "impact": combined_impact["impact_curve"],
                },
                "loss_exceedance_curve": {
                    "probability": exceedance_list,
                    "loss": sorted_losses.tolist(),
                },
                "hazard_aal_bar": {
                    "labels": hazard_labels,
                    "values": hazard_aal_values,
                },
            },
            "insights": [
                f"Modelo CLIMADA ativo para {', '.join(hazard_labels)}.",
                f"Perfil de vulnerabilidade aplicado: {str(asset_type or 'platform').lower()}.",
                f"Parada combinada: {combined['stop_hours']}h em {combined['total_hours']}h analisadas.",
                f"AAL combinado (CLIMADA): BRL {combined_impact['pricing']['aal']:.2f}.",
            ],
        }

        response["vulnerability_profile"] = {
            "asset_type": str(asset_type or "platform").lower(),
            "hazards": {
                hazard: {
                    "hazard_code": payload.get("hazard_code"),
                    "units": payload.get("units"),
                    "operational_max": payload.get("operational_max"),
                    "attention_max": payload.get("attention_max"),
                    "attention_loss_factor": payload.get("attention_loss_factor"),
                    "stop_loss_factor": payload.get("stop_loss_factor"),
                    "curve_definition": payload.get("curve_definition", {}),
                }
                for hazard, payload in hazard_out.items()
            },
        }

        return self._to_serializable(response)

    def get_oceanpact_series(self, hazard: str, region: str, period: str, lat: float, lon: float):
        """
        Busca e retorna série temporal do dado OceanPact NetCDF conforme seleção do usuário.
        hazard: 'onda' ou 'vento'
        region: 'campos', 'santos', etc
        period: 'historico', 'preditivo_2015_2030', etc
        """
        base_dir = "D:/OceanPact/Netcdf"
        file = find_netcdf_file(base_dir, hazard, period)
        if file:
            import xarray as xr
            ds = xr.open_dataset(file)
            if hazard == 'vento':
                # Procura possíveis nomes de variável de vento
                wind_vars = [
                    'wind', 'sfcwindmax_corr', 'sfc_wind_max', 'sfcwindmax',
                    'sfcWind', 'sfcWindmax', 'sfcWindmax_hist_processado', 'sfcWind_hist_processado'
                ]
                for var in wind_vars:
                    if var in ds.variables:
                        variable = var
                        break
                else:
                    raise ValueError(f"Nenhuma variável de vento encontrada no arquivo NetCDF. Variáveis disponíveis: {list(ds.variables.keys())}")
            else:
                # Para onda, cobre hs, hsmax, hsmean, etc
                wave_vars = ['hs', 'hsmax', 'hsmean', 'hsmax_ww3_mri_1979_2015', 'hsmean_ww3_mri_1979_2015']
                for var in wave_vars:
                    if var in ds.variables:
                        variable = var
                        break
                else:
                    raise ValueError(f"Nenhuma variável de onda encontrada no arquivo NetCDF. Variáveis disponíveis: {list(ds.variables.keys())}")
            ds.close()
            series = get_netcdf_series(file, variable, lat, lon)
            # Verifica se a série temporal está vazia
            if hasattr(series, 'size') and series.size == 0:
                raise ValueError(f"A série temporal extraída da variável '{variable}' está vazia para o ponto ({lat}, {lon}). Verifique se há dados válidos no NetCDF.")
            return series
        return None

climada_wind_wave_service = ClimadaWindWaveService()
