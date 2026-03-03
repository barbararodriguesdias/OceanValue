from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from .climada_wind_wave_service import climada_wind_wave_service


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
        asset_value: float = 1.0,
        thresholds: Optional[Dict[str, Dict[str, float]]] = None,
        attention_loss_factor: float = 0.35,
        stop_loss_factor: float = 1.0,
        risk_quantile: float = 0.95,
        risk_load_method: str = "none",
        expense_ratio: float = 0.15,
    ) -> Dict:
        scenario_id = self._SCENARIO_MAP.get(ssp_scenario, "ssp585")
        hazard_changes: Dict[str, Dict] = {}
        hazard_series: Dict[str, Dict] = {}
        hazard_graphs: Dict[str, Dict] = {}
        hazard_uncertainty: Dict[str, Dict] = {}

        for hazard in hazards:
            if hazard not in {"wind", "wave"}:
                continue
            hazard_threshold = (thresholds or {}).get(hazard, {})
            op_max_default = 10.0 if hazard == "wind" else 1.5
            att_max_default = 15.0 if hazard == "wind" else 2.5
            operational_max = float(hazard_threshold.get("operational_max", op_max_default))
            attention_max = float(hazard_threshold.get("attention_max", att_max_default))
            try:
                comp = climada_wind_wave_service.get_scenario_comparison(
                    hazard_name=hazard,
                    lat=lat,
                    lon=lon,
                    scenario=scenario_id,
                    stat="max",
                    historical_period=historical_period,
                    future_period=future_period,
                    operational_max=operational_max,
                    attention_max=attention_max,
                    asset_value=float(max(asset_value, 1e-6)),
                    attention_loss_factor=attention_loss_factor,
                    stop_loss_factor=stop_loss_factor,
                    risk_quantile=risk_quantile,
                    risk_load_method=risk_load_method,
                    expense_ratio=expense_ratio,
                )
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning(
                    "Falha no cenário CLIMADA | hazard=%s err=%s", hazard, exc
                )
                continue

            hist_block = comp.get("historical", {})
            fut_block = comp.get("future", {})
            if hazard == "wind":
                hist_p95 = float(hist_block.get("p95_knots", 0.0))
                fut_p95 = float(fut_block.get("p95_knots", 0.0))
                hist_min = float(hist_block.get("min_knots", 0.0))
                fut_min = float(fut_block.get("min_knots", 0.0))
                hist_max = float(hist_block.get("max_knots", 0.0))
                fut_max = float(fut_block.get("max_knots", 0.0))
                hist_mean = float(hist_block.get("mean_knots", 0.0))
                fut_mean = float(fut_block.get("mean_knots", 0.0))
            else:
                hist_p95 = float(hist_block.get("p95_meters", 0.0))
                fut_p95 = float(fut_block.get("p95_meters", 0.0))
                hist_min = float(hist_block.get("min_meters", 0.0))
                fut_min = float(fut_block.get("min_meters", 0.0))
                hist_max = float(hist_block.get("max_meters", 0.0))
                fut_max = float(fut_block.get("max_meters", 0.0))
                hist_mean = float(hist_block.get("mean_meters", 0.0))
                fut_mean = float(fut_block.get("mean_meters", 0.0))

            hist_imp = hist_block.get("climada_impact", {}) or {}
            fut_imp = fut_block.get("climada_impact", {}) or {}
            hist_aal = float(hist_imp.get("aal", 0.0))
            fut_aal = float(fut_imp.get("aal", 0.0))

            pct = 0.0
            basis = "p95"
            base_val = hist_p95
            fut_val = fut_p95
            if hist_aal > 0:
                basis = "aal"
                base_val = hist_aal
                fut_val = fut_aal
            if base_val > 0:
                pct = (fut_val - base_val) / base_val * 100.0

            hazard_changes[hazard] = {
                "historical_p95": hist_p95,
                "future_p95": fut_p95,
                "change_percent": float(pct),
                "historical_aal": hist_aal,
                "future_aal": fut_aal,
                "historical_pml": float(hist_imp.get("pml", 0.0)),
                "future_pml": float(fut_imp.get("pml", 0.0)),
                "basis": basis,
                "historical_min": hist_min,
                "future_min": fut_min,
                "historical_mean": hist_mean,
                "future_mean": fut_mean,
                "historical_max": hist_max,
                "future_max": fut_max,
            }
            hazard_series[hazard] = comp.get("series", {})
            hazard_graphs[hazard] = comp.get("climada_graphs", {})
            if comp.get("uncertainty"):
                hazard_uncertainty[hazard] = comp.get("uncertainty")

        change_values = [item["change_percent"] for item in hazard_changes.values()]
        aggregate_change = float(sum(change_values) / len(change_values)) if change_values else 0.0

        return {
            "scenario_requested": ssp_scenario,
            "scenario_used": scenario_id,
            "hazard_changes": hazard_changes,
            "series": hazard_series,
            "climada_graphs": hazard_graphs,
            "uncertainty": hazard_uncertainty,
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
        asset_value: float = 1.0,
        thresholds: Optional[Dict[str, Dict[str, float]]] = None,
        attention_loss_factor: float = 0.35,
        stop_loss_factor: float = 1.0,
        risk_quantile: float = 0.95,
        risk_load_method: str = "none",
        expense_ratio: float = 0.15,
    ) -> Dict:
        scenario_delta = self.compute_scenario_change_percent(
            lat=lat,
            lon=lon,
            hazards=hazards,
            ssp_scenario=ssp_scenario,
            historical_period=historical_period,
            future_period=future_period,
            asset_value=asset_value,
            thresholds=thresholds,
            attention_loss_factor=attention_loss_factor,
            stop_loss_factor=stop_loss_factor,
            risk_quantile=risk_quantile,
            risk_load_method=risk_load_method,
            expense_ratio=expense_ratio,
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
            "hazard_changes": scenario_delta.get("hazard_changes", {}),
            "series": scenario_delta.get("series", {}),
            "climada_graphs": scenario_delta.get("climada_graphs", {}),
            "uncertainty": scenario_delta.get("uncertainty", {}),
        }


climate_risk_adapter = ClimateRiskAdapter()
