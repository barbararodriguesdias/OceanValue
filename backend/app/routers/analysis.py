# Analysis Router
# OceanValue API endpoints for analysis operations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Literal
from ..services.zarr_reader import zarr_reader
from ..services.climate_risk_adapter import climate_risk_adapter
from ..services.climate_risk_kernel import climate_risk_kernel
from ..services.litpop_service import litpop_population_service
from ..services.climada_wind_wave_service import climada_wind_wave_service
import logging
from io import BytesIO
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader

logger = logging.getLogger(__name__)

router = APIRouter()


class WindRiskRequest(BaseModel):
    lat: float
    lon: float
    start_time: str
    end_time: str
    operational_max_knots: float = 15.0
    attention_max_knots: float = 20.0
    cost_attention_per_hour: Optional[float] = None
    cost_stop_per_hour: Optional[float] = None
    asset_value: Optional[float] = None
    attention_loss_factor: float = 0.35
    stop_loss_factor: float = 1.0
    exceedance_method: str = "weibull"
    risk_load_method: str = "none"
    risk_quantile: float = 0.95
    expense_ratio: float = 0.15


class HazardThreshold(BaseModel):
    operational_max: float
    attention_max: float


class MultiRiskRequest(BaseModel):
    lat: float
    lon: float
    start_time: str
    end_time: str
    hazards: List[str]
    thresholds: Dict[str, HazardThreshold]
    stop_cost_per_hour: Optional[float] = None
    combine_mode: str = "worst"
    weights: Optional[Dict[str, float]] = None
    multiplier: Optional[float] = None
    asset_value: Optional[float] = None
    attention_loss_factor: float = 0.35
    stop_loss_factor: float = 1.0
    exceedance_method: str = "weibull"
    risk_load_method: str = "none"
    risk_quantile: float = 0.95
    expense_ratio: float = 0.15
    include_series: bool = False


class OperationalBand(BaseModel):
    operational: float
    attention: float
    stop: Optional[float] = None


class Waypoint(BaseModel):
    lat: float
    lon: float


class MaritimeDowntimeRequest(BaseModel):
    vessel_name: str
    vessel_type: str
    downtime_cost_per_hour: float
    lat: Optional[float] = None
    lon: Optional[float] = None
    waypoints: Optional[List[Waypoint]] = None
    start_time: str
    end_time: str
    wind_limits: OperationalBand
    wave_limits: Optional[OperationalBand] = None
    current_limits: Optional[OperationalBand] = None
    asset_value: Optional[float] = None
    attention_loss_factor: float = 0.35
    stop_loss_factor: float = 1.0
    exceedance_method: str = "weibull"
    risk_load_method: str = "none"
    risk_quantile: float = 0.95
    expense_ratio: float = 0.15


class ClimateScenarioRequest(BaseModel):
    historical_period: str
    future_period: str
    ssp_scenario: Literal["SSP1-2.6", "SSP2-4.5", "SSP5-8.5"]


class ClimateRiskOffshoreRequest(BaseModel):
    lat: float
    lon: float
    asset_type: str
    asset_value: float
    hazards: List[str]
    wind_operational_max: float = 15.0
    wind_attention_max: float = 20.0
    wave_operational_max: float = 2.0
    wave_attention_max: float = 4.0
    enable_scenarios: bool = False
    scenario: Optional[ClimateScenarioRequest] = None
    attention_loss_factor: float = 0.35
    stop_loss_factor: float = 1.0
    exceedance_method: str = "weibull"
    risk_load_method: str = "none"
    risk_quantile: float = 0.95
    expense_ratio: float = 0.15


class ClimateRiskOnshoreRequest(BaseModel):
    lat: float
    lon: float
    asset_type: str
    asset_value: float
    hazards: List[str]
    wind_operational_max: float = 15.0
    wind_attention_max: float = 20.0
    wave_operational_max: float = 2.0
    wave_attention_max: float = 4.0
    include_population: bool = True
    state_name: Optional[str] = None
    enable_scenarios: bool = False
    scenario: Optional[ClimateScenarioRequest] = None
    attention_loss_factor: float = 0.35
    stop_loss_factor: float = 1.0
    exceedance_method: str = "weibull"
    risk_load_method: str = "none"
    risk_quantile: float = 0.95
    expense_ratio: float = 0.15


def _resolve_point_from_request(
    lat: Optional[float],
    lon: Optional[float],
    waypoints: Optional[List[Waypoint]],
) -> tuple[float, float]:
    if lat is not None and lon is not None:
        return float(lat), float(lon)

    if waypoints:
        first = waypoints[0]
        return float(first.lat), float(first.lon)

    raise HTTPException(status_code=400, detail="lat/lon ou waypoints são obrigatórios")


