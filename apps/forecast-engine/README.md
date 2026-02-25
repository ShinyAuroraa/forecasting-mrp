# @forecasting-mrp/forecast-engine

ML/Forecasting engine for ForecastingMRP built with FastAPI (Python).

## Tech Stack

- **Framework:** FastAPI
- **ML:** PyTorch, scikit-learn, statsmodels
- **Time Series:** Prophet, NeuralProphet
- **Database:** PostgreSQL 16 (via SQLAlchemy + Alembic)
- **Queue:** Redis

## Development

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Runs on `http://localhost:8000`.
