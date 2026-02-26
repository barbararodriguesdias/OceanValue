import logging
import os
from dataclasses import dataclass
from typing import Dict, List

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ClimadaRuntime:
    available: bool
    reason: str
    Impact: object | None


def _load_climada() -> ClimadaRuntime:
    try:
        from climada.engine import Impact  # type: ignore

        return ClimadaRuntime(available=True, reason="ok", Impact=Impact)
    except Exception as exc:
        return ClimadaRuntime(available=False, reason=str(exc), Impact=None)


class ClimadaPetalsEngine:
    """Pricing engine using CLIMADA primitives + PETALS appendix metrics."""

    def __init__(self) -> None:
        self.runtime = _load_climada()
        self.strict = os.getenv("CLIMADA_REQUIRED", "true").lower() in {"1", "true", "yes", "on"}

        if self.runtime.available:
            logger.info("CLIMADA engine initialized successfully.")
        else:
            logger.warning("CLIMADA engine not available: %s", self.runtime.reason)

    def _assert_available(self) -> None:
        if self.runtime.available:
            return
        if self.strict:
            raise RuntimeError(
                "CLIMADA é obrigatório para precificação neste projeto e não está disponível. "
                f"Detalhe: {self.runtime.reason}"
            )

    def _build_climada_impact(self, loss_per_step: np.ndarray, annualization: float):
        self._assert_available()
        if not self.runtime.available:
            return None

        Impact = self.runtime.Impact
        if Impact is None:
            return None

        impact = Impact()
        n = max(int(loss_per_step.size), 1)
        impact.at_event = np.asarray(loss_per_step, dtype=float)
        annualization_f = float(max(annualization, 1e-12))
        impact.frequency = np.full(n, annualization_f / n, dtype=float)
        impact.event_id = np.arange(1, n + 1, dtype=int)
        impact.date = np.arange(737061, 737061 + n, dtype=int)
        impact.unit = "BRL"

        return impact

    def _extract_climada_aal(self, impact) -> float | None:
        if impact is None:
            return None

        try:
            candidate = float(np.sum(np.asarray(impact.at_event, dtype=float) * np.asarray(impact.frequency, dtype=float)))
            if np.isfinite(candidate):
                return candidate
        except Exception:
            pass
        return None

    def _extract_climada_var(self, impact, risk_quantile: float) -> float | None:
        if impact is None:
            return None

        exceedance_prob = float(np.clip(1.0 - risk_quantile, 1e-6, 0.5))
        return_period = 1.0 / exceedance_prob

        try:
            curve = impact.calc_freq_curve(return_per=[return_period])
            values = np.asarray(curve.impact, dtype=float)
            if values.size > 0 and np.isfinite(values[0]):
                return float(values[0])
        except Exception:
            return None
        return None

    def _extract_climada_pml(self, impact) -> float | None:
        if impact is None:
            return None
        try:
            curve = impact.calc_freq_curve()
            values = np.asarray(curve.impact, dtype=float)
            if values.size > 0:
                candidate = float(np.nanmax(values))
                if np.isfinite(candidate):
                    return candidate
        except Exception:
            return None
        return None

    def build_petals_appendix(self, loss_per_step: np.ndarray, annualization: float) -> Dict[str, List[float] | List[str]]:
        quantiles = [0.50, 0.75, 0.90, 0.95, 0.99]
        labels = [f"Q{int(q * 100)}" for q in quantiles]

        if loss_per_step.size == 0:
            return {"petals_labels": labels, "petals_values": [0.0 for _ in quantiles]}

        values = [float(np.nanquantile(loss_per_step, q)) * annualization for q in quantiles]
        vmax = max(max(values), 1e-12)
        normalized = [float(v / vmax) for v in values]
        return {
            "petals_labels": labels,
            "petals_values": normalized,
            "petals_raw_values": values,
        }

    def compute_pricing(
        self,
        loss_per_step: np.ndarray,
        annualization: float,
        risk_quantile: float,
        risk_load_method: str,
        expense_ratio: float,
    ) -> Dict[str, float | str | Dict]:
        clean = np.asarray(loss_per_step, dtype=float)
        clean = clean[np.isfinite(clean)]
        if clean.size == 0:
            clean = np.array([0.0], dtype=float)

        impact = self._build_climada_impact(clean, annualization=annualization)
        aal_base = self._extract_climada_aal(impact)
        if aal_base is None:
            aal_base = float(np.mean(clean)) * float(max(annualization, 0.0))

        quantile = float(np.clip(risk_quantile, 0.5, 0.999))
        aal = float(aal_base)

        pml_base = self._extract_climada_pml(impact)
        if pml_base is None:
            pml_base = float(np.nanmax(clean)) * float(max(annualization, 0.0))
        pml = float(pml_base)

        var_base = self._extract_climada_var(impact, quantile)
        if var_base is None:
            var_base = float(np.nanquantile(clean, quantile)) * float(max(annualization, 0.0))
        var_q = float(var_base)

        threshold_base = var_q / float(max(annualization, 1e-12))
        tail = clean[clean >= threshold_base]
        tvar_q = (float(np.nanmean(tail)) if tail.size else threshold_base) * float(max(annualization, 0.0))

        method = (risk_load_method or "none").lower()
        if method == "var":
            risk_load = max(var_q - aal, 0.0)
        elif method == "tvar":
            risk_load = max(tvar_q - aal, 0.0)
        elif method == "stdev":
            risk_load = float(np.nanstd(clean)) * np.sqrt(annualization)
        else:
            risk_load = 0.0

        pure_premium = aal
        technical_premium = pure_premium * (1.0 + float(max(expense_ratio, 0.0))) + risk_load

        petals = self.build_petals_appendix(clean, annualization)

        return {
            "aal": float(aal),
            "pml": float(pml),
            "var": float(var_q),
            "tvar": float(tvar_q),
            "risk_load": float(risk_load),
            "pure_premium": float(pure_premium),
            "technical_premium": float(technical_premium),
            "risk_quantile": float(quantile),
            "risk_load_method": method,
            "engine": "climada",
            "petals_appendix": petals,
        }

    def compute_quantile_sensitivity(
        self,
        loss_per_step: np.ndarray,
        annualization: float,
        risk_load_method: str,
        expense_ratio: float,
    ) -> List[Dict[str, float]]:
        quantiles = [0.90, 0.95, 0.99]
        results: List[Dict[str, float]] = []
        for q in quantiles:
            pricing = self.compute_pricing(
                loss_per_step=loss_per_step,
                annualization=annualization,
                risk_quantile=q,
                risk_load_method=risk_load_method,
                expense_ratio=expense_ratio,
            )
            results.append(
                {
                    "quantile": float(q),
                    "var": float(pricing["var"]),
                    "tvar": float(pricing["tvar"]),
                    "technical_premium": float(pricing["technical_premium"]),
                }
            )
        return results


climada_petals_engine = ClimadaPetalsEngine()
