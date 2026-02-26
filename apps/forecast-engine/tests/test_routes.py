"""Tests for API route stubs."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from src.db.database import get_session
from src.main import app


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def client(mock_session: AsyncMock) -> TestClient:
    async def override_get_session():  # type: ignore[no-untyped-def]
        yield mock_session

    app.dependency_overrides[get_session] = override_get_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_root(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "ForecastingMRP Forecast Engine"
    assert "version" in data


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "forecast-engine"


def test_train_returns_202(client: TestClient) -> None:
    response = client.post("/train", json={"force_retrain": False})
    assert response.status_code == 202
    data = response.json()
    assert "execucao_id" in data
    assert data["status"] == "PENDENTE"
    assert data["message"] == "Training job queued"


def test_predict_returns_202(client: TestClient) -> None:
    response = client.post("/predict", json={"horizonte_semanas": 13})
    assert response.status_code == 202
    data = response.json()
    assert "execucao_id" in data
    assert data["status"] == "PENDENTE"


def test_backtest_returns_202(client: TestClient) -> None:
    response = client.post("/backtest", json={"holdout_weeks": 13})
    assert response.status_code == 202
    data = response.json()
    assert "execucao_id" in data
    assert data["status"] == "PENDENTE"


def test_models_returns_empty_list(client: TestClient) -> None:
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert data["models"] == []
    assert data["total"] == 0
