from pathlib import Path

path = Path(r"c:/Users/Barbara.dias/Downloads/OceanValue/backend/app/services/climada_wind_wave_service.py")
text = path.read_text()

needle = 'response["uncertainty"]'
first = text.find(needle)
second = text.find(needle, first + 1)
if first == -1:
    raise SystemExit("uncertainty block not found")
if second == -1:
    raise SystemExit("second uncertainty block not found")

# Remove everything from the first block start up to the second occurrence
cleaned = text[:first] + text[second:]
path.write_text(cleaned)
print("cleaned uncertainty blocks")
