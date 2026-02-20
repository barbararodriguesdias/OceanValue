// Climate API service for frontend.

const API_BASE = "http://localhost:8000/api/v1/climate";

export interface ClimateVariable {
  name: string;
  description: string;
}

export interface DataPoint {
  time: string;
  value: number;
}

export interface GridData {
  lat: number[];
  lon: number[];
  values: number[][];
  time: string;
}

export interface Statistics {
  mean: number;
  min: number;
  max: number;
  std: number;
}

export const climateDataService = {
  async getVariables(): Promise<Record<string, string>> {
    const response = await fetch(`${API_BASE}/variables`);
    const data = await response.json();
    return data.descriptions;
  },

  async getMetadata() {
    const response = await fetch(`${API_BASE}/metadata`);
    return response.json();
  },

  async getTimeseries(
    variable: string,
    lat: number,
    lon: number,
    startTime?: string,
    endTime?: string
  ) {
    const params = new URLSearchParams({
      variable,
      lat: lat.toString(),
      lon: lon.toString(),
      ...(startTime && { start_time: startTime }),
      ...(endTime && { end_time: endTime }),
    });

    const response = await fetch(`${API_BASE}/timeseries?${params}`);
    return response.json();
  },

  async getStatistics(
    variable: string,
    startTime?: string,
    endTime?: string,
    latMin?: number,
    latMax?: number,
    lonMin?: number,
    lonMax?: number
  ): Promise<Statistics> {
    const params = new URLSearchParams({
      variable,
      ...(startTime && { start_time: startTime }),
      ...(endTime && { end_time: endTime }),
      ...(latMin !== undefined && { lat_min: latMin.toString() }),
      ...(latMax !== undefined && { lat_max: latMax.toString() }),
      ...(lonMin !== undefined && { lon_min: lonMin.toString() }),
      ...(lonMax !== undefined && { lon_max: lonMax.toString() }),
    });

    const response = await fetch(`${API_BASE}/statistics?${params}`);
    return response.json();
  },

  async getSpatialAverage(
    variable: string,
    startTime?: string,
    endTime?: string,
    latMin?: number,
    latMax?: number,
    lonMin?: number,
    lonMax?: number
  ) {
    const params = new URLSearchParams({
      variable,
      ...(startTime && { start_time: startTime }),
      ...(endTime && { end_time: endTime }),
      ...(latMin !== undefined && { lat_min: latMin.toString() }),
      ...(latMax !== undefined && { lat_max: latMax.toString() }),
      ...(lonMin !== undefined && { lon_min: lonMin.toString() }),
      ...(lonMax !== undefined && { lon_max: lonMax.toString() }),
    });

    const response = await fetch(`${API_BASE}/spatial-average?${params}`);
    return response.json();
  },

  async getSnapshot(
    variable: string,
    time: string,
    latMin?: number,
    latMax?: number,
    lonMin?: number,
    lonMax?: number
  ): Promise<GridData> {
    const params = new URLSearchParams({
      variable,
      time,
      ...(latMin !== undefined && { lat_min: latMin.toString() }),
      ...(latMax !== undefined && { lat_max: latMax.toString() }),
      ...(lonMin !== undefined && { lon_min: lonMin.toString() }),
      ...(lonMax !== undefined && { lon_max: lonMax.toString() }),
    });

    const response = await fetch(`${API_BASE}/snapshot?${params}`);
    return response.json();
  },
};

