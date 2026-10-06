from fastapi.testclient import TestClient

from isnad_core.api.app import create_app
from isnad_core.api.model_proxy import ModelProxyConfig, RateLimiter, client_identity


def test_rate_limiter_blocks_after_limit_and_recovers_after_window():
    limiter = RateLimiter(2, window_seconds=10)
    assert limiter.allow("a", now=0)
    assert limiter.allow("a", now=1)
    assert not limiter.allow("a", now=2)
    assert limiter.allow("b", now=2)
    assert limiter.allow("a", now=11)


def test_rate_limit_zero_disables_it():
    limiter = RateLimiter(0)
    assert all(limiter.allow("a", now=i) for i in range(100))


def test_client_identity_uses_platform_appended_address():
    assert client_identity({"x-forwarded-for": "6.6.6.6, 1.2.3.4"}, "x") == "1.2.3.4"
    assert client_identity({}, "fallback") == "fallback"


def test_proxy_returns_429_when_limited(monkeypatch):
    monkeypatch.setenv("ISNAD_MODEL_RATE_LIMIT", "1")
    app = create_app(model_proxy=ModelProxyConfig("k", "http://127.0.0.1:9", "m"))
    with TestClient(app) as client:
        client.post("/v1/model/chat/completions", content=b"not json")
        limited = client.post("/v1/model/chat/completions", json={"messages": []})
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "model_rate_limited"
