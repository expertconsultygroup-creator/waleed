"""Fixtures shared by the browser tests of both interfaces.

The real API on a loopback port, the scripted OpenAI-compatible model from
examples/, and one Chromium per module. Without playwright or Chromium the
tests that use them skip.
"""

from __future__ import annotations

import importlib.util
import socket
import threading
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
import uvicorn

from isnad_core.api.app import create_app

_PROVIDER_PATH = Path(__file__).resolve().parents[1] / "examples" / "fake_openai_provider.py"


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@pytest.fixture(scope="module")
def server_url() -> Iterator[str]:
    """Serve the real app on a loopback port for the duration of the module."""

    port = _free_port()
    config = uvicorn.Config(create_app(), host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 20
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)
    if not server.started:
        pytest.skip("the API server did not start in time")
    yield f"http://127.0.0.1:{port}/"
    server.should_exit = True
    thread.join(timeout=10)


@pytest.fixture(scope="module")
def scripted_model_url() -> Iterator[str]:
    """Serve the scripted model double used by the chat test."""

    spec = importlib.util.spec_from_file_location("isnad_fake_provider_browser", _PROVIDER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    port = _free_port()
    server = module.ThreadingHTTPServer(("127.0.0.1", port), module.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}/v1"
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)


@pytest.fixture(scope="module")
def browser():  # noqa: ANN201 - playwright types are optional dependencies
    sync_api = pytest.importorskip("playwright.sync_api", reason="playwright is not installed")
    Error, sync_playwright = sync_api.Error, sync_api.sync_playwright

    with sync_playwright() as playwright:
        try:
            instance = playwright.chromium.launch()
        except Error as exc:  # pragma: no cover - depends on the host image
            pytest.skip(f"chromium is not available for playwright: {exc}")
        yield instance
        instance.close()
