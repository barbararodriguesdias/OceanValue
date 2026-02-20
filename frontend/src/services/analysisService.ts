const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TUNNEL_BYPASS_HEADERS = { 'bypass-tunnel-reminder': 'true' };

export interface WindRiskRequest {
  lat: number;
  lon: number;
  start_time: string;
  end_time: string;
  operational_max_knots: number;
  attention_max_knots: number;
  cost_attention_per_hour?: number;
  cost_stop_per_hour?: number;
}

export interface WindRiskResult {
  lat: number;
  lon: number;
  time: string[];
  speed_knots: number[];
  direction_deg: number[];
  status: number[];
  limits: {
    operational_max_knots: number;
    attention_max_knots: number;
  };
  summary: {
    total_hours: number;
    operational_hours: number;
    attention_hours: number;
    stop_hours: number;
  };
  pricing: {
    attention_cost: number;
    stop_cost: number;
    total_cost: number;
  } | null;
}

export interface MultiRiskRequest {
  lat: number;
  lon: number;
  start_time: string;
  end_time: string;
  hazards: string[];
  thresholds: Record<string, { operational_max: number; attention_max: number }>;
  stop_cost_per_hour?: number;
  combine_mode?: 'worst' | 'weighted' | 'multiplier';
  weights?: Record<string, number>;
  multiplier?: number;
  asset_value?: number;
  attention_loss_factor?: number;
  stop_loss_factor?: number;
  exceedance_method?: 'weibull' | 'hazen' | 'gringorten';
  risk_load_method?: 'none' | 'var' | 'tvar' | 'stdev';
  risk_quantile?: number;
  expense_ratio?: number;
  include_series?: boolean;
}

export interface MultiRiskResult {
  time: string[];
  hazards: Record<string, {
    mean: number;
    max: number;
    operational_hours: number;
    attention_hours: number;
    stop_hours: number;
    operational_max: number;
    attention_max: number;
  }>;
  distributions: Record<string, {
    hist_bins: number[];
    hist_counts: number[];
    exceedance_values: number[];
    exceedance_probs: number[];
  }>;
  combined: {
    operational_hours: number;
    attention_hours: number;
    stop_hours: number;
    total_hours: number;
  };
  combined_exceedance: {
    values: number[];
    probs: number[];
  };
  combine_mode: string;
  effective_stop_hours: number;
  pricing: {
    stop_cost: number;
    total_cost: number;
  } | null;
  pricing_models?: {
    asset_value: number;
    attention_loss_factor: number;
    stop_loss_factor: number;
    annualization_factor: number;
    aal: number;
    pml: number;
    var: number;
    tvar: number;
    risk_load_method: string;
    risk_load: number;
    expense_ratio: number;
    pure_premium: number;
    technical_premium: number;
    exceedance_method: string;
    risk_quantile: number;
  } | null;
  hazard_pricing_models?: Record<string, {
    asset_value: number;
    attention_loss_factor: number;
    stop_loss_factor: number;
    annualization_factor: number;
    aal: number;
    pml: number;
    var: number;
    tvar: number;
    risk_load_method: string;
    risk_load: number;
    expense_ratio: number;
    pure_premium: number;
    technical_premium: number;
    exceedance_method: string;
    risk_quantile: number;
    quantile_sensitivity: Array<{
      quantile: number;
      var: number;
      tvar: number;
      technical_premium: number;
    }>;
  }>;
  insights?: string[];
  metrics?: Record<string, {
    mean: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  }>;
  wind_rose?: {
    bins: string[];
    direction_labels?: string[];
    spoke_max_values?: number[];
    global_max_speed?: number;
    counts: number[];
    operational_counts?: number[];
    attention_counts?: number[];
    stop_counts?: number[];
    limits?: {
      operational_max: number;
      attention_max: number;
    };
  } | null;
  exposure_reference?: {
    source_name: string;
    source_path: string;
    nearest_distance_km: number;
    point: { lat: number; lon: number };
    bbox: {
      min_lon: number;
      max_lon: number;
      min_lat: number;
      max_lat: number;
    };
    boundary: {
      lon: number[];
      lat: number[];
    };
    exposure_points: {
      lon: number[];
      lat: number[];
      value: number[];
    };
    raster: {
      x_centers: number[];
      y_centers: number[];
      z: number[][];
    };
  } | null;
  series?: Record<string, number[]>;
}

export interface WindScenarioComparisonRequest {
  lat: number;
  lon: number;
  scenario?: 'ssp585';
  stat?: 'mean' | 'max';
  historical_period?: string;
  future_period?: string;
  operational_max_knots?: number;
  attention_max_knots?: number;
}