def _draw_climate_vulnerability_profile(pdf: canvas.Canvas, result: Dict, y: float) -> float:
    profile = result.get("vulnerability_profile") or {}
    hazards_profile = profile.get("hazards") or {}
    if not hazards_profile:
        return y

    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(40, y, "Perfil de vulnerabilidade aplicado")
    y -= 14
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y, f"Asset type: {str(profile.get('asset_type', '-'))}")
    y -= 14

    for hazard_name, hazard_data in hazards_profile.items():
        op = float(hazard_data.get("operational_max", 0.0))
        att = float(hazard_data.get("attention_max", 0.0))
        att_loss = float(hazard_data.get("attention_loss_factor", 0.0))
        stop_loss = float(hazard_data.get("stop_loss_factor", 0.0))
        units = str(hazard_data.get("units", ""))
        curve = hazard_data.get("curve_definition", {}) or {}
        intensity = curve.get("intensity", []) or []
        mdd = curve.get("mdd", []) or []

        pdf.drawString(
            40,
            y,
            f"{hazard_name}: op={op:.2f}{units}, att={att:.2f}{units}, f_att={att_loss:.2f}, f_stop={stop_loss:.2f}",
        )
        y -= 12

        if intensity and mdd:
            pairs = []
            for idx, x_val in enumerate(intensity):
                y_val = mdd[idx] if idx < len(mdd) else 0.0
                pairs.append(f"{float(x_val):.2f}->{float(y_val):.2f}")
            curve_text = "Curva: " + " | ".join(pairs)
            pdf.drawString(52, y, curve_text[:145])
            y -= 12

    return y


