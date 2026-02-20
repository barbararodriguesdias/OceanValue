import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import * as shapefile from 'shapefile';
import { analysisService, MultiRiskResult, WindScenarioComparisonResult, WaveScenarioComparisonResult } from '../services/analysisService';
import Map from '../components/Map/Map';
import './AnalysisPage.css';
import { VisualizationConfig } from '../components/SideDrawer/SideDrawer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

interface AnalysisPageProps {
  selectedPoint: { lat: number; lon: number } | null;
  onPointSelect: (point: { lat: number; lon: number }) => void;
  config: VisualizationConfig | null;
  onSaveAsset?: (asset: {
    id: string;
    name: string;
    createdAt: string;
    point: { lat: number; lon: number };
    period: { start: string; end: string };
    risks: string[];
    summary: {
      operationalHours: number;
      attentionHours: number;
      stopHours: number;
      totalHours: number;
      estimatedAssetImpact: number;
      annualEbitda: number;
      annualEbitdaImpact: number;
      annualEbitdaAfterRisk: number;
      vplImpact: number;
      discountRate: number;
      horizonYears: number;
    };
  }) => void;
}

type RiskId = 'wind' | 'wave' | 'flood' | 'heatwave' | 'temperature' | 'current';

const RISK_OPTIONS: Array<{ id: RiskId; label: string }> = [
  { id: 'wind', label: 'Vento' },
  { id: 'wave', label: 'Onda' },
  { id: 'flood', label: 'Inundação' },
  { id: 'heatwave', label: 'Ondas Térmicas' },
  { id: 'temperature', label: 'Temperatura' },
  { id: 'current', label: 'Corrente' },
];

type NamedLocationSource = 'campos_producao' | 'blocos_exploratorios';

interface NamedLocation {
  key: string;
  name: string;
  source: NamedLocationSource;
  point: { lat: number; lon: number };
  bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
}

const NAME_FIELD_CANDIDATES = [
  'NOME',
  'NOME_CAMPO',
  'NM_CAMPO',
  'CAMPO',
  'BLOCO',
  'NOME_BLOCO',
  'NM_BLOCO',
  'SIGLA',
  'NOMECAMPO',
  'NOMEBLOCO',
];

const normalizeFieldKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]/gi, '')
  .toUpperCase();

const sanitizeValue = (value: unknown) => String(value ?? '').replace(/\u0000/g, '').trim();

const hasLetters = (value: string) => /[A-Za-zÀ-ÿ]/.test(value);

const extractCoordinates = (geometry: any): [number, number][] => {
  const coords: [number, number][] = [];

  const walk = (value: any) => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2
      && typeof value[0] === 'number'
      && typeof value[1] === 'number'
      && Number.isFinite(value[0])
      && Number.isFinite(value[1])
    ) {
      coords.push([value[0], value[1]]);
      return;
    }

    value.forEach(walk);
  };

  walk(geometry?.coordinates);
  return coords;
};

