"""Aggregate, privacy-preserving verification counters behind ``GET /v1/stats``.

The collector stores counts only: status, source type, language, a latency
histogram, per-day totals and the number of source outages. It never receives
quote text, references, evidence, request identifiers or client addresses, so
nothing it stores or persists can reveal what was checked or by whom.

Source types and languages outside the configured set are counted as ``other``,
so a client cannot grow the counter table by sending arbitrary labels.

Persistence is optional: with a path, the counters are loaded at startup and
written atomically (temporary file plus rename) by :meth:`StatsCollector.flush`.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import time
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from isnad_core.models import MatchStatus

LATENCY_BUCKETS_MS: tuple[int, ...] = (5, 10, 25, 50, 100, 250, 500, 1000)
WINDOW_DAYS = 30
FLUSH_INTERVAL_SECONDS = 60.0
OTHER_LABEL = "other"
_FILE_FORMAT_VERSION = 1
_STATUS_VALUES = tuple(status.value for status in MatchStatus)

logger = logging.getLogger(__name__)


def _iso_timestamp(timestamp: float) -> str:
    return (
        datetime.fromtimestamp(timestamp, UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    )


def _non_negative_int(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("Expected a non-negative integer counter.")
    return value


class StatsCollector:
    """Thread-safe in-memory counters, optionally persisted to a JSON file."""

    def __init__(
        self,
        *,
        path: str | Path | None = None,
        source_types: Iterable[str] = ("quran", "hadith"),
        languages: Iterable[str] = ("ar", "en"),
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._lock = threading.Lock()
        self._path = Path(path) if path else None
        self._source_types = frozenset(source_types)
        self._languages = frozenset(languages)
        self._clock = clock
        self._started_at = clock()
        self._collecting_since = self._started_at
        self._counts: dict[tuple[str, str, str], int] = {}
        self._latency_buckets = [0] * (len(LATENCY_BUCKETS_MS) + 1)
        self._latency_sum_ms = 0.0
        self._latency_count = 0
        self._source_unavailable = 0
        self._daily: dict[str, dict[str, Any]] = {}

    @property
    def persistent(self) -> bool:
        """Return whether counters survive a restart through the configured file."""

        return self._path is not None

    @property
    def path(self) -> Path | None:
        """Return the persistence file, if any."""

        return self._path

    def _today(self) -> str:
        return datetime.fromtimestamp(self._clock(), UTC).date().isoformat()

    def _day_bucket(self, day: str) -> dict[str, Any]:
        bucket = self._daily.get(day)
        if bucket is None:
            bucket = {"by_status": {}, "source_unavailable_errors": 0}
            self._daily[day] = bucket
            self._prune_days(day)
        return bucket

    def _prune_days(self, today: str) -> None:
        oldest = (date.fromisoformat(today) - timedelta(days=WINDOW_DAYS - 1)).isoformat()
        for day in [day for day in self._daily if day < oldest]:
            del self._daily[day]

    def record_result(
        self,
        status: MatchStatus | str,
        source_type: str,
        language: str,
        latency_ms: float | None = None,
    ) -> None:
        """Count one completed verification. Takes labels only, never request content."""

        status_value = MatchStatus(status).value
        source_label = source_type if source_type in self._source_types else OTHER_LABEL
        language_label = language if language in self._languages else OTHER_LABEL
        with self._lock:
            key = (status_value, source_label, language_label)
            self._counts[key] = self._counts.get(key, 0) + 1
            by_status = self._day_bucket(self._today())["by_status"]
            by_status[status_value] = by_status.get(status_value, 0) + 1
            if latency_ms is not None and latency_ms >= 0:
                self._latency_count += 1
                self._latency_sum_ms += latency_ms
                for index, bound in enumerate(LATENCY_BUCKETS_MS):
                    if latency_ms <= bound:
                        self._latency_buckets[index] += 1
                        break
                else:
                    self._latency_buckets[-1] += 1

    def record_source_unavailable(self) -> None:
        """Count one verification that failed because a checked source was unreachable."""

        with self._lock:
            self._source_unavailable += 1
            self._day_bucket(self._today())["source_unavailable_errors"] += 1

    def snapshot(self) -> dict[str, Any]:
        """Return the aggregate counters in the public ``/v1/stats`` shape."""

        now = self._clock()
        today = datetime.fromtimestamp(now, UTC).date()
        with self._lock:
            totals_by_status = dict.fromkeys(_STATUS_VALUES, 0)
            for (status, _, _), count in self._counts.items():
                totals_by_status[status] += count
            breakdown = [
                {"status": status, "source_type": source, "language": language, "count": count}
                for (status, source, language), count in sorted(self._counts.items())
            ]
            daily = []
            for offset in range(WINDOW_DAYS - 1, -1, -1):
                day = (today - timedelta(days=offset)).isoformat()
                bucket = self._daily.get(day, {"by_status": {}, "source_unavailable_errors": 0})
                by_status = dict.fromkeys(_STATUS_VALUES, 0)
                by_status.update(bucket["by_status"])
                daily.append(
                    {
                        "date": day,
                        "total": sum(by_status.values()),
                        "by_status": by_status,
                        "source_unavailable_errors": bucket["source_unavailable_errors"],
                    }
                )
            bounds: list[int | None] = [*LATENCY_BUCKETS_MS, None]
            latency = {
                "buckets": [
                    {"le_ms": bound, "count": count}
                    for bound, count in zip(bounds, self._latency_buckets, strict=True)
                ],
                "count": self._latency_count,
                "sum_ms": round(self._latency_sum_ms, 3),
                "mean_ms": (
                    round(self._latency_sum_ms / self._latency_count, 3)
                    if self._latency_count
                    else None
                ),
            }
            return {
                "persistent": self.persistent,
                "started_at": _iso_timestamp(self._started_at),
                "collecting_since": _iso_timestamp(self._collecting_since),
                "uptime_seconds": round(max(0.0, now - self._started_at), 3),
                "window_days": WINDOW_DAYS,
                "totals": {
                    "verifications": sum(totals_by_status.values()),
                    "source_unavailable_errors": self._source_unavailable,
                    "by_status": totals_by_status,
                },
                "breakdown": breakdown,
                "latency": latency,
                "daily": daily,
            }

    # -- Persistence ----------------------------------------------------------

    def _serialize(self) -> dict[str, Any]:
        with self._lock:
            return {
                "version": _FILE_FORMAT_VERSION,
                "collecting_since": self._collecting_since,
                "counts": [
                    {"status": status, "source_type": source, "language": language, "count": n}
                    for (status, source, language), n in sorted(self._counts.items())
                ],
                "latency": {
                    "bounds_ms": list(LATENCY_BUCKETS_MS),
                    "buckets": list(self._latency_buckets),
                    "sum_ms": self._latency_sum_ms,
                    "count": self._latency_count,
                },
                "source_unavailable_errors": self._source_unavailable,
                "daily": {
                    day: {
                        "by_status": dict(bucket["by_status"]),
                        "source_unavailable_errors": bucket["source_unavailable_errors"],
                    }
                    for day, bucket in sorted(self._daily.items())
                },
            }

    def load(self) -> bool:
        """Load counters from the persistence file; return whether anything was loaded.

        A missing file starts empty. An unreadable or invalid file is logged and
        ignored (and later overwritten), so a bad file never stops the service.
        """

        if self._path is None or not self._path.is_file():
            return False
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
            state = self._parse(payload)
        except (OSError, ValueError, TypeError, KeyError) as exc:
            logger.warning("Ignoring unreadable stats file %s: %s", self._path, exc)
            return False
        with self._lock:
            (
                self._collecting_since,
                self._counts,
                self._latency_buckets,
                self._latency_sum_ms,
                self._latency_count,
                self._source_unavailable,
                self._daily,
            ) = state
            self._prune_days(self._today())
        return True

    def _parse(self, payload: Any) -> tuple[Any, ...]:
        if not isinstance(payload, dict) or payload.get("version") != _FILE_FORMAT_VERSION:
            raise ValueError("Unsupported stats file format.")
        collecting_since = float(payload["collecting_since"])
        counts: dict[tuple[str, str, str], int] = {}
        for row in payload["counts"]:
            status = MatchStatus(row["status"]).value
            source = row["source_type"] if row["source_type"] in self._source_types else OTHER_LABEL
            language = row["language"] if row["language"] in self._languages else OTHER_LABEL
            key = (status, source, language)
            counts[key] = counts.get(key, 0) + _non_negative_int(row["count"])
        latency = payload["latency"]
        if list(latency["bounds_ms"]) != list(LATENCY_BUCKETS_MS):
            raise ValueError("Stats file latency buckets do not match this version.")
        buckets = [_non_negative_int(value) for value in latency["buckets"]]
        if len(buckets) != len(LATENCY_BUCKETS_MS) + 1:
            raise ValueError("Stats file has the wrong number of latency buckets.")
        latency_sum = float(latency["sum_ms"])
        latency_count = _non_negative_int(latency["count"])
        source_unavailable = _non_negative_int(payload["source_unavailable_errors"])
        daily: dict[str, dict[str, Any]] = {}
        for day, bucket in payload["daily"].items():
            date.fromisoformat(day)
            daily[day] = {
                "by_status": {
                    MatchStatus(status).value: _non_negative_int(count)
                    for status, count in bucket["by_status"].items()
                },
                "source_unavailable_errors": _non_negative_int(bucket["source_unavailable_errors"]),
            }
        return (
            collecting_since,
            counts,
            buckets,
            latency_sum,
            latency_count,
            source_unavailable,
            daily,
        )

    def flush(self) -> None:
        """Write the counters to the persistence file atomically; no-op without a path."""

        if self._path is None:
            return
        data = json.dumps(self._serialize(), ensure_ascii=False, sort_keys=True)
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            descriptor, temporary = tempfile.mkstemp(
                dir=self._path.parent, prefix=f".{self._path.name}.", suffix=".tmp"
            )
            try:
                with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                    handle.write(data)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, self._path)
            except BaseException:
                Path(temporary).unlink(missing_ok=True)
                raise
        except OSError as exc:
            logger.warning("Could not write stats file %s: %s", self._path, exc)
