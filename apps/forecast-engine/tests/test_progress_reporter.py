"""Tests for progress reporting."""

import json
from unittest.mock import AsyncMock

import pytest

from src.workers.progress_reporter import (
    InMemoryProgressReporter,
    ProgressEvent,
    RedisProgressReporter,
)


class TestProgressEvent:
    def test_event_fields(self) -> None:
        event = ProgressEvent(
            job_id="job-1",
            step=3,
            total_steps=10,
            step_name="execute_tft",
            percent=30,
            products_processed=100,
            products_total=500,
        )
        assert event.job_id == "job-1"
        assert event.step == 3
        assert event.step_name == "execute_tft"
        assert event.status == "running"
        assert event.error is None

    def test_event_with_error(self) -> None:
        event = ProgressEvent(
            job_id="job-1",
            step=5,
            total_steps=10,
            step_name="execute_croston_tsb",
            percent=50,
            products_processed=0,
            products_total=100,
            status="failed",
            error="Model training failed",
        )
        assert event.status == "failed"
        assert event.error == "Model training failed"


class TestInMemoryProgressReporter:
    @pytest.mark.asyncio
    async def test_report_stores_event(self) -> None:
        reporter = InMemoryProgressReporter()
        event = ProgressEvent(
            job_id="j1", step=1, total_steps=10,
            step_name="load_data", percent=10,
            products_processed=5, products_total=50,
        )
        await reporter.report(event)
        assert len(reporter.events) == 1
        assert reporter.events[0].job_id == "j1"

    @pytest.mark.asyncio
    async def test_report_completed(self) -> None:
        reporter = InMemoryProgressReporter()
        await reporter.report_completed("j1", 12.5)
        assert len(reporter.completions) == 1
        assert reporter.completions[0]["job_id"] == "j1"
        assert reporter.completions[0]["duration_seconds"] == 12.5

    @pytest.mark.asyncio
    async def test_report_failed(self) -> None:
        reporter = InMemoryProgressReporter()
        await reporter.report_failed("j1", "timeout", 5)
        assert len(reporter.failures) == 1
        assert reporter.failures[0]["error"] == "timeout"
        assert reporter.failures[0]["step"] == 5

    @pytest.mark.asyncio
    async def test_multiple_events(self) -> None:
        reporter = InMemoryProgressReporter()
        for i in range(5):
            await reporter.report(
                ProgressEvent(
                    job_id="j1", step=i, total_steps=10,
                    step_name=f"step_{i}", percent=i * 10,
                    products_processed=i, products_total=50,
                )
            )
        assert len(reporter.events) == 5


class TestRedisProgressReporter:
    @pytest.mark.asyncio
    async def test_publishes_event(self) -> None:
        mock_redis = AsyncMock()
        reporter = RedisProgressReporter(mock_redis)

        event = ProgressEvent(
            job_id="j1", step=3, total_steps=10,
            step_name="execute_tft", percent=30,
            products_processed=10, products_total=100,
        )
        await reporter.report(event)

        mock_redis.publish.assert_called_once()
        channel, payload = mock_redis.publish.call_args[0]
        assert channel == "forecast:progress:j1"
        data = json.loads(payload)
        assert data["step"] == 3
        assert data["step_name"] == "execute_tft"

    @pytest.mark.asyncio
    async def test_publishes_completed(self) -> None:
        mock_redis = AsyncMock()
        reporter = RedisProgressReporter(mock_redis)

        await reporter.report_completed("j1", 45.3)

        channel, payload = mock_redis.publish.call_args[0]
        assert channel == "forecast:progress:j1"
        data = json.loads(payload)
        assert data["status"] == "completed"
        assert data["duration_seconds"] == 45.3

    @pytest.mark.asyncio
    async def test_publishes_failed(self) -> None:
        mock_redis = AsyncMock()
        reporter = RedisProgressReporter(mock_redis)

        await reporter.report_failed("j1", "OOM error", 4)

        channel, payload = mock_redis.publish.call_args[0]
        data = json.loads(payload)
        assert data["status"] == "failed"
        assert data["error"] == "OOM error"
        assert data["step"] == 4

    def test_channel_format(self) -> None:
        reporter = RedisProgressReporter(AsyncMock())
        assert reporter._channel("abc-123") == "forecast:progress:abc-123"
