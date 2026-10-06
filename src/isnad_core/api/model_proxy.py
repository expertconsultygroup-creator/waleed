"""Server-side model proxy, so the interface can chat without holding a provider key.

The interface streams from any OpenAI-compatible ``/chat/completions`` endpoint.
When this deployment is given a provider key, it exposes one under
``/v1/model``: the browser posts the chat request here, and the key is added on
the server and never sent to the page.

Configuration (environment, or a ``.env`` file in the working directory):

| Variable | Default |
| --- | --- |
| ``ISNAD_MODEL_API_KEY`` (or ``NOVITA_API_KEY``) | unset: the proxy answers 503 |
| ``ISNAD_MODEL_BASE_URL`` | ``https://api.novita.ai/openai/v1`` |
| ``ISNAD_MODEL_NAME`` | ``zai-org/glm-5.3`` |
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

import httpx

DEFAULT_MODEL_BASE_URL = "https://api.novita.ai/openai/v1"
DEFAULT_MODEL_NAME = "zai-org/glm-5.3"
MAX_PROXY_BODY_BYTES = 1024 * 1024
_UPSTREAM_TIMEOUT = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=15.0)


def load_dotenv(path: Path | None = None) -> None:
    """Read ``KEY=value`` lines into the environment without overriding set variables."""

    env_path = path if path is not None else Path.cwd() / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class ModelProxyConfig:
    api_key: str
    base_url: str
    model: str

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    @classmethod
    def from_environment(cls) -> ModelProxyConfig:
        secret = os.environ.get("ISNAD_MODEL_API_KEY") or os.environ.get("NOVITA_API_KEY") or ""
        base_url = os.environ.get("ISNAD_MODEL_BASE_URL") or DEFAULT_MODEL_BASE_URL
        model = os.environ.get("ISNAD_MODEL_NAME") or DEFAULT_MODEL_NAME
        return cls(secret.strip(), base_url.rstrip("/"), model.strip())


def prepare_upstream_body(raw: bytes, config: ModelProxyConfig) -> bytes:
    """Validate the browser's chat request and fill in the configured model."""

    payload = json.loads(raw)
    if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
        raise ValueError("A chat request needs a messages list.")
    if not isinstance(payload.get("model"), str) or not payload["model"].strip():
        payload["model"] = config.model
    return json.dumps(payload).encode("utf-8")


async def stream_upstream(
    client: httpx.AsyncClient, config: ModelProxyConfig, body: bytes
) -> tuple[int, str, AsyncIterator[bytes]]:
    """Open the upstream request and return its status, content type and byte stream."""

    request = client.build_request(
        "POST",
        f"{config.base_url}/chat/completions",
        content=body,
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        },
        timeout=_UPSTREAM_TIMEOUT,
    )
    response = await client.send(request, stream=True)

    async def chunks() -> AsyncIterator[bytes]:
        try:
            async for chunk in response.aiter_raw():
                yield chunk
        finally:
            await response.aclose()

    content_type = response.headers.get("content-type", "text/event-stream")
    return response.status_code, content_type, chunks()
