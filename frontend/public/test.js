/* Test file - simulate user interaction */

// Test data for heatmap rendering
const testConfig = {
  riskType: 'wind',
  region: 'geral',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  latMin: -30.271,
  latMax: -17.186,
  lonMin: -50.264,
  lonMax: -35.293,
  varMin: 5,
  varMax: 25,
  layers: {
    baciaSantos: true,
    baciaCampos: false,
    blocosExploratorios: false,
    camposProducao: false,
  }
};

console.log('✅ Test Config loaded:', testConfig);
console.log('📊 Heatmap should render with wind speeds from', testConfig.varMin, 'to', testConfig.varMax, 'm/s');