export interface WindScenarioComparisonResult {
  available?: boolean;
  message?: string;
  meta: {
    scenario: string;
    stat: string;
    lat: number;
    lon: number;
    historical_period: string;
    future_period: string;
    operational_max_knots: number;
    attention_max_knots: number;
  };
  historical: {
    samples: number;
    mean_knots: number;
    p90_knots: number;
    p95_knots: number;
    max_knots: number;
    operational_samples: number;
    attention_samples: number;
    stop_samples: number;
  };
  future: {
    samples: number;
    mean_knots: number;
    p90_knots: number;
    p95_knots: number;
    max_knots: number;
    operational_samples: number;
    attention_samples: number;
    stop_samples: number;
  };
  delta: {
    mean_knots: number;
    p95_knots: number;
    stop_samples: number;
  };
  series: {
    historical_years: number[];
    historical_yearly_mean_knots: number[];
    future_years: number[];
    future_yearly_mean_knots: number[];
    monthly_labels: string[];
    historical_monthly_mean_knots: Array<number | null>;
    future_monthly_mean_knots: Array<number | null>;
  };
}

export interface WaveScenarioComparisonRequest {
  lat: number;
  lon: number;
  scenario?: 'ssp585';
  stat?: 'mean' | 'max';
  historical_period?: string;
  future_period?: string;
  operational_max_meters?: number;
  attention_max_meters?: number;
}

export interface WaveScenarioComparisonResult {
  available?: boolean;
  message?: string;
  meta: {
    scenario: string;
    stat: string;
    lat: number;
    lon: number;
    historical_period: string;
    future_period: string;
    operational_max_meters: number;
    attention_max_meters: number;
  };
  historical: {
    samples: number;
    mean_meters: number;
    p90_meters: number;
    p95_meters: number;
    max_meters: number;
    operational_samples: number;
    attention_samples: number;
    stop_samples: number;
  };
  future: {
    samples: number;
    mean_meters: number;
    p90_meters: number;
    p95_meters: number;
    max_meters: number;
    operational_samples: number;
    attention_samples: number;
    stop_samples: number;
  };
  delta: {
    mean_meters: number;
    p95_meters: number;
    stop_samples: number;
  };
  series: {
    historical_years: number[];
    historical_yearly_mean_meters: number[];
    future_years: number[];
    future_yearly_mean_meters: number[];
    monthly_labels: string[];
    historical_monthly_mean_meters: Array<number | null>;
    future_monthly_mean_meters: Array<number | null>;
  };
}

export const analysisService = {
  async runWindRisk(request: WindRiskRequest): Promise<WindRiskResult> {
    const response = await fetch(`${API_BASE}/api/v1/analysis/wind-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_BYPASS_HEADERS },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Erro ao executar analise de vento');
    }

    return response.json();
  },
  async runMultiRisk(request: MultiRiskRequest): Promise<MultiRiskResult> {
    const response = await fetch(`${API_BASE}/api/v1/analysis/multi-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_BYPASS_HEADERS },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Erro ao executar analise multi-risco');
    }

    return response.json();
  },
  async downloadMultiRiskPdf(request: MultiRiskRequest): Promise<Blob> {
    const response = await fetch(`${API_BASE}/api/v1/analysis/multi-risk-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TUNNEL_BYPASS_HEADERS },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Erro ao gerar PDF');
    }

    return response.blob();
  },
  async getWindScenarioComparison(request: WindScenarioComparisonRequest): Promise<WindScenarioComparisonResult> {
    const params = new URLSearchParams({
      lat: String(request.lat),
      lon: String(request.lon),
      scenario: request.scenario ?? 'ssp585',
      stat: request.stat ?? 'mean',
      historical_period: request.historical_period ?? '1985-2014',
      future_period: request.future_period ?? '2035-2064',
      operational_max_knots: String(request.operational_max_knots ?? 15),
      attention_max_knots: String(request.attention_max_knots ?? 20),
    });

    const response = await fetch(`${API_BASE}/api/v1/climate/wind-scenario-comparison?${params.toString()}`, {
      headers: { ...TUNNEL_BYPASS_HEADERS },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Erro ao carregar comparação de cenário de vento');
    }

    return response.json();
  },
  async getWaveScenarioComparison(request: WaveScenarioComparisonRequest): Promise<WaveScenarioComparisonResult> {
    const params = new URLSearchParams({
      lat: String(request.lat),
      lon: String(request.lon),
      scenario: request.scenario ?? 'ssp585',
      stat: request.stat ?? 'mean',
      historical_period: request.historical_period ?? '1985-2014',
      future_period: request.future_period ?? '2035-2064',
      operational_max_meters: String(request.operational_max_meters ?? 2),
      attention_max_meters: String(request.attention_max_meters ?? 4),
    });

    const response = await fetch(`${API_BASE}/api/v1/climate/wave-scenario-comparison?${params.toString()}`, {
      headers: { ...TUNNEL_BYPASS_HEADERS },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Erro ao carregar comparação de cenário de onda');
    }

    return response.json();
  },
};