def _draw_climate_graph_pages(pdf: canvas.Canvas, result: Dict) -> None:
    charts = result.get("climada_graphs") or {}

    rp = charts.get("return_period_curve") or {}
    rp_x = rp.get("return_period", []) or []
    rp_y = rp.get("impact", []) or []
    if rp_x and rp_y:
        fig, ax = plt.subplots(figsize=(6.5, 4.2))
        ax.plot(rp_x, rp_y)
        ax.set_title("CLIMADA - Curva de Retorno")
        ax.set_xlabel("Return period (anos)")
        ax.set_ylabel("Impacto (BRL)")
        fig.tight_layout()
        img_buf = BytesIO()
        fig.savefig(img_buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        img_buf.seek(0)
        pdf.drawImage(ImageReader(img_buf), 30, 220, width=550, height=360)
        pdf.showPage()

    exc = charts.get("loss_exceedance_curve") or {}
    exc_x = exc.get("probability", []) or []
    exc_y = exc.get("loss", []) or []
    if exc_x and exc_y:
        fig, ax = plt.subplots(figsize=(6.5, 4.2))
        ax.plot(exc_x, exc_y)
        ax.set_title("CLIMADA - Curva de Excedencia")
        ax.set_xlabel("Probabilidade")
        ax.set_ylabel("Perda (BRL)")
        fig.tight_layout()
        img_buf = BytesIO()
        fig.savefig(img_buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        img_buf.seek(0)
        pdf.drawImage(ImageReader(img_buf), 30, 220, width=550, height=360)
        pdf.showPage()

    bar = charts.get("hazard_aal_bar") or {}
    bar_x = bar.get("labels", []) or []
    bar_y = bar.get("values", []) or []
    if bar_x and bar_y:
        fig, ax = plt.subplots(figsize=(6.5, 4.2))
        ax.bar(bar_x, bar_y)
        ax.set_title("CLIMADA - AAL por hazard")
        ax.set_xlabel("Hazard")
        ax.set_ylabel("AAL (BRL)")
        fig.tight_layout()
        img_buf = BytesIO()
        fig.savefig(img_buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        img_buf.seek(0)
        pdf.drawImage(ImageReader(img_buf), 30, 220, width=550, height=360)
        pdf.showPage()


def _coerce_float(value: object, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _run_climada_analysis(
    *,
    lat: float,
    lon: float,
    hazards: List[str],
    thresholds: Dict[str, Dict[str, float]],
    start_time: str,
    end_time: str,
    asset_value: Optional[float],
    attention_loss_factor: float,
    stop_loss_factor: float,
    exceedance_method: str,
    risk_load_method: str,
    risk_quantile: float,
    expense_ratio: float,
    asset_type: str = "platform",
) -> Dict:
    return climada_wind_wave_service.analyze_point(
        lat=float(lat),
        lon=float(lon),
        asset_type=asset_type,
        hazards=hazards,
        start_time=start_time,
        end_time=end_time,
        thresholds=thresholds,
        asset_value=float(asset_value or 0.0),
        attention_loss_factor=float(attention_loss_factor),
        stop_loss_factor=float(stop_loss_factor),
        exceedance_method=exceedance_method,
        risk_quantile=float(risk_quantile),
        risk_load_method=risk_load_method,
        expense_ratio=float(expense_ratio),
    )


def _build_multi_risk_response_from_climada(
    *,
    result: Dict,
    thresholds: Dict[str, Dict[str, float]],
    combine_mode: str,
    stop_cost_per_hour: Optional[float],
    include_series: bool,
    lat: float,
    lon: float,
    start_time: str,
    end_time: str,
) -> Dict:
    hazard_breakdown = result.get("hazard_breakdown", {}) or {}
    hazards_out: Dict[str, Dict[str, float]] = {}
    distributions_out: Dict[str, Dict[str, List[float]]] = {}

    for hazard_name, payload in hazard_breakdown.items():
        metrics = payload.get("metrics", {}) or {}
        limits = thresholds.get(hazard_name, {})
        hazards_out[hazard_name] = {
            "mean": _coerce_float(metrics.get("mean")),
            "max": _coerce_float(metrics.get("max")),
            "operational_hours": int(metrics.get("operational_hours", 0) or 0),
            "attention_hours": int(metrics.get("attention_hours", 0) or 0),
            "stop_hours": int(metrics.get("stop_hours", 0) or 0),
            "operational_max": _coerce_float(limits.get("operational_max"), _coerce_float(payload.get("operational_max"))),
            "attention_max": _coerce_float(limits.get("attention_max"), _coerce_float(payload.get("attention_max"))),
        }

        charts = payload.get("charts", {}) or {}
        distributions_out[hazard_name] = {
            "hist_bins": charts.get("hist_bins", []) or [],
            "hist_counts": charts.get("hist_counts", []) or [],
            "exceedance_values": charts.get("exceedance_values", []) or [],
            "exceedance_probs": charts.get("exceedance_probs", []) or [],
        }

    combined = result.get("combined", {}) or {}
    effective_stop_hours = float(combined.get("stop_hours", 0) or 0)
    pricing = None
    if stop_cost_per_hour is not None:
        stop_cost = float(stop_cost_per_hour) * effective_stop_hours
        pricing = {
            "stop_cost": stop_cost,
            "total_cost": stop_cost,
        }

    payload = {
        "time": result.get("time", []) or [],
        "hazards": hazards_out,
        "distributions": distributions_out,
        "combined": {
            "operational_hours": int(combined.get("operational_hours", 0) or 0),
            "attention_hours": int(combined.get("attention_hours", 0) or 0),
            "stop_hours": int(combined.get("stop_hours", 0) or 0),
            "total_hours": int(combined.get("total_hours", 0) or 0),
        },
        "combine_mode": "worst",
        "effective_stop_hours": effective_stop_hours,
        "pricing": pricing,
        "pricing_models": result.get("pricing_models"),
        "hazard_pricing_models": {
            hazard: details.get("pricing")
            for hazard, details in hazard_breakdown.items()
            if isinstance(details, dict)
        },
        "combined_exceedance": {
            "values": ((result.get("climada_graphs", {}) or {}).get("loss_exceedance_curve", {}) or {}).get("loss", []) or [],
            "probs": ((result.get("climada_graphs", {}) or {}).get("loss_exceedance_curve", {}) or {}).get("probability", []) or [],
        },
        "metrics": {
            hazard: {
                "mean": _coerce_float((details.get("metrics") or {}).get("mean")),
                "max": _coerce_float((details.get("metrics") or {}).get("max")),
                "p50": _coerce_float((details.get("metrics") or {}).get("p50")),
                "p90": _coerce_float((details.get("metrics") or {}).get("p90")),
                "p95": _coerce_float((details.get("metrics") or {}).get("p95")),
                "p99": _coerce_float((details.get("metrics") or {}).get("p99")),
            }
            for hazard, details in hazard_breakdown.items()
            if isinstance(details, dict)
        },
        "wind_rose": result.get("wind_rose"),
        "exposure_reference": result.get("exposure_reference"),
        "pricing_engine": result.get("pricing_engine"),
        "petals_enabled": bool(result.get("petals_enabled", False)),
        "insights": result.get("insights", []),
        "climada_graphs": result.get("climada_graphs", {}),
    }

    if include_series:
        series: Dict[str, List[float]] = {}
        if "wind" in hazards_out:
            wind_series = zarr_reader.get_wind_speed_series(lat, lon, start_time, end_time)
            series["wind"] = np.asarray(wind_series.values, dtype=float).tolist()
            direction_series = zarr_reader.get_wind_direction_series(lat, lon, start_time, end_time)
            series["wind_direction_deg"] = np.asarray(direction_series.values, dtype=float).tolist()
        if "wave" in hazards_out:
            wave_series = zarr_reader.get_point_series("hs", lat, lon, start_time, end_time)
            series["wave"] = np.asarray(wave_series.values, dtype=float).tolist()
        payload["series"] = series

    if combine_mode != "worst":
        payload.setdefault("insights", [])
        payload["insights"].append(
            "CLIMADA opera com combinação física de perdas; modo retornado como 'worst' para manter consistência atuarial."
        )

    return payload


def _build_climate_risk_pdf(title: str, request: BaseModel, result: Dict) -> BytesIO:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    _, height = A4

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, height - 40, title)

    pdf.setFont("Helvetica", 10)
    lat = float(getattr(request, "lat", 0.0))
    lon = float(getattr(request, "lon", 0.0))
    asset_type = str(getattr(request, "asset_type", "-"))
    hazards = getattr(request, "hazards", []) or []
    pdf.drawString(40, height - 60, f"Ponto: {lat:.5f}, {lon:.5f}")
    pdf.drawString(40, height - 75, f"Ativo: {asset_type}")
    pdf.drawString(40, height - 90, f"Hazards: {', '.join(hazards)}")

    financial_outputs = result.get("financial_outputs") or {}
    aal_value = _coerce_float(
        financial_outputs.get("aal") if financial_outputs.get("aal") is not None else result.get("aal", 0.0)
    )
    pml_value = _coerce_float(
        financial_outputs.get("pml") if financial_outputs.get("pml") is not None else result.get("pml", 0.0)
    )
    var_value = _coerce_float(financial_outputs.get("var"))
    tvar_value = _coerce_float(financial_outputs.get("tvar"))

    y = height - 112
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(40, y, "Metricas financeiras")
    y -= 16
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y, f"AAL: {aal_value:.2f} BRL")
    y -= 14
    pdf.drawString(40, y, f"PML: {pml_value:.2f} BRL")
    y -= 14
    pdf.drawString(40, y, f"VaR: {var_value:.2f} BRL")
    y -= 14
    pdf.drawString(40, y, f"TVaR: {tvar_value:.2f} BRL")
    y -= 20

    y = _draw_climate_vulnerability_profile(pdf, result, y)

    insights = result.get("insights") or []
    if insights:
        y -= 8
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(40, y, "Insights")
        y -= 14
        pdf.setFont("Helvetica", 10)
        for insight in insights:
            pdf.drawString(40, y, f"- {insight}"[:145])
            y -= 12

    pdf.showPage()
    _draw_climate_graph_pages(pdf, result)
    pdf.save()
    buffer.seek(0)
    return buffer

@router.post("/run")
async def run_analysis(
    analysis_request: dict
):
    """
    Run climate risk analysis
    
    Request body:
    {
        "hazard_type": "wind" | "wave" | "flood" | "heatwave",
        "region": {
            "type": "point" | "polygon",
            "coordinates": [...] 
        },
        "period": {
            "start": "2015-01-01",
            "end": "2023-12-31"
        },
        "parameters": {
            "wind_threshold": 25.0,
            ...
        }
    }
    """
    logger.info(f"Running analysis: {analysis_request}")
    
    # TODO: Validate request
    # TODO: Queue async task
    # TODO: Return task ID
    
    return {
        "analysis_id": "analysis_001",
        "status": "queued",
        "message": "Analysis queued for processing"
    }


@router.post("/wind-risk")
async def run_wind_risk(request: WindRiskRequest):
    """Run wind risk analysis for a selected point using ERA5 Zarr."""
    try:
        thresholds = {
            "wind": {
                "operational_max": float(request.operational_max_knots),
                "attention_max": float(max(request.attention_max_knots, request.operational_max_knots)),
            }
        }
        result = _run_climada_analysis(
            lat=request.lat,
            lon=request.lon,
            hazards=["wind"],
            thresholds=thresholds,
            start_time=request.start_time,
            end_time=request.end_time,
            asset_value=request.asset_value,
            attention_loss_factor=request.attention_loss_factor,
            stop_loss_factor=request.stop_loss_factor,
            exceedance_method=request.exceedance_method,
            risk_load_method=request.risk_load_method,
            risk_quantile=request.risk_quantile,
            expense_ratio=request.expense_ratio,
            asset_type="platform",
        )

        wind_series = zarr_reader.get_wind_speed_series(request.lat, request.lon, request.start_time, request.end_time)
        direction_series = zarr_reader.get_wind_direction_series(request.lat, request.lon, request.start_time, request.end_time)

        speed_knots = np.asarray(wind_series.values, dtype=float)
        direction_deg = np.asarray(direction_series.values, dtype=float)
        op_limit = float(request.operational_max_knots)
        att_limit = float(max(request.attention_max_knots, request.operational_max_knots))

        status = np.zeros(speed_knots.size, dtype=np.uint8)
        status = np.where(speed_knots >= att_limit, 2, status)
        status = np.where((speed_knots >= op_limit) & (speed_knots < att_limit), 1, status)

        pricing = None
        if request.cost_attention_per_hour is not None or request.cost_stop_per_hour is not None:
            attention_hours = int(np.sum(status == 1))
            stop_hours = int(np.sum(status == 2))
            pricing = {
                "attention_cost": float(attention_hours * (request.cost_attention_per_hour or 0.0)),
                "stop_cost": float(stop_hours * (request.cost_stop_per_hour or 0.0)),
            }
            pricing["total_cost"] = pricing["attention_cost"] + pricing["stop_cost"]

        combined = result.get("combined", {}) or {}
        return {
            "lat": float(request.lat),
            "lon": float(request.lon),
            "time": result.get("time", []) or [],
            "speed_knots": speed_knots.tolist(),
            "direction_deg": direction_deg.tolist(),
            "status": status.tolist(),
            "limits": {
                "operational_max_knots": op_limit,
                "attention_max_knots": att_limit,
            },
            "summary": {
                "total_hours": int(combined.get("total_hours", 0) or 0),
                "operational_hours": int(combined.get("operational_hours", 0) or 0),
                "attention_hours": int(combined.get("attention_hours", 0) or 0),
                "stop_hours": int(combined.get("stop_hours", 0) or 0),
            },
            "pricing": pricing,
            "pricing_models": result.get("pricing_models"),
            "pricing_engine": result.get("pricing_engine"),
            "petals_enabled": bool(result.get("petals_enabled", False)),
            "climada_graphs": result.get("climada_graphs", {}),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/multi-risk")
async def run_multi_risk(request: MultiRiskRequest):
    """Run multi-risk analysis for a selected point using ERA5 Zarr."""
    try:
        thresholds = {
            key: {
                "operational_max": value.operational_max,
                "attention_max": value.attention_max,
            }
            for key, value in request.thresholds.items()
        }

        supported_hazards = [hazard for hazard in request.hazards if hazard in {"wind", "wave"}]
        hazards = supported_hazards or ["wind", "wave"]
        selected_thresholds = {hazard: thresholds[hazard] for hazard in hazards if hazard in thresholds}

        result = _run_climada_analysis(
            lat=request.lat,
            lon=request.lon,
            hazards=hazards,
            thresholds=selected_thresholds,
            start_time=request.start_time,
            end_time=request.end_time,
            asset_value=request.asset_value,
            attention_loss_factor=request.attention_loss_factor,
            stop_loss_factor=request.stop_loss_factor,
            exceedance_method=request.exceedance_method,
            risk_load_method=request.risk_load_method,
            risk_quantile=request.risk_quantile,
            expense_ratio=request.expense_ratio,
            asset_type="platform",
        )

        return _build_multi_risk_response_from_climada(
            result=result,
            thresholds=selected_thresholds,
            combine_mode=request.combine_mode,
            stop_cost_per_hour=request.stop_cost_per_hour,
            include_series=request.include_series,
            lat=request.lat,
            lon=request.lon,
            start_time=request.start_time,
            end_time=request.end_time,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/multi-risk-pdf")
async def run_multi_risk_pdf(request: MultiRiskRequest):
    """Generate PDF report for multi-risk analysis."""
    try:
        thresholds = {
            key: {
                "operational_max": value.operational_max,
                "attention_max": value.attention_max,
            }
            for key, value in request.thresholds.items()
        }

        supported_hazards = [hazard for hazard in request.hazards if hazard in {"wind", "wave"}]
        hazards = supported_hazards or ["wind", "wave"]
        selected_thresholds = {hazard: thresholds[hazard] for hazard in hazards if hazard in thresholds}

        climada_result = _run_climada_analysis(
            lat=request.lat,
            lon=request.lon,
            hazards=hazards,
            thresholds=selected_thresholds,
            start_time=request.start_time,
            end_time=request.end_time,
            asset_value=request.asset_value,
            attention_loss_factor=request.attention_loss_factor,
            stop_loss_factor=request.stop_loss_factor,
            exceedance_method=request.exceedance_method,
            risk_load_method=request.risk_load_method,
            risk_quantile=request.risk_quantile,
            expense_ratio=request.expense_ratio,
            asset_type="platform",
        )

        result = _build_multi_risk_response_from_climada(
            result=climada_result,
            thresholds=selected_thresholds,
            combine_mode=request.combine_mode,
            stop_cost_per_hour=request.stop_cost_per_hour,
            include_series=True,
            lat=request.lat,
            lon=request.lon,
            start_time=request.start_time,
            end_time=request.end_time,
        )

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(40, height - 40, "Relatorio de Analise Multi-Risco")

        pdf.setFont("Helvetica", 10)
        pdf.drawString(40, height - 60, f"Periodo: {request.start_time} a {request.end_time}")
        pdf.drawString(40, height - 75, f"Ponto: {request.lat:.5f}, {request.lon:.5f}")
        pdf.drawString(40, height - 90, f"Riscos: {', '.join(request.hazards)}")
        pdf.drawString(40, height - 105, f"Combinacao: {request.combine_mode}")

        y = height - 120
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(40, y, "Resumo por risco")
        y -= 16
        pdf.setFont("Helvetica", 10)
        for hazard, data in result["hazards"].items():
            pdf.drawString(
                40,
                y,
                f"{hazard}: media {data['mean']:.2f}, max {data['max']:.2f}, parada {data['stop_hours']}h",
            )
            y -= 14

        combined = result["combined"]
        y -= 6
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(40, y, "Resumo combinado")
        y -= 16
        pdf.setFont("Helvetica", 10)
        pdf.drawString(
            40,
            y,
            f"Operacional {combined['operational_hours']}h | Atencao {combined['attention_hours']}h | Parada {combined['stop_hours']}h",
        )
        y -= 14
        if result.get("pricing"):
            pdf.drawString(40, y, f"Custo total: {result['pricing']['total_cost']:.2f}")

        if result.get("metrics"):
            y -= 18
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(40, y, "Metricas (media, max, p50, p90, p95, p99)")
            y -= 14
            pdf.setFont("Helvetica", 9)
            for key, metrics in result["metrics"].items():
                pdf.drawString(
                    40,
                    y,
                    f"{key}: {metrics['mean']:.2f} | {metrics['max']:.2f} | {metrics['p50']:.2f} | {metrics['p90']:.2f} | {metrics['p95']:.2f} | {metrics['p99']:.2f}",
                )
                y -= 12

        if result.get("insights"):
            y -= 20
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(40, y, "Insights")
            pdf.setFont("Helvetica", 10)
            for insight in result["insights"]:
                y -= 14
                pdf.drawString(40, y, insight)

        pdf.showPage()

        # Charts
        time_values = np.array(result["time"], dtype="datetime64[ns]")
        for hazard, values in result.get("series", {}).items():
            if hazard == "wind_direction_deg":
                continue

            fig, axes = plt.subplots(3, 1, figsize=(6.5, 7))
            axes[0].plot(time_values, values)
            axes[0].set_title(f"Serie temporal - {hazard}")
            axes[0].set_ylabel(hazard)

            dist = result.get("distributions", {}).get(hazard, {})
            axes[1].bar(dist.get("hist_bins", []), dist.get("hist_counts", []), width=0.8)
            axes[1].set_title("Histograma")
            axes[1].set_ylabel("Frequencia")

            axes[2].plot(dist.get("exceedance_values", []), dist.get("exceedance_probs", []))
            axes[2].set_title("Excedencia")
            axes[2].set_xlabel("Valor")
            axes[2].set_ylabel("Prob.")

            fig.autofmt_xdate()
            fig.tight_layout()
            img_buf = BytesIO()
            fig.savefig(img_buf, format="png", dpi=150, bbox_inches="tight")
            plt.close(fig)
            img_buf.seek(0)
            pdf.drawImage(ImageReader(img_buf), 30, 80, width=550, height=720)
            pdf.showPage()

        combined_exc = result.get("combined_exceedance", {})
        if combined_exc.get("values"):
            fig, ax = plt.subplots(figsize=(6.5, 4))
            ax.plot(combined_exc.get("values", []), combined_exc.get("probs", []))
            ax.set_title("Excedencia combinada")
            ax.set_xlabel("Severidade combinada")
            ax.set_ylabel("Prob.")
            fig.tight_layout()
            img_buf = BytesIO()
            fig.savefig(img_buf, format="png", dpi=150, bbox_inches="tight")
            plt.close(fig)
            img_buf.seek(0)
            pdf.drawImage(ImageReader(img_buf), 30, 200, width=550, height=400)
            pdf.showPage()

        wind_rose = result.get("wind_rose")
        if wind_rose and wind_rose.get("counts"):
            counts = np.array(wind_rose["counts"], dtype=float)
            labels = wind_rose["bins"]
            angles = np.linspace(0, 2 * np.pi, len(counts), endpoint=False)
            fig = plt.figure(figsize=(6, 6))
            ax = fig.add_subplot(111, projection="polar")
            ax.bar(angles, counts, width=(2 * np.pi / len(counts)), bottom=0.0)
            ax.set_title("Rosa dos ventos")
            ax.set_xticks(angles)
            ax.set_xticklabels(labels, fontsize=7)
            fig.tight_layout()
            img_buf = BytesIO()
            fig.savefig(img_buf, format="png", dpi=150, bbox_inches="tight")
            plt.close(fig)
            img_buf.seek(0)
            pdf.drawImage(ImageReader(img_buf), 60, 140, width=480, height=480)
            pdf.showPage()

        pdf.save()
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=analise-multi-risco.pdf"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/maritime-downtime")
async def run_maritime_downtime(request: MaritimeDowntimeRequest):
    """Run maritime downtime analysis for a point (route support planned via waypoints)."""
    try:
        lat, lon = _resolve_point_from_request(request.lat, request.lon, request.waypoints)

        hazards: List[str] = ["wind"]
        thresholds: Dict[str, Dict[str, float]] = {
            "wind": {
                "operational_max": float(request.wind_limits.operational),
                "attention_max": float(request.wind_limits.attention),
            }
        }

        if request.wave_limits is not None:
            hazards.append("wave")
            thresholds["wave"] = {
                "operational_max": float(request.wave_limits.operational),
                "attention_max": float(request.wave_limits.attention),
            }

        climada_result = _run_climada_analysis(
            lat=lat,
            lon=lon,
            hazards=hazards,
            thresholds=thresholds,
            start_time=request.start_time,
            end_time=request.end_time,
            asset_value=request.asset_value,
            attention_loss_factor=request.attention_loss_factor,
            stop_loss_factor=request.stop_loss_factor,
            exceedance_method=request.exceedance_method,
            risk_load_method=request.risk_load_method,
            risk_quantile=request.risk_quantile,
            expense_ratio=request.expense_ratio,
            asset_type=request.vessel_type or "platform",
        )

        result = _build_multi_risk_response_from_climada(
            result=climada_result,
            thresholds=thresholds,
            combine_mode="worst",
            stop_cost_per_hour=float(request.downtime_cost_per_hour),
            include_series=False,
            lat=lat,
            lon=lon,
            start_time=request.start_time,
            end_time=request.end_time,
        )

        combined = result.get("combined", {})
        pricing_models = result.get("pricing_models") or {}
        pricing = result.get("pricing") or {}

        return {
            "vessel_name": request.vessel_name,
            "vessel_type": request.vessel_type,
            "lat": lat,
            "lon": lon,
            "operational_hours": int(combined.get("operational_hours", 0)),
            "attention_hours": int(combined.get("attention_hours", 0)),
            "stop_hours": int(combined.get("stop_hours", 0)),
            "total_hours": int(combined.get("total_hours", 0)),
            "total_downtime_cost": float(pricing.get("total_cost", 0.0)),
            "aal": float(pricing_models.get("aal", 0.0)),
            "pml": float(pricing_models.get("pml", 0.0)),
            "pricing_engine": result.get("pricing_engine"),
            "petals_enabled": bool(result.get("petals_enabled", False)),
            "insights": result.get("insights", []),
            "route_mode": bool(request.waypoints),
            "route_supported": False,
            "route_note": "Análise de rota completa será disponibilizada em uma próxima fase.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/climate-risk-offshore")
async def run_climate_risk_offshore(request: ClimateRiskOffshoreRequest):
    """Run offshore climate risk analysis using available hazards and CLIMADA pricing."""
    try:
        supported_hazards = [hazard for hazard in request.hazards if hazard in {"wind", "wave"}]
        hazards = supported_hazards or ["wind", "wave"]

        thresholds = {
            "wind": {
                "operational_max": float(request.wind_operational_max),
                "attention_max": float(max(request.wind_attention_max, request.wind_operational_max)),
            },
            "wave": {
                "operational_max": float(request.wave_operational_max),
                "attention_max": float(max(request.wave_attention_max, request.wave_operational_max)),
            },
        }

        selected_thresholds = {hazard: thresholds[hazard] for hazard in hazards if hazard in thresholds}

        baseline_start_time = "2020-01-01"
        baseline_end_time = "2023-12-31"
        if request.enable_scenarios and request.scenario is not None:
            baseline_start_time, baseline_end_time = climate_risk_adapter.period_to_dates(
                request.scenario.historical_period,
                default_start="2020-01-01",
                default_end="2023-12-31",
            )

        result = climada_wind_wave_service.analyze_point(
            lat=float(request.lat),
            lon=float(request.lon),
            asset_type=request.asset_type,
            hazards=hazards,
            start_time=baseline_start_time,
            end_time=baseline_end_time,
            thresholds=selected_thresholds,
            asset_value=float(request.asset_value),
            attention_loss_factor=request.attention_loss_factor,
            stop_loss_factor=request.stop_loss_factor,
            exceedance_method=request.exceedance_method,
            risk_load_method=request.risk_load_method,
            risk_quantile=request.risk_quantile,
            expense_ratio=request.expense_ratio,
        )

        pricing_models = result.get("pricing_models") or {}
        financial_outputs = climate_risk_kernel.build_financial_outputs(
            pricing_models=pricing_models,
            pricing=result.get("pricing") if isinstance(result, dict) else None,
        )

        assumptions = {
            "lat": float(request.lat),
            "lon": float(request.lon),
            "asset_type": request.asset_type,
            "asset_value": float(request.asset_value),
            "hazards": hazards,
            "baseline_start_time": baseline_start_time,
            "baseline_end_time": baseline_end_time,
            "thresholds": selected_thresholds,
            "attention_loss_factor": request.attention_loss_factor,
            "stop_loss_factor": request.stop_loss_factor,
            "exceedance_method": request.exceedance_method,
            "risk_load_method": request.risk_load_method,
            "risk_quantile": request.risk_quantile,
            "expense_ratio": request.expense_ratio,
            "enable_scenarios": request.enable_scenarios,
            "scenario": request.scenario.model_dump() if request.scenario is not None else None,
        }

        response = {
            "analysis_mode": "offshore",
            "lat": float(request.lat),
            "lon": float(request.lon),
            "asset_type": request.asset_type,
            "hazards": hazards,
            "aal": float(pricing_models.get("aal", 0.0)),
            "pml": float(pricing_models.get("pml", 0.0)),
            "financial_outputs": financial_outputs,
            "traceability": climate_risk_kernel.build_traceability(
                analysis_mode="offshore",
                assumptions=assumptions,
            ),
            "pricing_engine": result.get("pricing_engine"),
            "petals_enabled": bool(result.get("petals_enabled", False)),
            "hazard_metrics": result.get("hazards", {}),
            "hazard_breakdown": result.get("hazard_breakdown", {}),
            "vulnerability_profile": result.get("vulnerability_profile", {}),
            "climada_graphs": result.get("climada_graphs", {}),
            "insights": result.get("insights", []),
        }

        if request.enable_scenarios and request.scenario is not None:
            response["scenario_comparison"] = climate_risk_adapter.build_scenario_response(
                lat=float(request.lat),
                lon=float(request.lon),
                hazards=hazards,
                ssp_scenario=request.scenario.ssp_scenario,
                historical_period=request.scenario.historical_period,
                future_period=request.scenario.future_period,
                base_aal=float(pricing_models.get("aal", 0.0)),
                base_pml=float(pricing_models.get("pml", 0.0)),
            )

        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/climate-risk-onshore")
async def run_climate_risk_onshore(request: ClimateRiskOnshoreRequest):
    """Run onshore climate risk analysis with optional population proxy metrics."""
    try:
        supported_hazards = [hazard for hazard in request.hazards if hazard in {"wind", "wave"}]
        hazards = supported_hazards or ["wind", "wave"]

        baseline_start_time = "2020-01-01"
        baseline_end_time = "2023-12-31"
        if request.enable_scenarios and request.scenario is not None:
            baseline_start_time, baseline_end_time = climate_risk_adapter.period_to_dates(
                request.scenario.historical_period,
                default_start="2020-01-01",
                default_end="2023-12-31",
            )

        selected_thresholds = {
            "wind": {
                "operational_max": float(request.wind_operational_max),
                "attention_max": float(max(request.wind_attention_max, request.wind_operational_max)),
            },
            "wave": {
                "operational_max": float(request.wave_operational_max),
                "attention_max": float(max(request.wave_attention_max, request.wave_operational_max)),
            },
        }

        result = climada_wind_wave_service.analyze_point(
            lat=float(request.lat),
            lon=float(request.lon),
            asset_type=request.asset_type,
            hazards=hazards,
            start_time=baseline_start_time,
            end_time=baseline_end_time,
            thresholds=selected_thresholds,
            asset_value=float(request.asset_value),
            attention_loss_factor=request.attention_loss_factor,
            stop_loss_factor=request.stop_loss_factor,
            exceedance_method=request.exceedance_method,
            risk_load_method=request.risk_load_method,
            risk_quantile=request.risk_quantile,
            expense_ratio=request.expense_ratio,
        )

        pricing_models = result.get("pricing_models") or {}
        financial_outputs = climate_risk_kernel.build_financial_outputs(
            pricing_models=pricing_models,
            pricing=result.get("pricing") if isinstance(result, dict) else None,
        )

        combined = result.get("combined", {})
        total_hours = max(int(combined.get("total_hours", 0)), 1)
        stop_hours = int(combined.get("stop_hours", 0))
        stop_ratio = float(stop_hours) / float(total_hours)

        total_population = 0
        affected_population = 0
        population_source = None
        population_note = None
        population_scope = None
        if request.include_population:
            population_payload = litpop_population_service.compute_population_metrics(
                lat=float(request.lat),
                lon=float(request.lon),
                stop_ratio=stop_ratio,
                exposure_reference=result.get("exposure_reference"),
                state_name=request.state_name,
            )
            total_population = int(population_payload.get("total_population", 0))
            affected_population = int(population_payload.get("affected_population", 0))
            population_source = population_payload.get("population_source")
            population_note = population_payload.get("population_note")
            population_scope = population_payload.get("population_scope")

        assumptions = {
            "lat": float(request.lat),
            "lon": float(request.lon),
            "asset_type": request.asset_type,
            "asset_value": float(request.asset_value),
            "state_name": request.state_name,
            "include_population": request.include_population,
            "hazards": hazards,
            "baseline_start_time": baseline_start_time,
            "baseline_end_time": baseline_end_time,
            "thresholds": selected_thresholds,
            "attention_loss_factor": request.attention_loss_factor,
            "stop_loss_factor": request.stop_loss_factor,
            "exceedance_method": request.exceedance_method,
            "risk_load_method": request.risk_load_method,
            "risk_quantile": request.risk_quantile,
            "expense_ratio": request.expense_ratio,
            "enable_scenarios": request.enable_scenarios,
            "scenario": request.scenario.model_dump() if request.scenario is not None else None,
            "population_source": population_source,
        }

        response = {
            "analysis_mode": "onshore",
            "lat": float(request.lat),
            "lon": float(request.lon),
            "asset_type": request.asset_type,
            "state_name": request.state_name,
            "hazards": hazards,
            "aal": float(pricing_models.get("aal", 0.0)),
            "pml": float(pricing_models.get("pml", 0.0)),
            "financial_outputs": financial_outputs,
            "traceability": climate_risk_kernel.build_traceability(
                analysis_mode="onshore",
                assumptions=assumptions,
            ),
            "total_population": total_population,
            "affected_population": affected_population,
            "population_source": population_source,
            "population_note": population_note,
            "population_scope": population_scope,
            "pricing_engine": result.get("pricing_engine"),
            "petals_enabled": bool(result.get("petals_enabled", False)),
            "hazard_metrics": result.get("hazards", {}),
            "hazard_breakdown": result.get("hazard_breakdown", {}),
            "vulnerability_profile": result.get("vulnerability_profile", {}),
            "climada_graphs": result.get("climada_graphs", {}),
            "insights": result.get("insights", []),
        }

        if request.enable_scenarios and request.scenario is not None:
            response["scenario_comparison"] = climate_risk_adapter.build_scenario_response(
                lat=float(request.lat),
                lon=float(request.lon),
                hazards=hazards,
                ssp_scenario=request.scenario.ssp_scenario,
                historical_period=request.scenario.historical_period,
                future_period=request.scenario.future_period,
                base_aal=float(pricing_models.get("aal", 0.0)),
                base_pml=float(pricing_models.get("pml", 0.0)),
            )

        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/climate-risk-offshore-pdf")
async def run_climate_risk_offshore_pdf(request: ClimateRiskOffshoreRequest):
    """Generate PDF report for offshore climate risk analysis."""
    try:
        result = await run_climate_risk_offshore(request)
        pdf_buffer = _build_climate_risk_pdf(
            title="Relatorio de Risco Climatico Offshore",
            request=request,
            result=result,
        )
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=climate-risk-offshore.pdf"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/climate-risk-onshore-pdf")
async def run_climate_risk_onshore_pdf(request: ClimateRiskOnshoreRequest):
    """Generate PDF report for onshore climate risk analysis."""
    try:
        result = await run_climate_risk_onshore(request)
        pdf_buffer = _build_climate_risk_pdf(
            title="Relatorio de Risco Climatico Onshore",
            request=request,
            result=result,
        )
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=climate-risk-onshore.pdf"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{analysis_id}/status")
async def get_analysis_status(analysis_id: str):
    """Get status of an analysis"""
    logger.info(f"Getting status for analysis: {analysis_id}")
    
    # TODO: Query database
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "progress": 50,
        "eta_seconds": 120
    }

@router.get("/{analysis_id}/results")
async def get_analysis_results(analysis_id: str):
    """Get results of a completed analysis"""
    logger.info(f"Getting results for analysis: {analysis_id}")
    
    # TODO: Fetch from database/cache
    
    return {
        "analysis_id": analysis_id,
        "hazard_type": "wind",
        "results": {},
        "statistics": {}
    }

@router.delete("/{analysis_id}")
async def delete_analysis(analysis_id: str):
    """Delete an analysis"""
    logger.info(f"Deleting analysis: {analysis_id}")
    
    # TODO: Delete from database
    
    return {
        "analysis_id": analysis_id,
        "status": "deleted"
    }
