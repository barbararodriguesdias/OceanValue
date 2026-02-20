import React from 'react';
import './MyAssetsPage.css';

export interface SavedAsset {
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
}

interface MyAssetsPageProps {
  assets: SavedAsset[];
  onRemoveAsset: (id: string) => void;
  onClearAssets: () => void;
}

const toRiskLabel = (risk: string) => {
  const labels: Record<string, string> = {
    wind: 'Vento',
    wave: 'Onda',
    flood: 'Inundação',
    heatwave: 'Ondas Térmicas',
    temperature: 'Temperatura',
    current: 'Corrente',
  };
  return labels[risk] ?? risk;
};

const toPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const classifyStopSeverity = (ratio: number) => {
  if (ratio >= 0.2) return 'alto';
  if (ratio >= 0.08) return 'moderado';
  return 'baixo';
};

const toMoney = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MyAssetsPage: React.FC<MyAssetsPageProps> = ({ assets, onRemoveAsset, onClearAssets }) => {
  const [openDidacticSummaryIds, setOpenDidacticSummaryIds] = React.useState<Record<string, boolean>>({});

  const toggleDidacticSummary = (id: string) => {
    setOpenDidacticSummaryIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="my-assets-page">
      <header className="my-assets-header">
        <h2>Meus Ativos</h2>
        <p>Consultas rápidas das análises salvas (vento/onda e impactos financeiros).</p>
      </header>

      <section className="my-assets-actions">
        <button className="my-assets-clear" onClick={onClearAssets} disabled={assets.length === 0}>
          Limpar lista
        </button>
      </section>

      {assets.length === 0 ? (
        <div className="my-assets-empty">
          <p>Nenhum ativo salvo ainda. Faça uma análise e clique em "Salvar em Meus Ativos".</p>
        </div>
      ) : (
        <section className="my-assets-grid">
          {assets.map((asset) => (
            <article key={asset.id} className="my-assets-card">
              <div className="my-assets-card-header">
                <h3>{asset.name}</h3>
                <div className="my-assets-card-actions">
                  <button
                    className="my-assets-summary-btn"
                    onClick={() => toggleDidacticSummary(asset.id)}
                  >
                    {openDidacticSummaryIds[asset.id] ? 'Ocultar resumo didático' : 'Resumo didático'}
                  </button>
                  <button className="my-assets-remove" onClick={() => onRemoveAsset(asset.id)}>
                    Remover
                  </button>
                </div>
              </div>

              <p className="my-assets-meta">Salvo em: {new Date(asset.createdAt).toLocaleString('pt-BR')}</p>
              <p className="my-assets-meta">Ponto: {asset.point.lat.toFixed(5)}, {asset.point.lon.toFixed(5)}</p>
              <p className="my-assets-meta">Período: {asset.period.start} a {asset.period.end}</p>
              <p className="my-assets-meta">Riscos: {asset.risks.join(', ')}</p>

              <div className="my-assets-summary">
                <div>
                  <span>Parada</span>
                  <strong>{asset.summary.stopHours} h</strong>
                </div>
                <div>
                  <span>Impacto no ativo</span>
                  <strong>{toMoney(asset.summary.estimatedAssetImpact)}</strong>
                </div>
                <div>
                  <span>Impacto EBITDA anual</span>
                  <strong>{toMoney(asset.summary.annualEbitdaImpact)}</strong>
                </div>
                <div>
                  <span>VPL impacto</span>
                  <strong>{toMoney(asset.summary.vplImpact)}</strong>
                </div>
              </div>

              {openDidacticSummaryIds[asset.id] && (() => {
                const totalHours = Math.max(asset.summary.totalHours, 1);
                const opRatio = asset.summary.operationalHours / totalHours;
                const attentionRatio = asset.summary.attentionHours / totalHours;
                const stopRatio = asset.summary.stopHours / totalHours;
                const ebitdaImpactRatio = asset.summary.annualEbitda > 0
                  ? asset.summary.annualEbitdaImpact / asset.summary.annualEbitda
                  : 0;
                const stopSeverity = classifyStopSeverity(stopRatio);

                return (
                  <div className="my-assets-didactic">
                    <h4>Resumo didático da análise</h4>
                    <p>
                      No período analisado, o ativo ficou <strong>{toPercent(opRatio)}</strong> do tempo em condição operacional,
                      <strong> {toPercent(attentionRatio)}</strong> em atenção e <strong>{toPercent(stopRatio)}</strong> em parada.
                    </p>
                    <p>
                      Isso indica um nível <strong>{stopSeverity}</strong> de exposição a interrupção operacional para os riscos de{' '}
                      <strong>{asset.risks.map(toRiskLabel).join(', ')}</strong>.
                    </p>
                    <p>
                      Em termos financeiros, a perda anual estimada de EBITDA é de <strong>{toMoney(asset.summary.annualEbitdaImpact)}</strong>
                      ({toPercent(ebitdaImpactRatio)} do EBITDA anual de referência), com EBITDA pós-risco de{' '}
                      <strong>{toMoney(asset.summary.annualEbitdaAfterRisk)}</strong>.
                    </p>
                    <p>
                      No horizonte de <strong>{asset.summary.horizonYears} anos</strong>, usando taxa de desconto de{' '}
                      <strong>{toPercent(asset.summary.discountRate)}</strong>, o VPL acumulado do impacto é de{' '}
                      <strong>{toMoney(asset.summary.vplImpact)}</strong>.
                    </p>
                    <p>
                      Leitura rápida: priorize mitigação para reduzir horas de parada e atenção, pois esses blocos são os principais
                      motores da perda econômica projetada.
                    </p>
                  </div>
                );
              })()}
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default MyAssetsPage;