const centroidFromGeometry = (geometry: any): { lat: number; lon: number } | null => {
  const coords = extractCoordinates(geometry);
  if (!coords.length) return null;

  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  coords.forEach(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  if (
    !Number.isFinite(minLon)
    || !Number.isFinite(maxLon)
    || !Number.isFinite(minLat)
    || !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };
};

const boundsFromGeometry = (
  geometry: any,
): {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
} | null => {
  const coords = extractCoordinates(geometry);
  if (!coords.length) return null;

  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  coords.forEach(([lon, lat]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  if (
    !Number.isFinite(minLon)
    || !Number.isFinite(maxLon)
    || !Number.isFinite(minLat)
    || !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return { minLon, minLat, maxLon, maxLat };
};

const pickFeatureName = (properties: Record<string, any>, fallbackPrefix: string, index: number) => {
  const entries = Object.entries(properties || {}).map(([key, value]) => ({
    key,
    normalizedKey: normalizeFieldKey(key),
    value: sanitizeValue(value),
  }));

  for (const fieldName of NAME_FIELD_CANDIDATES) {
    const normalizedTarget = normalizeFieldKey(fieldName);
    const match = entries.find((entry) => entry.normalizedKey === normalizedTarget && hasLetters(entry.value));
    if (match?.value) {
      return match.value;
    }
  }

  const semanticKeyMatch = entries.find(
    (entry) => (
      (entry.normalizedKey.includes('NOME')
      || entry.normalizedKey.includes('CAMPO')
      || entry.normalizedKey.includes('BLOCO')
      || entry.normalizedKey.includes('NOM'))
      && hasLetters(entry.value)
    ),
  );
  if (semanticKeyMatch?.value) {
    return semanticKeyMatch.value;
  }

  const firstTextualValue = entries.find(
    (entry) => hasLetters(entry.value)
      && !entry.normalizedKey.startsWith('ID')
      && !entry.normalizedKey.startsWith('CD')
      && !entry.normalizedKey.includes('CODIGO'),
  );
  if (firstTextualValue?.value) {
    return firstTextualValue.value;
  }

  return `${fallbackPrefix} ${index + 1}`;
};

const loadNamedLocationsFromShapefile = async (
  shpUrl: string,
  dbfUrl: string,
  source: NamedLocationSource,
  fallbackPrefix: string,
): Promise<NamedLocation[]> => {
  const sourceReader = await shapefile.open(shpUrl, dbfUrl);
  const items: NamedLocation[] = [];
  let result = await sourceReader.read();
  let idx = 0;

  while (!result.done) {
    const feature = result.value;
    const center = centroidFromGeometry(feature?.geometry);
    const bounds = boundsFromGeometry(feature?.geometry);
    if (center && bounds) {
      const name = pickFeatureName(feature?.properties || {}, fallbackPrefix, idx);
      items.push({
        key: `${source}-${name}-${idx}`,
        name,
        source,
        point: center,
        bounds,
      });
    }

    idx += 1;
    result = await sourceReader.read();
  }

  return items;
};

const defaultLimitsByRisk: Record<RiskId, { operational: number; attention: number }> = {
  wind: { operational: 15, attention: 20 },
  wave: { operational: 2, attention: 4 },
  flood: { operational: 1, attention: 2 },
  heatwave: { operational: 3, attention: 7 },
  temperature: { operational: 30, attention: 35 },
  current: { operational: 1, attention: 2 },
};

type HelpKey =
  | 'asset_name'
  | 'point'
  | 'named_location'
  | 'period_start'
  | 'period_end'
  | 'asset_value'
  | 'annual_ebitda'
  | 'discount_rate'
  | 'horizon_years'
  | 'combine_mode'
  | 'exceedance_method'
  | 'risk_load_method'
  | 'risk_quantile'
  | 'attention_loss_factor'
  | 'stop_loss_factor'
  | 'expense_ratio'
  | 'multiplier'
  | 'weight'
  | 'operational_limit'
  | 'attention_limit'
  | 'summary'
  | 'exposure_overview'
  | 'exposure_plot'
  | 'exposure_basemap'
  | 'exposure_scatter'
  | 'exposure_hexbin'
  | 'exposure_raster';

const HELP_CONTENT: Record<HelpKey, { title: string; body: string[] }> = {
  asset_name: {
    title: 'Nome do ativo',
    body: [
      'Definição: Identificador do ativo analisado (ex.: ALBACORA, P-35).',
      'Aplicação: Esse nome é usado ao salvar resultados em Meus Ativos.',
      'Boas práticas: Use nomes curtos e padronizados para facilitar comparação entre análises.',
    ],
  },
  point: {
    title: 'Ponto selecionado',
    body: [
      'Definição: Coordenada geográfica usada para extrair a série temporal do grid climático.',
      'Aplicação: Todos os cálculos (status, curva de excedência, métricas e precificação) usam esse ponto.',
      'Impacto na análise: Alterar o ponto muda completamente o histórico observado e, portanto, o risco calculado.',
    ],
  },
  named_location: {
    title: 'Selecionar campo/bloco por nome',
    body: [
      'Definição: Lista de nomes vindos dos metadados dos shapefiles de Campos de Produção e Blocos Exploratórios.',
      'Aplicação: Ao selecionar um item, o sistema define automaticamente o ponto no centro da área e aproxima o mapa.',
      'Observação: Você pode ignorar a lista e clicar no mapa para escolher manualmente outro ponto.',
    ],
  },
  period_start: {
    title: 'Período inicial',
    body: [
      'Definição: Data de início da amostra histórica.',
      'Aplicação: Determina quais observações entram no cálculo das métricas.',
      'Boas práticas: Use períodos longos para maior robustez; use períodos curtos para análises operacionais táticas.',
    ],
  },
  period_end: {
    title: 'Período final',
    body: [
      'Definição: Data final da amostra histórica.',
      'Aplicação: Junto com a data inicial, define o tamanho da base estatística.',
      'Impacto na análise: Períodos diferentes podem alterar bastante as caudas (eventos extremos) e o prêmio técnico.',
    ],
  },
  asset_value: {
    title: 'Valor do ativo',
    body: [
      'Definição: Valor econômico exposto do ativo (R$).',
      'Aplicação: Converte risco físico/operacional em perda monetária esperada.',
      'Onde aparece: AAL, VaR, TVaR, PML, prêmio puro e prêmio técnico.',
    ],
  },
  annual_ebitda: {
    title: 'EBITDA anual (R$)',
    body: [
      'Definição: EBITDA anual de referência do ativo.',
      'Aplicação: Estima impacto anual de risco e EBITDA pós-risco no resumo consolidado.',
      'Interpretação: Quanto maior o EBITDA, maior o impacto monetário absoluto para a mesma severidade de risco.',
    ],
  },
  discount_rate: {
    title: 'Taxa de desconto',
    body: [
      'Definição: Taxa usada para trazer impactos futuros a valor presente.',
      'Aplicação: Entra no cálculo do VPL do impacto econômico de risco.',
      'Boas práticas: Use taxa consistente com o padrão financeiro da companhia/projeto.',
    ],
  },
  horizon_years: {
    title: 'Horizonte (anos)',
    body: [
      'Definição: Número de anos considerado para o cálculo acumulado de impacto.',
      'Aplicação: Junto com a taxa de desconto, determina o VPL do impacto no período.',
      'Interpretação: Horizontes maiores aumentam o efeito acumulado, principalmente com risco recorrente.',
    ],
  },
  combine_mode: {
    title: 'Combinação de riscos',
    body: [
      'Worst Case: Em cada hora, usa o pior status entre os riscos selecionados. É o modo mais conservador.',
      'Weighted: Calcula uma combinação ponderada dos status por risco usando pesos definidos por você.',
      'Multiplier: Aplica penalização adicional quando há coocorrência de condições críticas entre riscos.',
      'Quando usar: Worst para segurança máxima; Weighted para calibrar importância relativa; Multiplier para cenários com efeito composto.',
    ],
  },
  exceedance_method: {
    title: 'Método de excedência',
    body: [
      'Weibull: Método empírico clássico (rank/(n+1)). Robusto e simples para uso geral.',
      'Hazen: Usa ajuste (rank-0.5)/n. Costuma centralizar melhor a distribuição em séries moderadas.',
      'Gringorten: Usa (rank-0.44)/(n+0.12). Muito usado em hidrologia e extremos por melhor ajuste de cauda.',
      'Impacto prático: A curva de excedência muda levemente, principalmente nas extremidades (eventos raros).',
    ],
  },
  risk_load_method: {
    title: 'Carga de risco',
    body: [
      'None: Sem carga adicional; prêmio técnico fica mais próximo do prêmio puro + despesas.',
      'VaR: Usa perda no quantil escolhido (ex.: 95%). Captura um nível de perda “limite”.',
      'TVaR: Média das perdas acima do VaR (cauda). Mais conservador para eventos extremos.',
      'Stdev: Usa volatilidade da perda como proxy de incerteza/riscos de oscilação.',
      'Quando usar: TVaR para proteção de cauda; VaR para limite probabilístico; Stdev para visão de dispersão.',
    ],
  },
  risk_quantile: {
    title: 'Quantil de risco',
    body: [
      'Definição: Percentil de referência para VaR/TVaR (ex.: 0.95 = 95%).',
      'Exemplo: VaR 95% é a perda que só é superada em ~5% dos cenários.',
      'Impacto no preço: Quantis maiores aumentam foco em extremos e tendem a elevar carga de risco.',
    ],
  },
  attention_loss_factor: {
    title: 'Fator perda atenção',
    body: [
      'Definição: Fração de perda aplicada quando condição está em atenção.',
      'Exemplo: 0.35 significa 35% da base de perda em períodos classificados como atenção.',
      'Uso: Ajuda a refletir impacto parcial de degradação operacional antes da parada total.',
    ],
  },
  stop_loss_factor: {
    title: 'Fator perda parada',
    body: [
      'Definição: Fração de perda aplicada em condição de parada.',
      'Regra típica: Deve ser maior ou igual ao fator de atenção.',
      'Uso: Representa severidade econômica de indisponibilidade total.',
    ],
  },
  expense_ratio: {
    title: 'Expense ratio',
    body: [
      'Definição: Percentual de despesas operacionais/comerciais sobre o prêmio puro.',
      'Aplicação: Prêmio técnico = prêmio puro + carga de risco + despesas.',
      'Exemplo: 0.15 adiciona 15% de despesas sobre a base atuarial.',
    ],
  },
  multiplier: {
    title: 'Multiplicador',
    body: [
      'Definição: Fator de ampliação para coocorrência de riscos no modo Multiplier.',
      'Interpretação: 1.0 não altera; >1 aumenta penalização quando riscos críticos aparecem juntos.',
      'Uso recomendado: Cenários de risco composto, onde impacto conjunto é maior que soma simples.',
    ],
  },
  weight: {
    title: 'Peso do risco',
    body: [
      'Definição: Importância relativa de cada risco no modo Weighted.',
      'Interpretação: Peso maior = risco influencia mais o status combinado.',
      'Exemplo: Peso vento 1.5 e onda 1.0 torna vento mais determinante no resultado final.',
    ],
  },
  operational_limit: {
    title: 'Limite operacional',
    body: [
      'Definição: Limite superior da zona operacional.',
      'Regra: Valor abaixo desse limite é classificado como operacional.',
      'Transição: Entre operacional e atenção, status passa para atenção.',
    ],
  },
  attention_limit: {
    title: 'Limite atenção',
    body: [
      'Definição: Limite que separa atenção de parada.',
      'Regra: Valores acima desse limite entram em parada.',
      'Consistência: Deve ser maior ou igual ao limite operacional.',
    ],
  },
  summary: {
    title: 'Resumo Consolidado',
    body: [
      'Horas Operacionais/Atenção/Parada: Quantidade de horas em cada faixa de severidade no risco combinado.',
      'Impacto Estimado: Aproximação rápida dada por valor do ativo × fração de horas em parada.',
      'AAL (Average Annual Loss): Perda anual esperada média. É a base clássica de prêmio puro.',
      'PML (Probable Maximum Loss): Perda máxima provável no período anualizado, útil para limite de exposição.',
      'VaR (Value at Risk): Perda no quantil selecionado (ex.: 95%). Mede limite probabilístico.',
      'TVaR (Tail Value at Risk): Média das perdas acima do VaR. Mede severidade da cauda extrema.',
      'Prêmio puro: Componente atuarial base (normalmente ligado ao AAL).',
      'Prêmio técnico: Prêmio puro acrescido de despesas e carga de risco conforme método escolhido.',
    ],
  },
  exposure_overview: {
    title: 'Exposure por Localização',
    body: [
      'Definição: Bloco que mostra como as exposições se distribuem no território, usando o shapefile mais próximo do ponto analisado.',
      'Fonte espacial: O sistema seleciona automaticamente um shapefile de referência e plota limites e pontos derivados dessa geometria.',
      'Leitura recomendada: Compare os 5 gráficos para entender padrão espacial, densidade e concentração das exposições.',
    ],
  },
  exposure_plot: {
    title: 'Exposição - Pontos de referência',
    body: [
      'O que mostra: Distribuição espacial básica das exposições em pontos.',
      'Quando usar: Visão rápida de onde os ativos estão localizados.',
      'Interpretação: Padrões espalhados indicam exposição difusa; clusters sugerem concentração de risco em subáreas.',
    ],
  },
  exposure_basemap: {
    title: 'Exposição com contorno de referência',
    body: [
      'O que mostra: Pontos de exposição sobre o contorno do shapefile de referência.',
      'Quando usar: Validar coerência espacial entre ponto analisado e área operacional.',
      'Interpretação: Pontos próximos ao limite podem indicar sensibilidade a mudanças de fronteira ou seleção de área.',
    ],
  },
  exposure_scatter: {
    title: 'Scatter de exposição',
    body: [
      'O que mostra: Pontos com variação visual de intensidade relativa (cor/tamanho).',
      'Quando usar: Destacar hotspots locais de maior peso relativo.',
      'Interpretação: Pontos mais intensos representam maior contribuição relativa de exposição no conjunto amostrado.',
    ],
  },
  exposure_hexbin: {
    title: 'Hexbin / densidade de exposição',
    body: [
      'O que mostra: Agrupamento espacial por células, enfatizando densidade de ocorrências.',
      'Quando usar: Identificar regiões com alta concentração de exposição sem ruído de ponto-a-ponto.',
      'Interpretação: Células mais escuras/maiores indicam maior densidade e potencial concentração de impacto.',
    ],
  },
  exposure_raster: {
    title: 'Raster de exposição',
    body: [
      'O que mostra: Superfície contínua em grade com intensidade espacial de exposição.',
      'Quando usar: Leitura regional de gradientes (áreas mais quentes x mais frias).',
      'Interpretação: Tons mais fortes representam maior presença relativa de exposição naquela célula da grade.',
    ],
  },
};

const HelpIconButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button type="button" className="info-icon-btn" onClick={onClick} aria-label={label} title={label}>
    i
  </button>
);

const HelpModal: React.FC<{ title: string; body: string[]; onClose: () => void }> = ({ title, body, onClose }) => (
  <div className="help-modal-overlay" onClick={onClose}>
    <div className="help-modal" onClick={(e) => e.stopPropagation()}>
      <div className="help-modal-header">
        <h4>{title}</h4>
        <button type="button" className="help-close-btn" onClick={onClose}>×</button>
      </div>
      <ul className="help-modal-list">
        {body.map((line) => {
          const parts = line.split(':');
          const topic = parts[0] || '';
          const detail = parts.slice(1).join(':').trim();
          return (
            <li key={line}>
              <strong>{topic}:</strong> {detail}
            </li>
          );
        })}
      </ul>
    </div>
  </div>
);

interface ThresholdWindRoseProps {
  directionLabels: string[];
  totalCounts: number[];
  operationalCounts: number[];
  attentionCounts: number[];
  stopCounts: number[];
  size?: number;
}

const ThresholdWindRose: React.FC<ThresholdWindRoseProps> = ({
  directionLabels,
  totalCounts,
  operationalCounts,
  attentionCounts,
  stopCounts,
  size = 420,
}) => {
  const center = size / 2;
  const outerRadius = Math.max(120, size * 0.42);
  const totalObservations = Math.max(totalCounts.reduce((sum, value) => sum + Math.max(0, value), 0), 1);
  const directionPercentages = totalCounts.map((value) => (Math.max(0, value) / totalObservations) * 100);
  const maxPercentage = Math.max(...directionPercentages, 1);
  const rings = 5;

  const toRadius = (value: number) => (Math.min(Math.max(0, value), maxPercentage) / maxPercentage) * outerRadius;

  const directionAxes = [
    { label: 'N', angle: -90 },
    { label: 'NE', angle: -45 },
    { label: 'E', angle: 0 },
    { label: 'SE', angle: 45 },
    { label: 'S', angle: 90 },
    { label: 'SW', angle: 135 },
    { label: 'W', angle: 180 },
    { label: 'NW', angle: -135 },
  ];

  const pointAt = (radius: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(angleRad),
      y: center + radius * Math.sin(angleRad),
    };
  };

  const sectorPath = (innerRadius: number, outerR: number, startDeg: number, endDeg: number) => {
    if (outerR <= innerRadius || outerR <= 0) return '';

    const startOuter = pointAt(outerR, startDeg);
    const endOuter = pointAt(outerR, endDeg);
    const startInner = pointAt(innerRadius, startDeg);
    const endInner = pointAt(innerRadius, endDeg);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;

    if (innerRadius <= 0.0001) {
      return [
        `M ${center} ${center}`,
        `L ${startOuter.x} ${startOuter.y}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
        'Z',
      ].join(' ');
    }

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  return (
    <div className="threshold-wind-rose">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="wind-rose-svg"
        style={{ width: size, height: size, maxWidth: '100%' }}
        role="img"
        aria-label="Rosa dos ventos por percentual de ocorrência"
      >
        {[...Array(rings)].map((_, idx) => {
          const ringPercentage = ((idx + 1) / rings) * maxPercentage;
          const ringRadius = toRadius(ringPercentage);
          return (
            <g key={`ring-${idx}`}>
              <circle cx={center} cy={center} r={ringRadius} fill="none" stroke="#dbeafe" strokeWidth="1" />
            </g>
          );
        })}

        {directionAxes.map((axis) => {
          const end = pointAt(outerRadius, axis.angle);
          const labelPoint = pointAt(outerRadius + 14, axis.angle);
          return (
            <g key={`axis-${axis.label}`}>
              <line
                x1={center}
                y1={center}
                x2={end.x}
                y2={end.y}
                stroke="#64748b"
                strokeWidth="1"
                strokeOpacity="0.55"
              />
              <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" className="wind-rose-axis-label">
                {axis.label}
              </text>
            </g>
          );
        })}

        {directionLabels.map((label, idx) => {
          const total = totalCounts[idx] ?? 0;
          const opCount = Math.max(0, operationalCounts[idx] ?? 0);
          const attCount = Math.max(0, attentionCounts[idx] ?? 0);
          const stopCount = Math.max(0, stopCounts[idx] ?? 0);

          const sectorSize = 360 / directionLabels.length;
          const startDeg = -90 - (sectorSize / 2) + idx * sectorSize;
          const endDeg = startDeg + sectorSize;

          const opPct = (opCount / totalObservations) * 100;
          const attPct = (attCount / totalObservations) * 100;
          const stopPct = (stopCount / totalObservations) * 100;
          const totalPct = (Math.max(0, total) / totalObservations) * 100;

          const rOp = toRadius(opPct);
          const rAtt = toRadius(opPct + attPct);
          const rMax = toRadius(opPct + attPct + stopPct);

          const operationalPath = sectorPath(0, rOp, startDeg, endDeg);
          const attentionPath = sectorPath(rOp, rAtt, startDeg, endDeg);
          const stopPath = sectorPath(rAtt, rMax, startDeg, endDeg);

          return (
            <g key={`sector-${label}`}>
              <path d={sectorPath(0, toRadius(totalPct), startDeg, endDeg)} fill="none" stroke="#94a3b8" strokeWidth="0.8" />
              {operationalPath && <path d={operationalPath} fill="#22c55e" fillOpacity="0.85" stroke="none" />}
              {attentionPath && <path d={attentionPath} fill="#f59e0b" fillOpacity="0.9" stroke="none" />}
              {stopPath && <path d={stopPath} fill="#ef4444" fillOpacity="0.9" stroke="none" />}

              <path d={sectorPath(0, rMax, startDeg, endDeg)} fill="none" stroke="#334155" strokeWidth="1.1" />
            </g>
          );
        })}

        {[...Array(rings)].map((_, idx) => {
          const ringPercentage = ((idx + 1) / rings) * maxPercentage;
          const ringRadius = toRadius(ringPercentage);
          const ringLabelPoint = pointAt(Math.max(ringRadius - 8, 0), -67.5);
          return (
            <text
              key={`ring-label-${idx}`}
              x={ringLabelPoint.x}
              y={ringLabelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="wind-rose-ring-label"
            >
              {ringPercentage.toFixed(1)}%
            </text>
          );
        })}

        <circle cx={center} cy={center} r="4" fill="#0f172a" />
      </svg>

      <div className="wind-rose-legend">
        <span><i className="legend-dot op" /> Operacional</span>
        <span><i className="legend-dot at" /> Atenção</span>
        <span><i className="legend-dot st" /> Parada</span>
      </div>
    </div>
  );
};

const ChartExpandButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button type="button" className="chart-expand-btn" onClick={onClick} aria-label={label} title={label}>
    ⤢
  </button>
);

const ChartModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  const [zoom, setZoom] = useState(1);

  const changeZoom = (delta: number) => {
    setZoom((prev) => {
      const next = prev + delta;
      return Math.min(3, Math.max(0.6, Number(next.toFixed(2))));
    });
  };

  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal-header">
          <h4>{title}</h4>
          <div className="chart-modal-actions">
            <button type="button" className="chart-zoom-btn" onClick={() => changeZoom(-0.2)}>-</button>
            <button type="button" className="chart-zoom-btn" onClick={() => setZoom(1)}>100%</button>
            <button type="button" className="chart-zoom-btn" onClick={() => changeZoom(0.2)}>+</button>
            <span className="chart-zoom-level">{Math.round(zoom * 100)}%</span>
            <button type="button" className="help-close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="chart-modal-body">
          <div className="chart-modal-scroll">
            <div className="chart-modal-zoom" style={{ zoom }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalysisPage: React.FC<AnalysisPageProps> = ({ selectedPoint, onPointSelect, config, onSaveAsset }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MultiRiskResult | null>(null);
  const [windScenario, setWindScenario] = useState<WindScenarioComparisonResult | null>(null);
  const [waveScenario, setWaveScenario] = useState<WaveScenarioComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [startTime, setStartTime] = useState('2024-01-01');
  const [endTime, setEndTime] = useState('2024-12-31');
  const [assetValue, setAssetValue] = useState(100000000);
  const [assetName, setAssetName] = useState('Ativo sem nome');
  const [annualEbitda, setAnnualEbitda] = useState(250000000);
  const [discountRate, setDiscountRate] = useState(0.12);
  const [horizonYears, setHorizonYears] = useState(10);

  const [selectedRisks, setSelectedRisks] = useState<RiskId[]>(['wind']);
  const [riskLimits, setRiskLimits] = useState<Record<RiskId, { operational: number; attention: number }>>(
    defaultLimitsByRisk,
  );
  const [combineMode, setCombineMode] = useState<'worst' | 'weighted' | 'multiplier'>('worst');
  const [weights, setWeights] = useState<Record<string, number>>({ wind: 1, wave: 1 });
  const [multiplier, setMultiplier] = useState(1.5);
  const [exceedanceMethod, setExceedanceMethod] = useState<'weibull' | 'hazen' | 'gringorten'>('weibull');
  const [riskLoadMethod, setRiskLoadMethod] = useState<'none' | 'var' | 'tvar' | 'stdev'>('none');
  const [riskQuantile, setRiskQuantile] = useState(0.95);
  const [attentionLossFactor, setAttentionLossFactor] = useState(0.35);
  const [stopLossFactor, setStopLossFactor] = useState(1.0);
  const [expenseRatio, setExpenseRatio] = useState(0.15);
  const [activeHelp, setActiveHelp] = useState<HelpKey | null>(null);
  const [expandedChart, setExpandedChart] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [namedLocations, setNamedLocations] = useState<NamedLocation[]>([]);
  const [selectedNamedLocationKey, setSelectedNamedLocationKey] = useState('');
  const [focusedBounds, setFocusedBounds] = useState<{
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  } | null>(null);
  const [isLoadingNamedLocations, setIsLoadingNamedLocations] = useState(false);
  const [namedLocationsError, setNamedLocationsError] = useState<string | null>(null);
  const [analysisMapLayers, setAnalysisMapLayers] = useState({
    baciaSantos: true,
    baciaCampos: true,
    blocosExploratorios: true,
    camposProducao: true,
  });

  const labelWithInfo = (text: string, key: HelpKey) => (
    <span className="field-label-with-info">
      {text}
      <HelpIconButton onClick={() => setActiveHelp(key)} label={`Informação sobre ${text}`} />
    </span>
  );

  const canRun = Boolean(selectedPoint && selectedRisks.length > 0 && startTime && endTime);

  useEffect(() => {
    if (!config) return;

    setStartTime(config.startDate);
    setEndTime(config.endDate);

    setRiskLimits((prev) => {
      const next = { ...prev };
      RISK_OPTIONS.forEach(({ id }) => {
        const cfg = config.thresholds?.[id];
        if (cfg) {
          next[id] = {
            operational: cfg.operationalMax,
            attention: cfg.attentionMax,
          };
        }
      });
      return next;
    });

    if (config.riskType && RISK_OPTIONS.some((r) => r.id === config.riskType)) {
      setSelectedRisks((prev) => {
        const risk = config.riskType as RiskId;
        return prev.includes(risk) ? prev : [risk, ...prev];
      });
    }
  }, [config]);

  useEffect(() => {
    let isMounted = true;

    const loadNamedLocations = async () => {
      setIsLoadingNamedLocations(true);
      setNamedLocationsError(null);

      try {
        const [campos, blocos] = await Promise.all([
          loadNamedLocationsFromShapefile(
            '/data/campos_producao/CAMPOS_PRODUCAO_SIRGASPolygon.shp',
            '/data/campos_producao/CAMPOS_PRODUCAO_SIRGASPolygon.dbf',
            'campos_producao',
            'Campo',
          ),
          loadNamedLocationsFromShapefile(
            '/data/blocos_exploratorios/BLOCOS_EXPLORATORIOS_SIRGASPolygon.shp',
            '/data/blocos_exploratorios/BLOCOS_EXPLORATORIOS_SIRGASPolygon.dbf',
            'blocos_exploratorios',
            'Bloco',
          ),
        ]);

        if (!isMounted) return;

        const merged = [...campos, ...blocos].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setNamedLocations(merged);
      } catch {
        if (!isMounted) return;
        setNamedLocationsError('Não foi possível carregar nomes dos shapefiles.');
      } finally {
        if (isMounted) {
          setIsLoadingNamedLocations(false);
        }
      }
    };

    loadNamedLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMapPointSelect = (point: { lat: number; lon: number }) => {
    setSelectedNamedLocationKey('');
    setFocusedBounds(null);
    onPointSelect(point);
  };

  const handleNamedLocationChange = (value: string) => {
    setSelectedNamedLocationKey(value);
    if (!value) return;

    const selectedLocation = namedLocations.find((item) => item.key === value);
    if (!selectedLocation) return;

    setFocusedBounds(selectedLocation.bounds);
    onPointSelect(selectedLocation.point);
  };

  const handleToggleRisk = (risk: RiskId, checked: boolean) => {
    setSelectedRisks((prev) => {
      if (checked) {
        setWeights((old) => ({ ...old, [risk]: old[risk] ?? 1 }));
        return prev.includes(risk) ? prev : [...prev, risk];
      }
      const filtered = prev.filter((item) => item !== risk);
      return filtered.length ? filtered : prev;
    });
  };

  const setRiskLimit = (risk: RiskId, field: 'operational' | 'attention', value: number) => {
    setRiskLimits((prev) => ({
      ...prev,
      [risk]: {
        ...prev[risk],
        [field]: value,
      },
    }));
  };

  const handleRun = async () => {
    if (!selectedPoint) return;

    setIsRunning(true);
    setError(null);
    setResult(null);
    setWindScenario(null);
    setWaveScenario(null);

    try {
      if (!startTime || !endTime) {
        setError('Preencha período inicial e final.');
        return;
      }

      if (!selectedRisks.length) {
        setError('Selecione pelo menos um risco.');
        return;
      }

      for (const risk of selectedRisks) {
        const limits = riskLimits[risk];
        if (limits.attention < limits.operational) {
          setError(`No risco ${risk}, o limite de atenção deve ser maior ou igual ao operacional.`);
          return;
        }
      }

      const thresholds: Record<string, { operational_max: number; attention_max: number }> = {};
      selectedRisks.forEach((risk) => {
        thresholds[risk] = {
          operational_max: riskLimits[risk].operational,
          attention_max: riskLimits[risk].attention,
        };
      });

      const data = await analysisService.runMultiRisk({
        lat: selectedPoint.lat,
        lon: selectedPoint.lon,
        start_time: startTime,
        end_time: endTime,
        hazards: selectedRisks,
        thresholds,
        combine_mode: combineMode,
        weights: combineMode === 'weighted' ? weights : undefined,
        multiplier: combineMode === 'multiplier' ? multiplier : undefined,
        asset_value: assetValue,
        attention_loss_factor: attentionLossFactor,
        stop_loss_factor: stopLossFactor,
        exceedance_method: exceedanceMethod,
        risk_load_method: riskLoadMethod,
        risk_quantile: riskQuantile,
        expense_ratio: expenseRatio,
        include_series: selectedRisks.includes('wind') || selectedRisks.includes('wave'),
      });

      setResult(data);

      if (selectedRisks.includes('wind')) {
        try {
          const windScenarioData = await analysisService.getWindScenarioComparison({
            lat: selectedPoint.lat,
            lon: selectedPoint.lon,
            scenario: 'ssp585',
            stat: 'mean',
            historical_period: '1985-2014',
            future_period: '2035-2064',
            operational_max_knots: riskLimits.wind.operational,
            attention_max_knots: riskLimits.wind.attention,
          });
          setWindScenario(windScenarioData);
        } catch {
          setWindScenario(null);
        }
      }

      if (selectedRisks.includes('wave')) {
        try {
          const waveScenarioData = await analysisService.getWaveScenarioComparison({
            lat: selectedPoint.lat,
            lon: selectedPoint.lon,
            scenario: 'ssp585',
            stat: 'mean',
            historical_period: '1985-2014',
            future_period: '2035-2064',
            operational_max_meters: riskLimits.wave.operational,
            attention_max_meters: riskLimits.wave.attention,
          });
          setWaveScenario(waveScenarioData);
        } catch {
          setWaveScenario(null);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRunning(false);
    }
  };

  const stopRatio = result?.combined?.total_hours
    ? result.combined.stop_hours / result.combined.total_hours
    : 0;
  const attentionRatio = result?.combined?.total_hours
    ? result.combined.attention_hours / result.combined.total_hours
    : 0;
  const estimatedAssetImpact = assetValue * stopRatio;
  const annualEbitdaImpact = annualEbitda * ((attentionRatio * attentionLossFactor) + (stopRatio * stopLossFactor));
  const annualEbitdaAfterRisk = annualEbitda - annualEbitdaImpact;
  const vplFactor = discountRate > 0
    ? (1 - Math.pow(1 + discountRate, -horizonYears)) / discountRate
    : horizonYears;
  const vplImpact = annualEbitdaImpact * vplFactor;

  const handleSaveAsset = () => {
    if (!result || !selectedPoint || !onSaveAsset) return;

    onSaveAsset({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: assetName || 'Ativo sem nome',
      createdAt: new Date().toISOString(),
      point: selectedPoint,
      period: { start: startTime, end: endTime },
      risks: selectedRisks,
      summary: {
        operationalHours: result.combined.operational_hours,
        attentionHours: result.combined.attention_hours,
        stopHours: result.combined.stop_hours,
        totalHours: result.combined.total_hours,
        estimatedAssetImpact,
        annualEbitda,
        annualEbitdaImpact,
        annualEbitdaAfterRisk,
        vplImpact,
        discountRate,
        horizonYears,
      },
    });
  };

  const windComplete = useMemo(() => {
    if (!result?.series?.wind?.length || !result?.time?.length || !result?.hazards?.wind) {
      return null;
    }

    const values = result.series.wind;
    const time = result.time;
    const op = result.hazards.wind.operational_max;
    const att = result.hazards.wind.attention_max;

    const status = values.map((value) => {
      if (value >= att) return 2;
      if (value >= op) return 1;
      return 0;
    });

    const monthMap = new globalThis.Map<string, { op: number; att: number; stop: number; avgSum: number; count: number }>();
    values.forEach((value, idx) => {
      const key = (time[idx] || '').slice(0, 7);
      if (!key) return;
      const current = monthMap.get(key) ?? { op: 0, att: 0, stop: 0, avgSum: 0, count: 0 };
      const st = status[idx];
      if (st === 2) current.stop += 1;
      else if (st === 1) current.att += 1;
      else current.op += 1;
      current.avgSum += Number(value) || 0;
      current.count += 1;
      monthMap.set(key, current);
    });

    const monthlyKeys = Array.from(monthMap.keys()).sort();
    const monthlyOperational = monthlyKeys.map((k) => monthMap.get(k)?.op ?? 0);
    const monthlyAttention = monthlyKeys.map((k) => monthMap.get(k)?.att ?? 0);
    const monthlyStop = monthlyKeys.map((k) => monthMap.get(k)?.stop ?? 0);
    const monthlyMean = monthlyKeys.map((k) => {
      const item = monthMap.get(k);
      if (!item || item.count === 0) return 0;
      return item.avgSum / item.count;
    });

    let currentStop = 0;
    let maxStop = 0;
    let currentAttention = 0;
    let maxAttention = 0;
    status.forEach((st) => {
      if (st === 2) {
        currentStop += 1;
        maxStop = Math.max(maxStop, currentStop);
      } else {
        currentStop = 0;
      }

      if (st >= 1) {
        currentAttention += 1;
        maxAttention = Math.max(maxAttention, currentAttention);
      } else {
        currentAttention = 0;
      }
    });

    const step = Math.max(1, Math.floor(values.length / 700));
    const sampledIdx = Array.from({ length: Math.ceil(values.length / step) }, (_, i) => i * step).filter((idx) => idx < values.length);

    return {
      op,
      att,
      sampledLabels: sampledIdx.map((idx) => time[idx]?.replace('T', ' ').slice(0, 16) ?? ''),
      sampledValues: sampledIdx.map((idx) => values[idx]),
      sampledOp: sampledIdx.map(() => op),
      sampledAtt: sampledIdx.map(() => att),
      monthlyKeys,
      monthlyOperational,
      monthlyAttention,
      monthlyStop,
      monthlyMean,
      maxStop,
      maxAttention,
    };
  }, [result]);

  const waveComplete = useMemo(() => {
    if (!result?.series?.wave?.length || !result?.time?.length || !result?.hazards?.wave) {
      return null;
    }

    const values = result.series.wave;
    const time = result.time;
    const op = result.hazards.wave.operational_max;
    const att = result.hazards.wave.attention_max;

    const status = values.map((value) => {
      if (value >= att) return 2;
      if (value >= op) return 1;
      return 0;
    });

    const monthMap = new globalThis.Map<string, { sum: number; count: number; op: number; att: number; stop: number }>();

    values.forEach((value, idx) => {
      const key = (time[idx] || '').slice(0, 7);
      if (!key || !Number.isFinite(Number(value))) return;

      const current = monthMap.get(key) ?? { sum: 0, count: 0, op: 0, att: 0, stop: 0 };
      current.sum += Number(value);
      current.count += 1;

      const st = status[idx];
      if (st === 2) current.stop += 1;
      else if (st === 1) current.att += 1;
      else current.op += 1;

      monthMap.set(key, current);
    });

    const monthlyKeys = Array.from(monthMap.keys()).sort();
    const monthlyOperational = monthlyKeys.map((k) => monthMap.get(k)?.op ?? 0);
    const monthlyAttention = monthlyKeys.map((k) => monthMap.get(k)?.att ?? 0);
    const monthlyStop = monthlyKeys.map((k) => monthMap.get(k)?.stop ?? 0);
    const monthlyMean = monthlyKeys.map((k) => {
      const item = monthMap.get(k);
      if (!item || item.count === 0) return 0;
      return item.sum / item.count;
    });

    return {
      monthlyKeys,
      monthlyOperational,
      monthlyAttention,
      monthlyStop,
      monthlyMean,
    };
  }, [result]);

  return (
    <div className="analysis-page">
      <header className="analysis-header">
        <h2>Dashboard de Análise Multi-Risco</h2>
        <p>Marque os riscos, ajuste limites e gere dashboards lado a lado para cada risco.</p>
      </header>

      <section className="analysis-section analysis-top-grid">
        <div className="analysis-card analysis-form-card">
          <h3>Configuração Geral</h3>

          <div className="analysis-form-grid analysis-form-grid-4">
            <label>
              {labelWithInfo('Nome do ativo', 'asset_name')}
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Ex.: Plataforma P-35"
              />
            </label>

            <label>
              {labelWithInfo('Ponto selecionado', 'point')}
              <input
                type="text"
                value={selectedPoint ? `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lon.toFixed(5)}` : ''}
                readOnly
                placeholder="Selecione um ponto no mapa"
              />
            </label>

            <label>
              {labelWithInfo('Período inicial', 'period_start')}
              <input type="date" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>

            <label>
              {labelWithInfo('Período final', 'period_end')}
              <input type="date" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>

            <label>
              {labelWithInfo('Valor do ativo (R$)', 'asset_value')}
              <input
                type="number"
                value={assetValue}
                onChange={(e) => setAssetValue(Number(e.target.value))}
                step="1000"
              />
            </label>

            <label>
              {labelWithInfo('EBITDA anual (R$)', 'annual_ebitda')}
              <input
                type="number"
                value={annualEbitda}
                onChange={(e) => setAnnualEbitda(Number(e.target.value))}
                step="1000"
              />
            </label>

            <label>
              {labelWithInfo('Taxa de desconto', 'discount_rate')}
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={discountRate}
                onChange={(e) => setDiscountRate(Number(e.target.value))}
              />
            </label>

            <label>
              {labelWithInfo('Horizonte (anos)', 'horizon_years')}
              <input
                type="number"
                min={1}
                max={50}
                step="1"
                value={horizonYears}
                onChange={(e) => setHorizonYears(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="analysis-risk-list multi">
            {RISK_OPTIONS.map((risk) => (
              <label key={risk.id} className="analysis-risk-item">
                <input
                  type="checkbox"
                  checked={selectedRisks.includes(risk.id)}
                  onChange={(e) => handleToggleRisk(risk.id, e.target.checked)}
                />
                <span>{risk.label}</span>
              </label>
            ))}
          </div>

          <div className="analysis-form-grid">
            <label>
              {labelWithInfo('Combinação de riscos', 'combine_mode')}
              <select value={combineMode} onChange={(e) => setCombineMode(e.target.value as 'worst' | 'weighted' | 'multiplier')}>
                <option value="worst">Worst case (máximo por hora)</option>
                <option value="weighted">Weighted (média ponderada)</option>
                <option value="multiplier">Multiplier (penalização conjunta)</option>
              </select>
            </label>

            <label>
              {labelWithInfo('Método de excedência', 'exceedance_method')}
              <select value={exceedanceMethod} onChange={(e) => setExceedanceMethod(e.target.value as 'weibull' | 'hazen' | 'gringorten')}>
                <option value="weibull">Weibull</option>
                <option value="hazen">Hazen</option>
                <option value="gringorten">Gringorten</option>
              </select>
            </label>

            <label>
              {labelWithInfo('Carga de risco', 'risk_load_method')}
              <select value={riskLoadMethod} onChange={(e) => setRiskLoadMethod(e.target.value as 'none' | 'var' | 'tvar' | 'stdev')}>
                <option value="none">Sem carga</option>
                <option value="var">VaR</option>
                <option value="tvar">TVaR</option>
                <option value="stdev">Desvio padrão</option>
              </select>
            </label>

            <label>
              {labelWithInfo('Quantil de risco', 'risk_quantile')}
              <input
                type="number"
                min={0.5}
                max={0.999}
                step="0.01"
                value={riskQuantile}
                onChange={(e) => setRiskQuantile(Number(e.target.value))}
              />
            </label>

            <label>
              {labelWithInfo('Fator perda atenção', 'attention_loss_factor')}
              <input
                type="number"
                min={0}
                max={1}
                step="0.05"
                value={attentionLossFactor}
                onChange={(e) => setAttentionLossFactor(Number(e.target.value))}
              />
            </label>

            <label>
              {labelWithInfo('Fator perda parada', 'stop_loss_factor')}
              <input
                type="number"
                min={0}
                max={2}
                step="0.05"
                value={stopLossFactor}
                onChange={(e) => setStopLossFactor(Number(e.target.value))}
              />
            </label>

            <label>
              {labelWithInfo('Expense ratio', 'expense_ratio')}
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                value={expenseRatio}
                onChange={(e) => setExpenseRatio(Number(e.target.value))}
              />
            </label>

            {combineMode === 'multiplier' && (
              <label>
                {labelWithInfo('Multiplicador', 'multiplier')}
                <input
                  type="number"
                  min={1}
                  step="0.1"
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                />
              </label>
            )}
          </div>

          {combineMode === 'weighted' && (
            <div className="analysis-form-grid">
              {selectedRisks.map((risk) => (
                <label key={`weight-${risk}`}>
                  {labelWithInfo(`Peso ${risk}`, 'weight')}
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={weights[risk] ?? 1}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [risk]: Number(e.target.value) }))}
                  />
                </label>
              ))}
            </div>
          )}

          {!selectedPoint && <p className="analysis-hint">Selecione um ponto no mini mapa para iniciar a análise.</p>}
          {error && <p className="analysis-error">{error}</p>}
        </div>

        <div className="analysis-card analysis-mini-map-card">
          <h3>Ponto de Análise</h3>
          <div className="analysis-location-select">
            <label>
              {labelWithInfo('Selecionar campo/bloco por nome', 'named_location')}
              <select
                value={selectedNamedLocationKey}
                onChange={(e) => handleNamedLocationChange(e.target.value)}
                disabled={isLoadingNamedLocations || !namedLocations.length}
              >
                <option value="">Selecione (ou clique no mapa)</option>
                <optgroup label="Campos de Produção">
                  {namedLocations
                    .filter((item) => item.source === 'campos_producao')
                    .map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Blocos Exploratórios">
                  {namedLocations
                    .filter((item) => item.source === 'blocos_exploratorios')
                    .map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
            {isLoadingNamedLocations && <p className="analysis-hint">Carregando nomes dos shapefiles...</p>}
            {namedLocationsError && <p className="analysis-error">{namedLocationsError}</p>}
          </div>
          <div className="analysis-mini-map-layout">
            <div className="analysis-mini-map">
              <Map
                hazardType="wind"
                filters={{ layers: analysisMapLayers }}
                latMin={config?.latMin}
                latMax={config?.latMax}
                lonMin={config?.lonMin}
                lonMax={config?.lonMax}
                selectedPoint={selectedPoint}
                onPointSelect={handleMapPointSelect}
                initialZoom={3.6}
                initialCenter={[-44.0, -23.5]}
                hideLayers={false}
                focusBounds={focusedBounds}
              />
            </div>
            <div className="analysis-map-layer-toggles">
              <label className="analysis-risk-item">
                <input
                  className="analysis-layer-checkbox"
                  type="checkbox"
                  checked={analysisMapLayers.baciaSantos}
                  onChange={(e) => setAnalysisMapLayers((prev) => ({ ...prev, baciaSantos: e.target.checked }))}
                />
                <span>Bacia Santos</span>
              </label>
              <label className="analysis-risk-item">
                <input
                  className="analysis-layer-checkbox"
                  type="checkbox"
                  checked={analysisMapLayers.baciaCampos}
                  onChange={(e) => setAnalysisMapLayers((prev) => ({ ...prev, baciaCampos: e.target.checked }))}
                />
                <span>Bacia Campos</span>
              </label>
              <label className="analysis-risk-item">
                <input
                  className="analysis-layer-checkbox"
                  type="checkbox"
                  checked={analysisMapLayers.blocosExploratorios}
                  onChange={(e) => setAnalysisMapLayers((prev) => ({ ...prev, blocosExploratorios: e.target.checked }))}
                />
                <span>Blocos</span>
              </label>
              <label className="analysis-risk-item">
                <input
                  className="analysis-layer-checkbox"
                  type="checkbox"
                  checked={analysisMapLayers.camposProducao}
                  onChange={(e) => setAnalysisMapLayers((prev) => ({ ...prev, camposProducao: e.target.checked }))}
                />
                <span>Campos</span>
              </label>
            </div>
          </div>
          <p className="analysis-hint">Clique no mini mapa para selecionar o ponto da análise.</p>
        </div>
      </section>

      <section className="analysis-risk-boxes">
        {selectedRisks.map((risk) => {
          const riskMeta = RISK_OPTIONS.find((item) => item.id === risk);
          const limits = riskLimits[risk];

          return (
            <div key={risk} className="analysis-card analysis-risk-box">
              <h3>{riskMeta?.label ?? risk}</h3>
              <label>
                {labelWithInfo('Limite operacional', 'operational_limit')}
                <input
                  type="number"
                  value={limits.operational}
                  onChange={(e) => setRiskLimit(risk, 'operational', Number(e.target.value))}
                  step="0.1"
                />
              </label>
              <label>
                {labelWithInfo('Limite atenção', 'attention_limit')}
                <input
                  type="number"
                  value={limits.attention}
                  onChange={(e) => setRiskLimit(risk, 'attention', Number(e.target.value))}
                  step="0.1"
                />
              </label>
            </div>
          );
        })}
      </section>

      <section className="analysis-section">
        <div className="analysis-card">
          <button className="analysis-run" onClick={handleRun} disabled={!canRun || isRunning}>
            {isRunning ? 'Analisando...' : 'Analisar'}
          </button>
          {!!result && (
            <button className="analysis-run secondary" onClick={handleSaveAsset} style={{ marginLeft: 12 }}>
              Salvar em Meus Ativos
            </button>
          )}
        </div>
      </section>

      {result && (
        <section className="analysis-section">
          <div className="analysis-card">
            <h3 className="summary-title-with-info">
              Resumo Consolidado
              <HelpIconButton onClick={() => setActiveHelp('summary')} label="Informação sobre resumo consolidado" />
            </h3>
            <div className="analysis-summary">
              <div>
                <span>Horas Operacionais</span>
                <strong>{result.combined.operational_hours}</strong>
              </div>
              <div>
                <span>Horas em Atenção</span>
                <strong>{result.combined.attention_hours}</strong>
              </div>
              <div>
                <span>Horas em Parada</span>
                <strong>{result.combined.stop_hours}</strong>
              </div>
              <div>
                <span>Total de Horas</span>
                <strong>{result.combined.total_hours}</strong>
              </div>
              <div>
                <span>Valor do Ativo</span>
                <strong>{assetValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div>
                <span>Impacto Estimado</span>
                <strong>{estimatedAssetImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div>
                <span>Impacto EBITDA anual</span>
                <strong>{annualEbitdaImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div>
                <span>EBITDA pós-risco</span>
                <strong>{annualEbitdaAfterRisk.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
              <div>
                <span>VPL do impacto ({horizonYears} anos)</span>
                <strong>{vplImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>
            </div>

            {result.pricing_models && (
              <div className="analysis-summary" style={{ marginTop: 12 }}>
                <div>
                  <span>AAL</span>
                  <strong>{result.pricing_models.aal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div>
                  <span>PML</span>
                  <strong>{result.pricing_models.pml.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div>
                  <span>VaR</span>
                  <strong>{result.pricing_models.var.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div>
                  <span>TVaR</span>
                  <strong>{result.pricing_models.tvar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div>
                  <span>Prêmio puro</span>
                  <strong>{result.pricing_models.pure_premium.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
                <div>
                  <span>Prêmio técnico</span>
                  <strong>{result.pricing_models.technical_premium.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {result && (
        <>
          {result.hazard_pricing_models && Object.keys(result.hazard_pricing_models).length > 0 && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Comparativo Financeiro por Risco</h3>
                <div className="analysis-dashboard risk-only">
                  <div className="analysis-card analysis-chart-card">
                    <h3>AAL, VaR e TVaR por risco</h3>
                    <Bar
                      data={{
                        labels: selectedRisks
                          .filter((risk) => Boolean(result.hazard_pricing_models?.[risk]))
                          .map((risk) => RISK_OPTIONS.find((item) => item.id === risk)?.label ?? risk),
                        datasets: [
                          {
                            label: 'AAL',
                            data: selectedRisks
                              .filter((risk) => Boolean(result.hazard_pricing_models?.[risk]))
                              .map((risk) => result.hazard_pricing_models?.[risk]?.aal ?? 0),
                            backgroundColor: '#0ea5e9',
                          },
                          {
                            label: 'VaR',
                            data: selectedRisks
                              .filter((risk) => Boolean(result.hazard_pricing_models?.[risk]))
                              .map((risk) => result.hazard_pricing_models?.[risk]?.var ?? 0),
                            backgroundColor: '#f59e0b',
                          },
                          {
                            label: 'TVaR',
                            data: selectedRisks
                              .filter((risk) => Boolean(result.hazard_pricing_models?.[risk]))
                              .map((risk) => result.hazard_pricing_models?.[risk]?.tvar ?? 0),
                            backgroundColor: '#ef4444',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true } },
                      }}
                    />
                  </div>

                  <div className="analysis-card analysis-chart-card">
                    <h3>Sensibilidade do prêmio técnico por quantil</h3>
                    <Line
                      data={{
                        labels: ['90%', '95%', '99%'],
                        datasets: selectedRisks
                          .filter((risk) => Boolean(result.hazard_pricing_models?.[risk]))
                          .map((risk, idx) => {
                            const riskMeta = RISK_OPTIONS.find((item) => item.id === risk);
                            const sensitivity = result.hazard_pricing_models?.[risk]?.quantile_sensitivity ?? [];
                            const palette = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
                            return {
                              label: riskMeta?.label ?? risk,
                              data: [
                                sensitivity.find((item) => item.quantile === 0.9)?.technical_premium ?? 0,
                                sensitivity.find((item) => item.quantile === 0.95)?.technical_premium ?? 0,
                                sensitivity.find((item) => item.quantile === 0.99)?.technical_premium ?? 0,
                              ],
                              borderColor: palette[idx % palette.length],
                              backgroundColor: palette[idx % palette.length],
                              borderWidth: 2,
                              pointRadius: 3,
                              tension: 0.2,
                            };
                          }),
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>
                </div>
                <p className="analysis-hint">
                  Comparação financeira por risco individual com base no método de carga selecionado e sensibilidade de prêmio para quantis de 90%, 95% e 99%.
                </p>
              </div>
            </section>
          )}

          {selectedRisks.map((risk) => {
            const dist = result.distributions[risk];
            const riskMeta = RISK_OPTIONS.find((item) => item.id === risk);

            if (!dist) {
              return (
                <section key={`missing-${risk}`} className="analysis-section">
                  <div className="analysis-card">
                    <h3>{riskMeta?.label ?? risk}</h3>
                    <p className="analysis-hint">Sem distribuição retornada para este risco.</p>
                  </div>
                </section>
              );
            }

            return (
              <section key={`dash-${risk}`} className="analysis-section">
                <div className="analysis-card">
                  <h3>Dashboard - {riskMeta?.label ?? risk}</h3>
                  <div className="analysis-dashboard risk-only">
                    <div className="analysis-card analysis-chart-card">
                      <h3>Histograma</h3>
                      <ChartExpandButton
                        onClick={() =>
                          setExpandedChart({
                            title: `Histograma - ${riskMeta?.label ?? risk}`,
                            content: (
                              <div className="chart-modal-plot">
                                <Bar
                                  data={{
                                    labels: dist.hist_bins.map((bin) => bin.toFixed(2)),
                                    datasets: [{
                                      label: riskMeta?.label ?? risk,
                                      data: dist.hist_counts,
                                      backgroundColor: '#38bdf8',
                                    }],
                                  }}
                                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                                />
                              </div>
                            ),
                          })
                        }
                        label="Ampliar histograma"
                      />
                      <Bar
                        data={{
                          labels: dist.hist_bins.map((bin) => bin.toFixed(2)),
                          datasets: [{
                            label: riskMeta?.label ?? risk,
                            data: dist.hist_counts,
                            backgroundColor: '#38bdf8',
                          }],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                      />
                    </div>

                    <div className="analysis-card analysis-chart-card">
                      <h3>Curva de Excedência</h3>
                      <ChartExpandButton
                        onClick={() =>
                          setExpandedChart({
                            title: `Curva de Excedência - ${riskMeta?.label ?? risk}`,
                            content: (
                              <div className="chart-modal-plot">
                                <Line
                                  data={{
                                    labels: dist.exceedance_values.map((val) => val.toFixed(2)),
                                    datasets: [{
                                      label: 'Excedência',
                                      data: dist.exceedance_probs,
                                      borderColor: '#f97316',
                                      borderWidth: 2,
                                      pointRadius: 0,
                                    }],
                                  }}
                                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                                />
                              </div>
                            ),
                          })
                        }
                        label="Ampliar curva de excedência"
                      />
                      <Line
                        data={{
                          labels: dist.exceedance_values.map((val) => val.toFixed(2)),
                          datasets: [{
                            label: 'Excedência',
                            data: dist.exceedance_probs,
                            borderColor: '#f97316',
                            borderWidth: 2,
                            pointRadius: 0,
                          }],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="analysis-dashboard">
            <div className="analysis-card analysis-chart-card">
              <h3>Excedência Combinada</h3>
              {result.combined_exceedance?.values?.length > 0 && (
                <ChartExpandButton
                  onClick={() =>
                    setExpandedChart({
                      title: 'Excedência Combinada',
                      content: (
                        <div className="chart-modal-plot">
                          <Line
                            data={{
                              labels: result.combined_exceedance.values.map((val) => val.toFixed(2)),
                              datasets: [{
                                label: 'Excedência combinada',
                                data: result.combined_exceedance.probs,
                                borderColor: '#0ea5e9',
                                borderWidth: 2,
                                pointRadius: 0,
                              }],
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                          />
                        </div>
                      ),
                    })
                  }
                  label="Ampliar excedência combinada"
                />
              )}
              {result.combined_exceedance?.values?.length > 0 ? (
                <Line
                  data={{
                    labels: result.combined_exceedance.values.map((val) => val.toFixed(2)),
                    datasets: [{
                      label: 'Excedência combinada',
                      data: result.combined_exceedance.probs,
                      borderColor: '#0ea5e9',
                      borderWidth: 2,
                      pointRadius: 0,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              ) : (
                <p className="analysis-hint">Sem curva combinada para os riscos selecionados.</p>
              )}
            </div>

            <div className="analysis-card analysis-chart-card">
              <h3>Rosa dos Ventos por Intensidade</h3>
              {result.wind_rose?.counts?.length && result.wind_rose?.direction_labels?.length ? (
                <ChartExpandButton
                  onClick={() =>
                    setExpandedChart({
                      title: 'Rosa dos Ventos por Intensidade',
                      content: (
                        <ThresholdWindRose
                          directionLabels={result.wind_rose.direction_labels}
                          totalCounts={result.wind_rose.counts}
                          operationalCounts={result.wind_rose.operational_counts ?? result.wind_rose.counts.map(() => 0)}
                          attentionCounts={result.wind_rose.attention_counts ?? result.wind_rose.counts.map(() => 0)}
                          stopCounts={result.wind_rose.stop_counts ?? result.wind_rose.counts.map(() => 0)}
                          size={760}
                        />
                      ),
                    })
                  }
                  label="Ampliar rosa dos ventos"
                />
              ) : null}
              {result.wind_rose?.counts?.length && result.wind_rose?.direction_labels?.length ? (
                <>
                  <ThresholdWindRose
                    directionLabels={result.wind_rose.direction_labels}
                    totalCounts={result.wind_rose.counts}
                    operationalCounts={result.wind_rose.operational_counts ?? result.wind_rose.counts.map(() => 0)}
                    attentionCounts={result.wind_rose.attention_counts ?? result.wind_rose.counts.map(() => 0)}
                    stopCounts={result.wind_rose.stop_counts ?? result.wind_rose.counts.map(() => 0)}
                  />
                  {result.wind_rose.limits && (
                    <p className="analysis-hint">
                      Limites aplicados: operacional &lt;= {result.wind_rose.limits.operational_max} | atenção &lt;= {result.wind_rose.limits.attention_max}. As circunferências representam percentual de ocorrência e as fatias mostram, por direção, quanto ocorreu em operacional/atenção/parada.
                    </p>
                  )}
                </>
              ) : (
                <p className="analysis-hint">A rosa dos ventos aparece quando o risco de vento está selecionado.</p>
              )}
            </div>
          </section>

          {windComplete && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Análise Completa de Vento</h3>
                <div className="analysis-summary" style={{ marginBottom: 12 }}>
                  <div>
                    <span>Maior janela contínua de parada</span>
                    <strong>{windComplete.maxStop} h</strong>
                  </div>
                  <div>
                    <span>Maior janela contínua em atenção/parada</span>
                    <strong>{windComplete.maxAttention} h</strong>
                  </div>
                </div>

                <div className="analysis-dashboard risk-only">
                  <div className="analysis-card analysis-chart-card">
                    <h3>Série temporal de vento com limites</h3>
                    <Line
                      data={{
                        labels: windComplete.sampledLabels,
                        datasets: [
                          {
                            label: 'Vento (knots)',
                            data: windComplete.sampledValues,
                            borderColor: '#0ea5e9',
                            borderWidth: 2,
                            pointRadius: 0,
                          },
                          {
                            label: 'Limite operacional',
                            data: windComplete.sampledOp,
                            borderColor: '#22c55e',
                            borderWidth: 1.5,
                            borderDash: [6, 4],
                            pointRadius: 0,
                          },
                          {
                            label: 'Limite atenção',
                            data: windComplete.sampledAtt,
                            borderColor: '#ef4444',
                            borderWidth: 1.5,
                            borderDash: [6, 4],
                            pointRadius: 0,
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>

                  <div className="analysis-card analysis-chart-card">
                    <h3>Status operacional mensal (horas)</h3>
                    <Bar
                      data={{
                        labels: windComplete.monthlyKeys,
                        datasets: [
                          {
                            label: 'Operacional',
                            data: windComplete.monthlyOperational,
                            backgroundColor: '#22c55e',
                          },
                          {
                            label: 'Atenção',
                            data: windComplete.monthlyAttention,
                            backgroundColor: '#f59e0b',
                          },
                          {
                            label: 'Parada',
                            data: windComplete.monthlyStop,
                            backgroundColor: '#ef4444',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true } },
                        scales: {
                          x: { stacked: true },
                          y: { stacked: true },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="analysis-card analysis-chart-card" style={{ marginTop: 12 }}>
                  <h3>Média mensal da velocidade do vento</h3>
                  <Line
                    data={{
                      labels: windComplete.monthlyKeys,
                      datasets: [{
                        label: 'Média mensal (knots)',
                        data: windComplete.monthlyMean,
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.2,
                      }],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                  />
                </div>
              </div>
            </section>
          )}

          {waveComplete && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Análise Completa de Onda</h3>

                <div className="analysis-card analysis-chart-card" style={{ marginTop: 12 }}>
                  <h3>Status operacional mensal (horas)</h3>
                  <Bar
                    data={{
                      labels: waveComplete.monthlyKeys,
                      datasets: [
                        {
                          label: 'Operacional',
                          data: waveComplete.monthlyOperational,
                          backgroundColor: '#22c55e',
                        },
                        {
                          label: 'Atenção',
                          data: waveComplete.monthlyAttention,
                          backgroundColor: '#f59e0b',
                        },
                        {
                          label: 'Parada',
                          data: waveComplete.monthlyStop,
                          backgroundColor: '#ef4444',
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: true } },
                      scales: {
                        x: { stacked: true },
                        y: { stacked: true },
                      },
                    }}
                  />
                </div>

                <div className="analysis-card analysis-chart-card" style={{ marginTop: 12 }}>
                  <h3>Média mensal da altura de onda</h3>
                  <Line
                    data={{
                      labels: waveComplete.monthlyKeys,
                      datasets: [{
                        label: 'Média mensal (m)',
                        data: waveComplete.monthlyMean,
                        borderColor: '#0ea5e9',
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.2,
                      }],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                  />
                </div>
              </div>
            </section>
          )}

          {windScenario?.available === false && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Histórico vs Cenário Futuro (Vento)</h3>
                <p className="analysis-hint">
                  Comparação de cenário indisponível no momento: {windScenario.message}
                </p>
              </div>
            </section>
          )}

          {windScenario && windScenario.available !== false && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Histórico vs Cenário Futuro (Vento)</h3>
                <p className="analysis-hint">
                  Comparação em {windScenario.meta.scenario.toUpperCase()} entre {windScenario.meta.historical_period} e {windScenario.meta.future_period} no ponto selecionado.
                </p>

                <div className="analysis-summary" style={{ marginBottom: 12 }}>
                  <div>
                    <span>Δ média do vento</span>
                    <strong>{windScenario.delta.mean_knots >= 0 ? '+' : ''}{windScenario.delta.mean_knots.toFixed(2)} kn</strong>
                  </div>
                  <div>
                    <span>Δ P95 do vento</span>
                    <strong>{windScenario.delta.p95_knots >= 0 ? '+' : ''}{windScenario.delta.p95_knots.toFixed(2)} kn</strong>
                  </div>
                  <div>
                    <span>Δ amostras em parada</span>
                    <strong>{windScenario.delta.stop_samples >= 0 ? '+' : ''}{windScenario.delta.stop_samples}</strong>
                  </div>
                </div>

                <div className="analysis-summary" style={{ marginBottom: 12 }}>
                  <div>
                    <span>P90 histórico</span>
                    <strong>{windScenario.historical.p90_knots.toFixed(2)} kn</strong>
                  </div>
                  <div>
                    <span>P95 histórico</span>
                    <strong>{windScenario.historical.p95_knots.toFixed(2)} kn</strong>
                  </div>
                  <div>
                    <span>P90 futuro</span>
                    <strong>{windScenario.future.p90_knots.toFixed(2)} kn</strong>
                  </div>
                  <div>
                    <span>P95 futuro</span>
                    <strong>{windScenario.future.p95_knots.toFixed(2)} kn</strong>
                  </div>
                </div>

                <div className="analysis-dashboard risk-only">
                  <div className="analysis-card analysis-chart-card">
                    <h3>Média anual (histórico vs futuro)</h3>
                    <Line
                      data={{
                        labels: [
                          ...windScenario.series.historical_years.map((year) => String(year)),
                          ...windScenario.series.future_years.map((year) => String(year)),
                        ],
                        datasets: [
                          {
                            label: 'Histórico (knots)',
                            data: [
                              ...windScenario.series.historical_yearly_mean_knots,
                              ...windScenario.series.future_years.map(() => null),
                            ],
                            borderColor: '#0ea5e9',
                            borderWidth: 2,
                            pointRadius: 2,
                            spanGaps: false,
                          },
                          {
                            label: 'Futuro (knots)',
                            data: [
                              ...windScenario.series.historical_years.map(() => null),
                              ...windScenario.series.future_yearly_mean_knots,
                            ],
                            borderColor: '#ef4444',
                            borderWidth: 2,
                            pointRadius: 2,
                            spanGaps: false,
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>

                  <div className="analysis-card analysis-chart-card">
                    <h3>Ciclo mensal médio (histórico vs futuro)</h3>
                    <Bar
                      data={{
                        labels: windScenario.series.monthly_labels,
                        datasets: [
                          {
                            label: 'Histórico (knots)',
                            data: windScenario.series.historical_monthly_mean_knots,
                            backgroundColor: '#38bdf8',
                          },
                          {
                            label: 'Futuro (knots)',
                            data: windScenario.series.future_monthly_mean_knots,
                            backgroundColor: '#f87171',
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>

                  <div className="analysis-card analysis-chart-card">
                    <h3>P90/P95 (histórico vs futuro)</h3>
                    <Bar
                      data={{
                        labels: ['P90', 'P95'],
                        datasets: [
                          {
                            label: 'Histórico (knots)',
                            data: [windScenario.historical.p90_knots, windScenario.historical.p95_knots],
                            backgroundColor: '#38bdf8',
                          },
                          {
                            label: 'Futuro (knots)',
                            data: [windScenario.future.p90_knots, windScenario.future.p95_knots],
                            backgroundColor: '#f87171',
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {waveScenario?.available === false && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Histórico vs Cenário Futuro (Onda)</h3>
                <p className="analysis-hint">
                  Comparação de cenário indisponível no momento: {waveScenario.message}
                </p>
              </div>
            </section>
          )}

          {waveScenario && waveScenario.available !== false && (
            <section className="analysis-section">
              <div className="analysis-card">
                <h3>Histórico vs Cenário Futuro (Onda)</h3>
                <p className="analysis-hint">
                  Comparação em {waveScenario.meta.scenario.toUpperCase()} entre {waveScenario.meta.historical_period} e {waveScenario.meta.future_period} no ponto selecionado.
                </p>

                <div className="analysis-summary" style={{ marginBottom: 12 }}>
                  <div>
                    <span>Δ média da onda</span>
                    <strong>{waveScenario.delta.mean_meters >= 0 ? '+' : ''}{waveScenario.delta.mean_meters.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>Δ P95 da onda</span>
                    <strong>{waveScenario.delta.p95_meters >= 0 ? '+' : ''}{waveScenario.delta.p95_meters.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>Δ amostras em parada</span>
                    <strong>{waveScenario.delta.stop_samples >= 0 ? '+' : ''}{waveScenario.delta.stop_samples}</strong>
                  </div>
                </div>

                <div className="analysis-summary" style={{ marginBottom: 12 }}>
                  <div>
                    <span>P90 histórico</span>
                    <strong>{waveScenario.historical.p90_meters.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>P95 histórico</span>
                    <strong>{waveScenario.historical.p95_meters.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>P90 futuro</span>
                    <strong>{waveScenario.future.p90_meters.toFixed(2)} m</strong>
                  </div>
                  <div>
                    <span>P95 futuro</span>
                    <strong>{waveScenario.future.p95_meters.toFixed(2)} m</strong>
                  </div>
                </div>

                <div className="analysis-dashboard risk-only">
                  <div className="analysis-card analysis-chart-card">
                    <h3>Média anual (histórico vs futuro)</h3>
                    <Line
                      data={{
                        labels: [
                          ...waveScenario.series.historical_years.map((year) => String(year)),
                          ...waveScenario.series.future_years.map((year) => String(year)),
                        ],
                        datasets: [
                          {
                            label: 'Histórico (m)',
                            data: [
                              ...waveScenario.series.historical_yearly_mean_meters,
                              ...waveScenario.series.future_years.map(() => null),
                            ],
                            borderColor: '#0ea5e9',
                            borderWidth: 2,
                            pointRadius: 2,
                            spanGaps: false,
                          },
                          {
                            label: 'Futuro (m)',
                            data: [
                              ...waveScenario.series.historical_years.map(() => null),
                              ...waveScenario.series.future_yearly_mean_meters,
                            ],
                            borderColor: '#ef4444',
                            borderWidth: 2,
                            pointRadius: 2,
                            spanGaps: false,
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>

                  <div className="analysis-card analysis-chart-card">
                    <h3>Ciclo mensal médio (histórico vs futuro)</h3>
                    <Bar
                      data={{
                        labels: waveScenario.series.monthly_labels,
                        datasets: [
                          {
                            label: 'Histórico (m)',
                            data: waveScenario.series.historical_monthly_mean_meters,
                            backgroundColor: '#38bdf8',
                          },
                          {
                            label: 'Futuro (m)',
                            data: waveScenario.series.future_monthly_mean_meters,
                            backgroundColor: '#f87171',
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>

                  <div className="analysis-card analysis-chart-card">
                    <h3>P90/P95 (histórico vs futuro)</h3>
                    <Bar
                      data={{
                        labels: ['P90', 'P95'],
                        datasets: [
                          {
                            label: 'Histórico (m)',
                            data: [waveScenario.historical.p90_meters, waveScenario.historical.p95_meters],
                            backgroundColor: '#38bdf8',
                          },
                          {
                            label: 'Futuro (m)',
                            data: [waveScenario.future.p90_meters, waveScenario.future.p95_meters],
                            backgroundColor: '#f87171',
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

        </>
      )}

      {activeHelp && (
        <HelpModal
          title={HELP_CONTENT[activeHelp].title}
          body={HELP_CONTENT[activeHelp].body}
          onClose={() => setActiveHelp(null)}
        />
      )}

      {expandedChart && (
        <ChartModal title={expandedChart.title} onClose={() => setExpandedChart(null)}>
          {expandedChart.content}
        </ChartModal>
      )}
    </div>
  );
};

export default AnalysisPage;
