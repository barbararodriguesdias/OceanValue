from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .netcdf_reader import netcdf_reader


class ClimateRiskAdapter:
    """Adapter layer to compose climate scenario deltas into risk metrics."""

    _SCENARIO_MAP = {
        "SSP5-8.5": "ssp585",
        "SSP2-4.5": "ssp585",
        "SSP1-2.6": "ssp585",
    }

    def period_to_dates(self, period: str, default_start: str, default_end: str) -> Tuple[str, str]:
        try:
            start_year, end_year = [int(part.strip()) for part in period.split("-", 1)]
            if start_year > end_year:
                raise ValueError("Período inválido: ano inicial maior que ano final")
            return f"{start_year:04d}-01-01", f"{end_year:04d}-12-31"
        except Exception:
            return default_start, default_end

    def compute_scenario_change_percent(
        self,
        *,
        lat: float,
        lon: float,
        hazards: List[str],
        ssp_scenario: str,
        historical_period: str,
        future_period: str,
    ) -> Dict:
        scenario_id = self._SCENARIO_MAP.get(ssp_scenario, "ssp585")
        hazard_changes: Dict[str, Dict[str, float]] = {}

        if "wind" in hazards:
            wind_cmp = netcdf_reader.get_wind_scenario_comparison(
                lat=lat,
                lon=lon,
                scenario=scenario_id,
                stat="mean",
                historical_period=historical_period,
                future_period=future_period,
                operational_max_knots=15.0,
                attention_max_knots=20.0,
            )
            hist = float(wind_cmp.get("historical", {}).get("p95_knots", 0.0))
            fut = float(wind_cmp.get("future", {}).get("p95_knots", 0.0))
            pct = ((fut - hist) / hist * 100.0) if hist > 0 else 0.0
            hazard_changes["wind"] = {
                "historical_p95": hist,
                "future_p95": fut,
                "change_percent": float(pct),
            }

        if "wave" in hazards:
            wave_cmp = netcdf_reader.get_wave_scenario_comparison(
                lat=lat,
                lon=lon,
                scenario=scenario_id,
                stat="mean",
                historical_period=historical_period,
                future_period=future_period,
                operational_max_meters=2.0,
                attention_max_meters=4.0,
            )
            hist = float(wave_cmp.get("historical", {}).get("p95_meters", 0.0))
            fut = float(wave_cmp.get("future", {}).get("p95_meters", 0.0))
            pct = ((fut - hist) / hist * 100.0) if hist > 0 else 0.0
            hazard_changes["wave"] = {
                "historical_p95": hist,
                "future_p95": fut,
                "change_percent": float(pct),
            }

        change_values = [item["change_percent"] for item in hazard_changes.values()]
        aggregate_change = float(sum(change_values) / len(change_values)) if change_values else 0.0

        return {
            "scenario_requested": ssp_scenario,
            "scenario_used": scenario_id,
            "hazard_changes": hazard_changes,
            "change_percent": aggregate_change,
        }

    def build_scenario_response(
        self,
        *,
        lat: float,
        lon: float,
        hazards: List[str],
        ssp_scenario: str,
        historical_period: str,
        future_period: str,
        base_aal: float,
        base_pml: float,
    ) -> Dict:
        scenario_delta = self.compute_scenario_change_percent(
            lat=lat,
            lon=lon,
            hazards=hazards,
            ssp_scenario=ssp_scenario,
            historical_period=historical_period,
            future_period=future_period,
        )

        factor = max(0.0, 1.0 + scenario_delta["change_percent"] / 100.0)
        projected_aal = float(base_aal) * factor
        projected_pml = float(base_pml) * factor

        return {
            "ssp_scenario": ssp_scenario,
            "historical_period": historical_period,
            "future_period": future_period,
            "scenario_used": scenario_delta["scenario_used"],
            "change_percent": float(scenario_delta["change_percent"]),
            "projected_aal": float(projected_aal),
            "projected_pml": float(projected_pml),
            "hazard_changes": scenario_delta["hazard_changes"],
        }


climate_risk_adapter = ClimateRiskAdapter()
