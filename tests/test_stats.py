"""Server statistics: opt-in endpoint, aggregate counters only, optional persistence."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from isnad_core.api.app import create_app
from isnad_core.api.stats import LATENCY_BUCKETS_MS, WINDOW_DAYS, StatsCollector
from isnad_core.engine import VerificationEngine
from isnad_core.hadith import HadeethEncClient, HadeethEncVerifier
from isnad_core.models import MatchStatus
from isnad_core.quran import QuranArabicVerifier, QuranCorpus

_CANARY_QUOTE = "PRIVATE_QUOTE_CANARY كلمات خاصة"
_CANARY_REFERENCE = "2:255"


@pytest.fixture(scope="module")
def quran_engine() -> VerificationEngine:
    return VerificationEngine((QuranArabicVerifier(),))


def _verify(client: TestClient, **payload: str) -> httpx.Response:
    return client.post("/v1/verify", json={"source_type": "quran", "language": "ar", **payload})


def test_stats_endpoint_is_404_when_disabled(
    monkeypatch: pytest.MonkeyPatch, quran_engine: VerificationEngine
) -> None:
    monkeypatch.delenv("ISNAD_STATS_ENABLED", raising=False)
    with TestClient(create_app(quran_engine, cors_origins=[])) as client:
        response = client.get("/v1/stats")
        arabic = client.get("/v1/stats", headers={"Accept-Language": "ar"})
        capabilities = client.get("/v1/capabilities").json()

    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "not_found"
    assert payload["error"]["message"]
    assert payload["request_id"] == response.headers["x-request-id"]
    assert arabic.json()["error"]["code"] == "not_found"
    assert arabic.json()["error"]["message"] != payload["error"]["message"]
    assert capabilities["stats_enabled"] is False


def test_stats_endpoint_is_enabled_by_environment(
    monkeypatch: pytest.MonkeyPatch, quran_engine: VerificationEngine
) -> None:
    monkeypatch.setenv("ISNAD_STATS_ENABLED", "1")
    monkeypatch.delenv("ISNAD_STATS_PATH", raising=False)
    with TestClient(create_app(quran_engine, cors_origins=[])) as client:
        response = client.get("/v1/stats")
        capabilities = client.get("/v1/capabilities").json()

    assert response.status_code == 200
    assert response.json()["persistent"] is False
    assert capabilities["stats_enabled"] is True


def test_verifications_increment_counters_without_storing_request_content(
    quran_engine: VerificationEngine,
) -> None:
    source_text = QuranCorpus.load_default().verses_by_reference["1:1"].text
    app = create_app(quran_engine, cors_origins=[], stats_enabled=True, stats_path=None)
    with TestClient(app) as client:
        statuses = [
            _verify(client, quote=source_text, reference="1:1").json()["status"],
            _verify(client, quote=_CANARY_QUOTE, reference=_CANARY_REFERENCE).json()["status"],
            _verify(client, quote=_CANARY_QUOTE).json()["status"],
        ]
        assert statuses == [
            "exact_match",
            "mismatch_at_cited_reference",
            "not_found_in_checked_corpus",
        ]
        unsupported = client.post(
            "/v1/verify",
            json={"source_type": "tafsir-private-label", "language": "xx", "quote": "q"},
        )
        assert unsupported.json()["status"] == "unsupported_source_or_language"
        # Rejected requests are not verifications and are not counted.
        assert _verify(client, quote="ا", reference="115:1").status_code == 422
        response = client.get("/v1/stats")

    assert response.status_code == 200
    stats = response.json()
    assert stats["persistent"] is False
    assert stats["window_days"] == WINDOW_DAYS
    assert stats["uptime_seconds"] >= 0
    assert stats["totals"]["verifications"] == 4
    assert stats["totals"]["source_unavailable_errors"] == 0
    assert set(stats["totals"]["by_status"]) == {status.value for status in MatchStatus}
    assert stats["totals"]["by_status"]["exact_match"] == 1
    assert stats["totals"]["by_status"]["mismatch_at_cited_reference"] == 1
    assert stats["totals"]["by_status"]["not_found_in_checked_corpus"] == 1
    assert stats["totals"]["by_status"]["unsupported_source_or_language"] == 1
    assert {
        (row["status"], row["source_type"], row["language"], row["count"])
        for row in stats["breakdown"]
    } == {
        ("exact_match", "quran", "ar", 1),
        ("mismatch_at_cited_reference", "quran", "ar", 1),
        ("not_found_in_checked_corpus", "quran", "ar", 1),
        ("unsupported_source_or_language", "other", "other", 1),
    }

    latency = stats["latency"]
    assert [bucket["le_ms"] for bucket in latency["buckets"]] == [*LATENCY_BUCKETS_MS, None]
    assert sum(bucket["count"] for bucket in latency["buckets"]) == latency["count"] == 4
    assert latency["mean_ms"] == pytest.approx(latency["sum_ms"] / 4, abs=0.01)

    assert len(stats["daily"]) == WINDOW_DAYS
    today = datetime.now(UTC).date().isoformat()
    assert stats["daily"][-1]["date"] == today
    assert stats["daily"][-1]["total"] == 4
    assert sum(day["total"] for day in stats["daily"]) == 4

    # Privacy: no quote text, reference, or client-supplied label is stored.
    serialized = response.text
    for secret in (_CANARY_QUOTE, "PRIVATE_QUOTE_CANARY", _CANARY_REFERENCE, "tafsir-private"):
        assert secret not in serialized
    assert source_text not in serialized


def test_stream_gate_results_are_counted(quran_engine: VerificationEngine) -> None:
    source_text = QuranCorpus.load_default().verses_by_reference["1:1"].text
    citation = (
        f"[[ISNAD-CITATION source=quran language=ar reference=1:1]]{source_text}[[/ISNAD-CITATION]]"
    )
    app = create_app(quran_engine, cors_origins=[], stats_enabled=True)
    with TestClient(app) as client:
        with client.websocket_connect("/v1/stream") as websocket:
            websocket.send_json({"type": "chunk", "text": f"Prose. {citation}"})
            assert websocket.receive_json()["type"] == "text"
            assert websocket.receive_json()["type"] == "citation_checking"
            assert websocket.receive_json()["result"]["status"] == "exact_match"
            websocket.send_json({"type": "finish"})
            assert websocket.receive_json() == {"type": "stream_complete"}
        stats = client.get("/v1/stats").json()

    assert stats["totals"]["verifications"] == 1
    assert stats["totals"]["by_status"]["exact_match"] == 1
    assert stats["latency"]["count"] == 1
    assert source_text not in json.dumps(stats, ensure_ascii=False)


def test_source_outages_are_counted_separately() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("synthetic outage", request=request)

    raw_client = httpx.Client(
        base_url="https://hadeethenc.com/api/v1/", transport=httpx.MockTransport(handler)
    )
    engine = VerificationEngine((HadeethEncVerifier("en", HadeethEncClient(raw_client)),))
    try:
        with TestClient(create_app(engine, cors_origins=[], stats_enabled=True)) as client:
            response = client.post(
                "/v1/verify",
                json={"source_type": "hadith", "language": "en", "quote": "kindness matters"},
            )
            stats = client.get("/v1/stats").json()
    finally:
        raw_client.close()

    assert response.status_code == 503
    assert stats["totals"]["verifications"] == 0
    assert stats["totals"]["source_unavailable_errors"] == 1
    assert stats["daily"][-1]["source_unavailable_errors"] == 1


def test_stats_persist_across_restarts(tmp_path: Path, quran_engine: VerificationEngine) -> None:
    stats_file = tmp_path / "nested" / "stats.json"
    source_text = QuranCorpus.load_default().verses_by_reference["1:1"].text

    first = create_app(quran_engine, cors_origins=[], stats_enabled=True, stats_path=stats_file)
    with TestClient(first) as client:
        _verify(client, quote=source_text, reference="1:1")
        _verify(client, quote=_CANARY_QUOTE)
        assert client.get("/v1/stats").json()["persistent"] is True

    # Flushed on shutdown, atomically: no temporary file is left behind.
    assert stats_file.is_file()
    assert [path.name for path in stats_file.parent.iterdir()] == ["stats.json"]
    persisted = stats_file.read_text(encoding="utf-8")
    assert "PRIVATE_QUOTE_CANARY" not in persisted
    assert source_text not in persisted

    second = create_app(quran_engine, cors_origins=[], stats_enabled=True, stats_path=stats_file)
    with TestClient(second) as client:
        _verify(client, quote=source_text, reference="1:1")
        stats = client.get("/v1/stats").json()

    assert stats["persistent"] is True
    assert stats["totals"]["verifications"] == 3
    assert stats["totals"]["by_status"]["exact_match"] == 2
    assert stats["totals"]["by_status"]["not_found_in_checked_corpus"] == 1
    assert stats["latency"]["count"] == 3
    assert stats["daily"][-1]["total"] == 3
    assert stats["collecting_since"] <= stats["started_at"]


def test_collector_keeps_a_bounded_daily_window_and_labels() -> None:
    now = [datetime(2026, 1, 1, 12, tzinfo=UTC).timestamp()]
    collector = StatsCollector(clock=lambda: now[0])
    collector.record_result(MatchStatus.EXACT_MATCH, "quran", "ar", latency_ms=3)
    now[0] += 40 * 86_400
    collector.record_result("partial_match", "hadith", "en", latency_ms=5_000)
    collector.record_result(MatchStatus.PARTIAL_MATCH, "anything", "zz", latency_ms=7)

    snapshot = collector.snapshot()
    assert snapshot["totals"]["verifications"] == 3
    assert snapshot["daily"][-1] == {
        "date": "2026-02-10",
        "total": 2,
        "by_status": {**dict.fromkeys(snapshot["totals"]["by_status"], 0), "partial_match": 2},
        "source_unavailable_errors": 0,
    }
    assert sum(day["total"] for day in snapshot["daily"]) == 2
    assert snapshot["uptime_seconds"] == pytest.approx(40 * 86_400)
    buckets = {bucket["le_ms"]: bucket["count"] for bucket in snapshot["latency"]["buckets"]}
    assert (buckets[5], buckets[10], buckets[None]) == (1, 1, 1)
    assert ("partial_match", "other", "other") in {
        (row["status"], row["source_type"], row["language"]) for row in snapshot["breakdown"]
    }
    with pytest.raises(ValueError):
        collector.record_result("authentic", "quran", "ar")


def test_unreadable_stats_file_is_ignored(tmp_path: Path) -> None:
    stats_file = tmp_path / "stats.json"
    stats_file.write_text("{not json", encoding="utf-8")
    collector = StatsCollector(path=stats_file)

    assert collector.load() is False
    assert collector.snapshot()["totals"]["verifications"] == 0
    collector.record_result(MatchStatus.EXACT_MATCH, "quran", "ar", latency_ms=1)
    collector.flush()

    reloaded = StatsCollector(path=stats_file)
    assert reloaded.load() is True
    assert reloaded.snapshot()["totals"]["verifications"] == 1
