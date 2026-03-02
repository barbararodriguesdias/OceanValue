from fastapi import APIRouter, HTTPException
from typing import Optional
import xarray as xr
import os

router = APIRouter()

@router.get("/netcdf-bbox")
def get_netcdf_bbox(region: str, period: str, hazard: str) -> dict:
    """
    Retorna o bounding box (GeoJSON Polygon) do NetCDF selecionado para a região/periodo/hazard.
    """
    # Ajuste o caminho base conforme seu projeto
    base_dir = "D:/OceanPact/Netcdf"
    # Busca arquivo NetCDF
    for root, dirs, files in os.walk(os.path.join(base_dir, period, hazard)):
        for file in files:
            if file.endswith('.nc'):
                file_path = os.path.join(root, file)
                ds = xr.open_dataset(file_path)
                lats = ds['lat'].values
                lons = ds['lon'].values
                min_lat, max_lat = float(lats.min()), float(lats.max())
                min_lon, max_lon = float(lons.min()), float(lons.max())
                ds.close()
                # GeoJSON Polygon (retângulo)
                return {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [min_lon, min_lat],
                            [min_lon, max_lat],
                            [max_lon, max_lat],
                            [max_lon, min_lat],
                            [min_lon, min_lat]
                        ]]
                    },
                    "properties": {
                        "region": region,
                        "period": period,
                        "hazard": hazard,
                        "file": file
                    }
                }
    raise HTTPException(status_code=404, detail="Arquivo NetCDF não encontrado para os parâmetros informados.")
