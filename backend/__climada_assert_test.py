import numpy as np
from app.services.climada_petals import climada_petals_engine

x = np.array([100.0, 200.0, 300.0, 400.0], dtype=float)
r = climada_petals_engine.compute_pricing(
    loss_per_step=x,
    annualization=1.0,
    risk_quantile=0.95,
    risk_load_method='tvar',
    expense_ratio=0.1,
)

assert r.get('engine') == 'climada', 'engine should be climada'
assert isinstance(r.get('petals_appendix'), dict), 'petals_appendix should be dict'
assert len(r['petals_appendix'].get('petals_labels', [])) > 0, 'petals_labels should not be empty'
assert len(r['petals_appendix'].get('petals_values', [])) > 0, 'petals_values should not be empty'

print('PASS: CLIMADA+PETALS pricing payload validated')
