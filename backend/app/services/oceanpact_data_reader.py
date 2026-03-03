import os
import xarray as xr
from typing import Optional


def _find_coord(ds: xr.Dataset, candidates: list[str]) -> str:
    for name in candidates:
        if name in ds.coords:
            return name
    raise KeyError(f"Nenhuma coordenada encontrada entre: {candidates}")


def get_netcdf_series(file_path: str, variable: str, lat: float, lon: float):
    """Abre o NetCDF, descobre nomes de latitude/longitude e retorna a série do ponto."""
    with xr.open_dataset(file_path) as ds:
        lat_name = _find_coord(ds, ["lat", "latitude", "y"])
        lon_name = _find_coord(ds, ["lon", "longitude", "x"])
        var_name = variable if variable in ds.data_vars else list(ds.data_vars)[0]
        point = ds[var_name].sel({lat_name: lat, lon_name: lon}, method="nearest")
        return point.load()

def find_netcdf_file(base_dir: str, hazard: str, period: str):
    # Exemplo: hazard='onda' ou 'vento', period='historico', etc
    # Busca arquivos NetCDF na estrutura esperada
    for root, dirs, files in os.walk(os.path.join(base_dir, period, hazard)):
        for file in files:
            if file.endswith('.nc'):
                return os.path.join(root, file)
    return None
