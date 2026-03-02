from ..services.netcdf_reader import netcdf_reader
"""Climate data API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import os
import httpx
from ..services.zarr_reader import zarr_reader
from ..services.cmems_current import cmems_current_reader
from ..services.climada_wind_wave_service import climada_wind_wave_service

router = APIRouter()


@router.get("/variables")
async def get_available_variables():
    """Get list of available climate variables."""
    try:
        return {
            "variables": netcdf_reader.get_available_variables(),
            "descriptions": {
                "hs": "Significant wave height (m)",
                "tp": "Wave period (s)",
                "u10": "10m U wind component (m/s)",
                "v10": "10m V wind component (m/s)",
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metadata")
async def get_dataset_metadata():
    """Get dataset metadata (time range, spatial bounds)."""
    try:
        time_range = netcdf_reader.get_time_range()
        spatial_bounds = netcdf_reader.get_spatial_bounds()
        
        return {
            "time_range": {
                "start": time_range[0].isoformat(),
                "end": time_range[1].isoformat(),
            },
            "spatial_bounds": spatial_bounds,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timeseries")
async def get_timeseries(
    variable: str = Query(..., description="Variable name (hs, tp, u10, v10)"),
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    start_time: Optional[str] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time (ISO format)"),
):
    """Get time series at a specific point."""
    try:
        data = netcdf_reader.get_timeseries_at_point(
            variable, lat, lon, start_time, end_time
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics(
    variable: str = Query(..., description="Variable name"),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
):
    """Get statistics for queried region and time period."""
    try:
        stats = netcdf_reader.get_statistics(
            variable, start_time, end_time,
            lat_min, lat_max, lon_min, lon_max
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/spatial-average")
async def get_spatial_average(
    variable: str = Query(..., description="Variable name"),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
):
    """Get spatial average time series for a region."""
    try:
        data = netcdf_reader.get_spatial_average(
            variable, start_time, end_time,
            lat_min, lat_max, lon_min, lon_max
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/snapshot")
async def get_snapshot(
    variable: str = Query(..., description="Variable name"),
    time: str = Query(..., description="Time (ISO format)"),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
):
    """Get 2D grid snapshot at a specific time."""
    try:
        data = netcdf_reader.get_grid_snapshot(
            variable, time,
            lat_min, lat_max, lon_min, lon_max
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/current-snapshot")
async def get_current_snapshot(
    time: str = Query(..., description="Time (ISO format)"),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
):
    """Proxy current snapshot from external API without local storage."""
    base_url = os.getenv("CURRENT_API_URL")

    if os.getenv("CMEMS_DATASET_ID") or os.getenv("CMEMS_USERNAME"):
        try:
            return cmems_current_reader.get_current_snapshot(
                time=time,
                lat_min=lat_min,
                lat_max=lat_max,
                lon_min=lon_min,
                lon_max=lon_max,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    if not base_url:
        raise HTTPException(
            status_code=501,
            detail="Configure CMEMS_* ou CURRENT_API_URL no backend",
        )

    params: dict[str, str] = {"time": str(time)}
    if lat_min is not None:
        params["lat_min"] = str(lat_min)
    if lat_max is not None:
        params["lat_max"] = str(lat_max)
    if lon_min is not None:
        params["lon_min"] = str(lon_min)
    if lon_max is not None:
        params["lon_max"] = str(lon_max)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/wind-snapshot")
async def get_wind_snapshot(
    time: str = Query(..., description="Time (ISO format)"),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    stat: str = Query("mean", description="mean or max"),
):
    """Get wind snapshot from ERA5 Zarr with operational status."""
    try:
<<<<<<< HEAD
        return zarr_reader.get_wind_hazard_snapshot(
=======
        return netcdf_reader.get_wind_hazard_snapshot(
>>>>>>> 679b437a955223e69a5f4efba330a4210e250337
            time=time,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wind-hazard-snapshot")
async def get_wind_hazard_snapshot(
    time: str = Query(..., description="Time (ISO format)"),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    operational_max_knots: float = Query(15.0, description="Operational max wind (knots)"),
    attention_max_knots: float = Query(20.0, description="Attention max wind (knots)"),
):
    """Get wind hazard snapshot from ERA5 Zarr with speed/direction/status."""
    try:
        return netcdf_reader.get_wind_hazard_snapshot(
            time=time,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            operational_limit_knots=operational_max_knots,
            attention_limit_knots=attention_max_knots,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wave-snapshot")
async def get_wave_snapshot(
    time: str = Query(..., description="Time (ISO format)"),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lon_min: Optional[float] = Query(None),
    lon_max: Optional[float] = Query(None),
    stat: str = Query("mean", description="mean or max"),
):
    """Get wave snapshot from ERA5 Zarr dataset."""
    try:
<<<<<<< HEAD
        return zarr_reader.get_grid_snapshot("hs", time, lat_min, lat_max, lon_min, lon_max)
=======
        return netcdf_reader.get_grid_snapshot("hs", time, lat_min, lat_max, lon_min, lon_max)
>>>>>>> 679b437a955223e69a5f4efba330a4210e250337
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wind-scenario-comparison")
async def get_wind_scenario_comparison(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    scenario: str = Query("ssp585", description="Scenario id (currently: ssp585)"),
    stat: str = Query("mean", description="mean or max"),
    historical_period: str = Query("1985-2014", description="Historical period (YYYY-YYYY)"),
    future_period: str = Query("2035-2064", description="Future period (YYYY-YYYY)"),
    operational_max_knots: float = Query(15.0, description="Operational max wind (knots)"),
    attention_max_knots: float = Query(20.0, description="Attention max wind (knots)"),
):
    """Compare historical vs future wind conditions using CLIMADA impact calculations."""
    try:
        return climada_wind_wave_service.get_scenario_comparison(
            hazard_name="wind",
            lat=lat,
            lon=lon,
            scenario=scenario,
            stat=stat,
            historical_period=historical_period,
            future_period=future_period,
            operational_max=operational_max_knots,
            attention_max=attention_max_knots,
        )
    except FileNotFoundError as e:
        return {
            "available": False,
            "message": str(e),
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
            "historical": {
                "samples": 0,
                "mean_knots": 0.0,
                "p90_knots": 0.0,
                "p95_knots": 0.0,
                "max_knots": 0.0,
                "operational_samples": 0,
                "attention_samples": 0,
                "stop_samples": 0,
            },
            "future": {
                "samples": 0,
                "mean_knots": 0.0,
                "p90_knots": 0.0,
                "p95_knots": 0.0,
                "max_knots": 0.0,
                "operational_samples": 0,
                "attention_samples": 0,
                "stop_samples": 0,
            },
            "delta": {
                "mean_knots": 0.0,
                "p95_knots": 0.0,
                "stop_samples": 0,
            },
            "series": {
                "historical_years": [],
                "historical_yearly_mean_knots": [],
                "future_years": [],
                "future_yearly_mean_knots": [],
                "monthly_labels": [f"{month:02d}" for month in range(1, 13)],
                "historical_monthly_mean_knots": [None for _ in range(12)],
                "future_monthly_mean_knots": [None for _ in range(12)],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wave-scenario-comparison")
async def get_wave_scenario_comparison(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    scenario: str = Query("ssp585", description="Scenario id (currently: ssp585)"),
    stat: str = Query("mean", description="mean or max"),
    historical_period: str = Query("1985-2014", description="Historical period (YYYY-YYYY)"),
    future_period: str = Query("2035-2064", description="Future period (YYYY-YYYY)"),
    operational_max_meters: float = Query(2.0, description="Operational max wave height (m)"),
    attention_max_meters: float = Query(4.0, description="Attention max wave height (m)"),
):
    """Compare historical vs future wave conditions using CLIMADA impact calculations."""
    try:
        return climada_wind_wave_service.get_scenario_comparison(
            hazard_name="wave",
            lat=lat,
            lon=lon,
            scenario=scenario,
            stat=stat,
            historical_period=historical_period,
            future_period=future_period,
            operational_max=operational_max_meters,
            attention_max=attention_max_meters,
        )
    except FileNotFoundError as e:
        return {
            "available": False,
            "message": str(e),
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
            "historical": {
                "samples": 0,
                "mean_meters": 0.0,
                "p90_meters": 0.0,
                "p95_meters": 0.0,
                "max_meters": 0.0,
                "operational_samples": 0,
                "attention_samples": 0,
                "stop_samples": 0,
            },
            "future": {
                "samples": 0,
                "mean_meters": 0.0,
                "p90_meters": 0.0,
                "p95_meters": 0.0,
                "max_meters": 0.0,
                "operational_samples": 0,
                "attention_samples": 0,
                "stop_samples": 0,
            },
            "delta": {
                "mean_meters": 0.0,
                "p95_meters": 0.0,
                "stop_samples": 0,
            },
            "series": {
                "historical_years": [],
                "historical_yearly_mean_meters": [],
                "future_years": [],
                "future_yearly_mean_meters": [],
                "monthly_labels": [f"{month:02d}" for month in range(1, 13)],
                "historical_monthly_mean_meters": [None for _ in range(12)],
                "future_monthly_mean_meters": [None for _ in range(12)],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
