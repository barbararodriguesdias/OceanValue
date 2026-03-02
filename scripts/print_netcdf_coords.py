import xarray as xr
import os

# Directory containing NetCDF files
netcdf_dir = r'D:\OceanPact\Netcdf\preditivo\vento'

# List all NetCDF files in the directory
files = [f for f in os.listdir(netcdf_dir) if f.endswith('.nc')]

if not files:
    print('No NetCDF files found in', netcdf_dir)
else:
    for f in files:
        print(f'File: {f}')
        try:
            ds = xr.open_dataset(os.path.join(netcdf_dir, f))
            print('  Coordinates:', list(ds.coords))
            print('  Dimensions:', list(ds.dims))
            for var in ds.data_vars:
                print(f'  Variable: {var}')
                print('    dims:', ds[var].dims)
                print('    coords:', list(ds[var].coords))
            ds.close()
        except Exception as e:
            print(f'Error opening {f}:', e)
