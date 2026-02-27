"""Aggregate all API routers into a single router."""

from fastapi import APIRouter

from src.api.health import router as health_router
from src.api.routes.backtest import router as backtest_router
from src.api.routes.models_meta import router as models_router
from src.api.routes.pdf_parse import router as pdf_parse_router
from src.api.routes.predict import router as predict_router
from src.api.routes.train import router as train_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(train_router, tags=["training"])
api_router.include_router(predict_router, tags=["prediction"])
api_router.include_router(backtest_router, tags=["backtesting"])
api_router.include_router(models_router, tags=["models"])
api_router.include_router(pdf_parse_router, tags=["pdf-parsing"])
