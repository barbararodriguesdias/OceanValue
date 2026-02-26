from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4


class ClimateRiskKernel:
    """Kernel utilities for traceability and standardized financial outputs."""

    def __init__(self) -> None:
        self.model_version = os.getenv("CLIMATE_MODEL_VERSION", "climada-kernel-v1")
        self.data_version = os.getenv("CLIMATE_DATA_VERSION", "era5-zarr-v1")
        self.scenario_version = os.getenv("CLIMATE_SCENARIO_VERSION", "cmip6-netcdf-v1")

    @staticmethod
    def _serialize_for_hash(payload: Dict[str, Any]) -> str:
        return json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)

    def build_traceability(
        self,
        *,
        analysis_mode: str,
        assumptions: Dict[str, Any],
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        serialized = self._serialize_for_hash(assumptions)
        assumptions_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        return {
            "run_id": str(uuid4()),
            "analysis_mode": analysis_mode,
            "timestamp_utc": now.isoformat(),
            "model_version": self.model_version,
            "data_version": self.data_version,
            "scenario_version": self.scenario_version,
            "assumptions_hash": assumptions_hash,
        }

    @staticmethod
    def build_financial_outputs(
        *,
        pricing_models: Optional[Dict[str, Any]],
        pricing: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Optional[float]]:
        pricing_models = pricing_models or {}
        pricing = pricing or {}

        return {
            "aal": float(pricing_models["aal"]) if pricing_models.get("aal") is not None else None,
            "pml": float(pricing_models["pml"]) if pricing_models.get("pml") is not None else None,
            "var": float(pricing_models["var"]) if pricing_models.get("var") is not None else None,
            "tvar": float(pricing_models["tvar"]) if pricing_models.get("tvar") is not None else None,
            "technical_premium": float(pricing_models["technical_premium"]) if pricing_models.get("technical_premium") is not None else None,
            "downtime_cost": float(pricing["total_cost"]) if pricing.get("total_cost") is not None else None,
        }


climate_risk_kernel = ClimateRiskKernel()
