import shapefile

# Extensão espacial dos dados
min_lon = -55
max_lon = -25
min_lat = -27
max_lat = 0

# Cria shapefile poligonal
w = shapefile.Writer('bounding_box_dados.shp', shapeType=shapefile.POLYGON)
w.field('ID', 'N')

# Define o polígono (retângulo)
polygon = [
    [min_lon, min_lat],
    [min_lon, max_lat],
    [max_lon, max_lat],
    [max_lon, min_lat],
    [min_lon, min_lat]
]
w.poly([polygon])
w.record(1)
w.close()

print('Shapefile bounding_box_dados.shp criado com sucesso.')
