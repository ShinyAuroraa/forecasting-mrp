"""Progress reporting — publishes step events via Redis pub/sub (FR-030)."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ProgressEvent:
    """A single progress event for a pipeline step."""

    job_id: str
    step: int
    total_steps: int
    step_name: str
    percent: int
    products_processed: int
    products_total: int
    status: str = "running"
    error: str | None = None


class ProgressReporter(Protocol):
    """Protocol for reporting pipeline progress."""

    async def report(self, event: ProgressEvent) -> None:
        """Publish a progress event."""
        ...

    async def report_completed(self, job_id: str, duration_seconds: float) -> None:
        """Report job completion."""
        ...

    async def report_failed(self, job_id: str, error: str, step: int) -> None:
        """Report job failure."""
        ...


class RedisProgressReporter:
    """Publishes progress events to a Redis pub/sub channel.

    Channel format: ``forecast:progress:{job_id}``
    """

    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    def _channel(self, job_id: str) -> str:
        return f"forecast:progress:{job_id}"

    async def report(self, event: ProgressEvent) -> None:
        payload = json.dumps(asdict(event))
        await self._redis.publish(            self._channel(event.job_id), payload
        )

    async def report_completed(self, job_id: str, duration_seconds: float) -> None:
        payload = json.dumps(
            {
                "job_id": job_id,
                "status": "completed",
                "duration_seconds": round(duration_seconds, 2),
            }
        )
        await self._redis.publish(            self._channel(job_id), payload
        )

    async def report_failed(self, job_id: str, error: str, step: int) -> None:
        payload = json.dumps(
            {
                "job_id": job_id,
                "status": "failed",
                "error": error,
                "step": step,
            }
        )
        await self._redis.publish(            self._channel(job_id), payload
        )


class InMemoryProgressReporter:
    """In-memory reporter for testing — stores events in a list."""

    def __init__(self) -> None:
        self.events: list[ProgressEvent] = []
        self.completions: list[dict[str, object]] = []
        self.failures: list[dict[str, object]] = []

    async def report(self, event: ProgressEvent) -> None:
        self.events.append(event)

    async def report_completed(self, job_id: str, duration_seconds: float) -> None:
        self.completions.append(
            {"job_id": job_id, "duration_seconds": duration_seconds}
        )

    async def report_failed(self, job_id: str, error: str, step: int) -> None:
        self.failures.append({"job_id": job_id, "error": error, "step": step})
