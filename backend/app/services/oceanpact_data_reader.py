import os
import xarray as xr
from typing import Optional

def get_netcdf_series(file_path: str, variable: str, lat: float, lon: float):
    ds = xr.open_dataset(file_path)
    # Seleção do ponto mais próximo
    point = ds.sel(lat=lat, lon=lon, method='nearest')
    series = point[variable]
    # Retorna toda a série temporal disponível
    return series

def find_netcdf_file(base_dir: str, hazard: str, period: str):
    # Exemplo: hazard='onda' ou 'vento', period='historico', etc
    # Busca arquivos NetCDF na estrutura esperada
    for root, dirs, files in os.walk(os.path.join(base_dir, period, hazard)):
        for file in files:
            if file.endswith('.nc'):
                return os.path.join(root, file)
    return None
