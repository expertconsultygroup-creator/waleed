"""FastAPI application exposing the source-grounded verification core."""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import Iterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import HTTPConnection

from isnad_core import __version__
from isnad_core.api.middleware import RequestBodyLimitMiddleware
from isnad_core.api.model_proxy import (
    MAX_PROXY_BODY_BYTES,
    ModelProxyConfig,
    RateLimiter,
    client_identity,
    load_dotenv,
    prepare_upstream_body,
    stream_upstream,
)
from isnad_core.api.schemas import (
    CapabilitiesResponse,
    ErrorDetailResponse,
    ErrorResponse,
    HealthResponse,
    ReadyResponse,
    StatsResponse,
    SystemPromptResponse,
    VerifyRequest,
    VerifyResponse,
)
from isnad_core.api.serializers import (
    capabilities_response,
    readiness_response,
    verification_response,
)
from isnad_core.api.stats import FLUSH_INTERVAL_SECONDS, StatsCollector
from isnad_core.engine import VerificationEngine
from isnad_core.errors import SourceUnavailable
from isnad_core.hadith import InvalidHadithReference
from isnad_core.i18n import negotiate_locale, render
from isnad_core.models import VerificationInput
from isnad_core.prompt import system_prompt_response
from isnad_core.quran import InvalidQuranReference
from isnad_core.streaming import (
    MAX_STREAM_CHARACTERS,
    MAX_STREAM_CHUNK_CHARACTERS,
    MAX_WEBSOCKET_MESSAGE_BYTES,
    StreamEvent,
    StreamEventType,
    StreamingCitationGate,
)

SERVICE_NAME = "isnad-core"
MAX_HTTP_BODY_BYTES = 64 * 1024
_API_DIRECTORY = Path(__file__).resolve().parent
_GUI_TEMPLATE_PATH = _API_DIRECTORY / "templates" / "gui.html"
_GUI_STANDALONE_PATH = _API_DIRECTORY / "static" / "isnad-gui.html"
# The Next.js interface (web/), exported as static files by
# web/scripts/export-to-package.mjs. When it is absent the classic interface
# is served at the root instead.
_WEB_DIRECTORY = _API_DIRECTORY / "web"
_WEB_PAGES = {"": "index.html", "dashboard": "dashboard/index.html"}
# The interface is a single file with no external assets, so the served policy
# can stay this narrow: no frames other than the deployment's own, no external
# script or style origins, and no fetched assets. Connections stay open because
# the page also streams from whichever model endpoint the user configures; it
# loads nothing on its own initiative.
_GUI_CSP = (
    "default-src 'none'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self' data:; "
    "connect-src *; "
    "form-action 'none'; "
    "base-uri 'none'"
)
_STREAM_STOP = object()
_DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


_TRUTHY = frozenset({"1", "true", "yes", "on"})


def _stats_enabled_from_environment() -> bool:
    return os.environ.get("ISNAD_STATS_ENABLED", "").strip().casefold() in _TRUTHY


def _connection_locale(connection: HTTPConnection) -> str:
    """Negotiate a locale from ``?lang=``, then Accept-Language, then the default."""

    return negotiate_locale(
        connection.query_params.get("lang"),
        connection.headers.get("accept-language"),
    )


def _request_locale(request: Request) -> str:
    """Return the locale negotiated by the middleware, negotiating again if absent."""

    return getattr(request.state, "locale", None) or _connection_locale(request)


def _cors_origins_from_environment() -> list[str]:
    configured = os.environ.get("ISNAD_CORS_ORIGINS")
    raw_origins = _DEFAULT_CORS_ORIGINS if configured is None else configured.split(",")
    origins = [origin.strip() for origin in raw_origins if origin.strip()]
    if "*" in origins and len(origins) != 1:
        raise ValueError("ISNAD_CORS_ORIGINS cannot combine '*' with explicit origins.")
    return origins


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: list[ErrorDetailResponse] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        request_id=getattr(request.state, "request_id", ""),
        error={"code": code, "message": message, "details": details or []},
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


def _stream_event_payload(event: StreamEvent, locale: str = "en") -> dict[str, object]:
    payload: dict[str, object] = {"type": event.type.value}
    if event.text is not None:
        payload["text"] = event.text
    if event.citation_id is not None:
        payload["citation_id"] = event.citation_id
    if event.placeholder is not None:
        payload["placeholder"] = event.placeholder
    if event.result is not None:
        payload["result"] = verification_response(event.result, locale).model_dump(mode="json")
    if event.code is not None:
        payload["code"] = event.code
    return payload


def _gui_content_security_policy() -> str:
    """Return the interface policy, allowing extra frame ancestors only if configured."""

    frame_ancestors = os.environ.get("ISNAD_GUI_FRAME_ANCESTORS", "").strip()
    if not frame_ancestors:
        return _GUI_CSP
    return f"{_GUI_CSP}; frame-ancestors {frame_ancestors}"


def _next_stream_event(events: Iterator[StreamEvent]) -> StreamEvent | object:
    try:
        return next(events)
    except StopIteration:
        return _STREAM_STOP


async def _flush_stats_periodically(stats: StatsCollector, interval: float) -> None:
    while True:
        await asyncio.sleep(interval)
        await run_in_threadpool(stats.flush)


def create_app(
    engine: VerificationEngine | None = None,
    *,
    cors_origins: list[str] | None = None,
    model_proxy: ModelProxyConfig | None = None,
    stats_enabled: bool | None = None,
    stats_path: str | Path | None = None,
) -> FastAPI:
    """Create an API app; inject an engine in tests or use the pinned local corpora.

    Server statistics are off unless ``stats_enabled`` (or ``ISNAD_STATS_ENABLED=1``)
    turns them on; ``stats_path`` (or ``ISNAD_STATS_PATH``) persists them as JSON.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        stats: StatsCollector | None = app.state.stats
        flush_task: asyncio.Task[None] | None = None
        if stats is not None and stats.persistent:
            flush_task = asyncio.create_task(
                _flush_stats_periodically(stats, FLUSH_INTERVAL_SECONDS)
            )
        try:
            async with httpx.AsyncClient() as client:
                app.state.model_client = client
                yield
        finally:
            if flush_task is not None:
                flush_task.cancel()
                with suppress(asyncio.CancelledError):
                    await flush_task
            if stats is not None:
                await run_in_threadpool(stats.flush)

    app = FastAPI(
        title="Isnad Core API",
        summary="Source-grounded Arabic and English Qur'an and hadith citation verification.",
        version=__version__,
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.model_proxy = (
        model_proxy if model_proxy is not None else ModelProxyConfig.from_environment()
    )
    app.state.model_rate_limiter = RateLimiter.from_environment()
    app.state.engine = engine if engine is not None else VerificationEngine()
    if stats_enabled is None:
        stats_enabled = _stats_enabled_from_environment()
    stats: StatsCollector | None = None
    if stats_enabled:
        if stats_path is None:
            stats_path = os.environ.get("ISNAD_STATS_PATH", "").strip() or None
        capabilities_in_force = app.state.engine.capabilities
        stats = StatsCollector(
            path=stats_path,
            source_types={capability.source_type for capability in capabilities_in_force},
            languages={capability.language for capability in capabilities_in_force},
        )
        stats.load()
    app.state.stats = stats
    origins = cors_origins if cors_origins is not None else _cors_origins_from_environment()
    if "*" in origins and len(origins) != 1:
        raise ValueError("CORS cannot combine '*' with explicit origins.")
    app.state.allowed_websocket_origins = frozenset(origins)
    app.state.allow_any_websocket_origin = origins == ["*"]
    app.add_middleware(
        RequestBodyLimitMiddleware,
        max_body_bytes=MAX_HTTP_BODY_BYTES,
        path_limits={"/v1/model/chat/completions": MAX_PROXY_BODY_BYTES},
    )

    @app.middleware("http")
    async def response_security_headers(request: Request, call_next):
        request_id = uuid4().hex
        request.state.request_id = request_id
        locale = _connection_locale(request)
        request.state.locale = locale
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Build assets are content-hashed, so they never change under a name.
        if request.url.path.startswith("/_next/static/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-store"
        if request.url.path.startswith("/v1/") and response.headers.get(
            "content-type", ""
        ).startswith("application/json"):
            response.headers["Content-Language"] = locale
            response.headers.add_vary_header("Accept-Language")
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        max_age=600,
    )

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            ErrorDetailResponse(
                location=[part for part in error.get("loc", ()) if part != "body"],
                code=str(error.get("type", "invalid")),
            )
            for error in exc.errors()
        ]
        return _error_response(
            request,
            status_code=422,
            code="invalid_request",
            message=render("error.invalid_request", _request_locale(request)),
            details=details,
        )

    @app.exception_handler(InvalidQuranReference)
    async def invalid_reference_error_handler(
        request: Request, _exc: InvalidQuranReference
    ) -> JSONResponse:
        return _error_response(
            request,
            status_code=422,
            code="invalid_reference",
            message=render("error.invalid_quran_reference", _request_locale(request)),
        )

    @app.exception_handler(InvalidHadithReference)
    async def invalid_hadith_reference_error_handler(
        request: Request, _exc: InvalidHadithReference
    ) -> JSONResponse:
        return _error_response(
            request,
            status_code=422,
            code="invalid_reference",
            message=render("error.invalid_hadith_reference", _request_locale(request)),
        )

    @app.exception_handler(SourceUnavailable)
    async def source_unavailable_error_handler(
        request: Request, _exc: SourceUnavailable
    ) -> JSONResponse:
        response = _error_response(
            request,
            status_code=503,
            code="source_unavailable",
            message=render("error.source_unavailable", _request_locale(request)),
        )
        response.headers["Retry-After"] = "10"
        return response

    @app.exception_handler(ValueError)
    async def invalid_verification_error_handler(
        request: Request, _exc: ValueError
    ) -> JSONResponse:
        return _error_response(
            request,
            status_code=422,
            code="invalid_citation",
            message=render("error.invalid_citation", _request_locale(request)),
        )

    @app.get("/health/live", response_model=HealthResponse, tags=["health"])
    def health_live() -> HealthResponse:
        return HealthResponse(status="live", service=SERVICE_NAME, version=__version__)

    @app.get("/health/ready", response_model=ReadyResponse, tags=["health"])
    def health_ready() -> ReadyResponse:
        return readiness_response(app.state.engine, version=__version__)

    @app.get("/v1/capabilities", response_model=CapabilitiesResponse, tags=["metadata"])
    def capabilities(request: Request) -> CapabilitiesResponse:
        return capabilities_response(
            app.state.engine,
            _request_locale(request),
            stats_enabled=app.state.stats is not None,
        )

    @app.get("/v1/system-prompt", response_model=SystemPromptResponse, tags=["metadata"])
    def system_prompt(request: Request) -> SystemPromptResponse:
        """Serve the citation protocol prompt a client injects into a model session."""

        return SystemPromptResponse(**system_prompt_response(_request_locale(request)))

    @app.post("/v1/verify", response_model=VerifyResponse, tags=["verification"])
    def verify_citation(payload: VerifyRequest, request: Request) -> VerifyResponse:
        stats: StatsCollector | None = app.state.stats
        started = time.perf_counter()
        try:
            result = app.state.engine.verify(
                VerificationInput(
                    source=payload.source_type,
                    language=payload.language,
                    quote=payload.quote,
                    reference=payload.reference,
                )
            )
        except SourceUnavailable:
            if stats is not None:
                stats.record_source_unavailable()
            raise
        if stats is not None:
            stats.record_result(
                result.status,
                result.source_type,
                result.language,
                (time.perf_counter() - started) * 1000,
            )
        return verification_response(result, _request_locale(request))

    @app.get(
        "/v1/stats",
        response_model=StatsResponse,
        responses={404: {"model": ErrorResponse}},
        tags=["metadata"],
    )
    def server_stats(request: Request):
        """Aggregate verification counters; enabled only with ``ISNAD_STATS_ENABLED=1``."""

        stats: StatsCollector | None = app.state.stats
        if stats is None:
            return _error_response(
                request,
                status_code=404,
                code="not_found",
                message=render("error.not_found", _request_locale(request)),
            )
        return StatsResponse(**stats.snapshot())

    @app.get("/v1/model/config", tags=["model"])
    def model_config() -> dict[str, object]:
        """Report whether this server proxies a model, and which one. Never the key."""

        config: ModelProxyConfig = app.state.model_proxy
        return {"available": config.available, "model": config.model}

    # The interface's default model endpoint: the provider key stays on the
    # server, so the page can chat without the user entering one.
    @app.post("/v1/model/chat/completions", tags=["model"])
    async def model_chat_completions(request: Request):
        config: ModelProxyConfig = app.state.model_proxy
        if not config.available:
            return _error_response(
                request,
                status_code=503,
                code="model_not_configured",
                message=render("error.model_not_configured", _request_locale(request)),
            )
        fallback = request.client.host if request.client else "unknown"
        if not app.state.model_rate_limiter.allow(client_identity(request.headers, fallback)):
            response = _error_response(
                request,
                status_code=429,
                code="model_rate_limited",
                message=render("error.model_rate_limited", _request_locale(request)),
            )
            response.headers["Retry-After"] = "600"
            return response
        try:
            body = prepare_upstream_body(await request.body(), config)
        except ValueError:
            return _error_response(
                request,
                status_code=422,
                code="invalid_request",
                message=render("error.model_invalid_request", _request_locale(request)),
            )
        try:
            status_code, content_type, chunks = await stream_upstream(
                app.state.model_client, config, body
            )
        except httpx.HTTPError:
            return _error_response(
                request,
                status_code=502,
                code="model_unreachable",
                message=render("error.model_unreachable", _request_locale(request)),
            )
        return StreamingResponse(chunks, status_code=status_code, media_type=content_type)

    # The interface is part of this deployment, not a separate front end: it is
    # served from the same origin with a restrictive policy, and it talks to the
    # API routes above. `/gui` is an alias so the page is reachable when another
    # service owns the root path.
    def classic_interface() -> FileResponse:
        return FileResponse(
            _GUI_TEMPLATE_PATH,
            media_type="text/html; charset=utf-8",
            headers={"Content-Security-Policy": _gui_content_security_policy()},
        )

    def web_file(path: str) -> Path | None:
        """Resolve a path inside the exported interface, never outside it."""

        root = _WEB_DIRECTORY.resolve()
        candidate = (root / path.strip("/")).resolve()
        if root != candidate and root not in candidate.parents:
            return None
        if candidate.is_dir():
            candidate = candidate / "index.html"
        return candidate if candidate.is_file() else None

    def web_response(path: Path) -> FileResponse:
        headers = {}
        if path.suffix == ".html":
            headers["Content-Security-Policy"] = _gui_content_security_policy()
        return FileResponse(path, headers=headers)

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    @app.api_route("/gui", methods=["GET", "HEAD"], include_in_schema=False)
    def verification_interface() -> FileResponse:
        index = web_file("index.html")
        return web_response(index) if index else classic_interface()

    # The single-file interface, kept for offline and embedded use.
    @app.get("/classic", include_in_schema=False)
    def classic_route() -> FileResponse:
        return classic_interface()

    # The same interface as one self-contained download: open it from disk and
    # point it at any deployment through Connection settings.
    @app.get("/gui/standalone.html", include_in_schema=False)
    def standalone_interface() -> FileResponse:
        return FileResponse(
            _GUI_STANDALONE_PATH,
            media_type="text/html; charset=utf-8",
            filename="isnad-gui.html",
            headers={"Content-Security-Policy": _gui_content_security_policy()},
        )

    @app.websocket("/v1/stream")
    async def stream_gate(websocket: WebSocket) -> None:
        origin = websocket.headers.get("origin")
        if (
            origin is not None
            and not app.state.allow_any_websocket_origin
            and origin not in app.state.allowed_websocket_origins
        ):
            await websocket.close(code=1008)
            return

        await websocket.accept()
        gate = StreamingCitationGate(app.state.engine)
        locale = _connection_locale(websocket)
        stats: StatsCollector | None = app.state.stats
        total_characters = 0

        async def send_gate_events(events: Iterator[StreamEvent]) -> None:
            while True:
                started = time.perf_counter()
                event = await run_in_threadpool(_next_stream_event, events)
                if event is _STREAM_STOP:
                    return
                if stats is not None and isinstance(event, StreamEvent):
                    # The gate verifies inside the step that yields the result, so the
                    # step's duration is the verification latency.
                    if event.result is not None:
                        stats.record_result(
                            event.result.status,
                            event.result.source_type,
                            event.result.language,
                            (time.perf_counter() - started) * 1000,
                        )
                    elif (
                        event.type is StreamEventType.CITATION_ERROR
                        and event.code == "source_unavailable"
                    ):
                        stats.record_source_unavailable()
                await websocket.send_json(_stream_event_payload(event, locale))

        async def close_with_error(code: str, close_code: int = 1003) -> None:
            await websocket.send_json({"type": "stream_error", "error": {"code": code}})
            await websocket.close(code=close_code)

        while True:
            try:
                raw_message = await websocket.receive_text()
            except WebSocketDisconnect:
                return

            if len(raw_message.encode("utf-8")) > MAX_WEBSOCKET_MESSAGE_BYTES:
                await close_with_error("stream_message_too_large", close_code=1009)
                return
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                await close_with_error("invalid_stream_message")
                return
            if not isinstance(message, dict) or not isinstance(message.get("type"), str):
                await close_with_error("invalid_stream_message")
                return

            if message["type"] == "chunk":
                if set(message) != {"type", "text"} or not isinstance(message["text"], str):
                    await close_with_error("invalid_stream_message")
                    return
                text = message["text"]
                if len(text) > MAX_STREAM_CHUNK_CHARACTERS:
                    await close_with_error("stream_chunk_too_large", close_code=1009)
                    return
                total_characters += len(text)
                if total_characters > MAX_STREAM_CHARACTERS:
                    await close_with_error("stream_too_large", close_code=1009)
                    return
                await send_gate_events(gate.feed(text))
                continue

            if message["type"] == "finish" and set(message) == {"type"}:
                await send_gate_events(gate.finish())
                await websocket.send_json({"type": "stream_complete"})
                await websocket.close(code=1000)
                return

            await close_with_error("invalid_stream_message")
            return

    # Everything else the exported interface needs: its pages (/dashboard/),
    # the payloads Next.js fetches when moving between them (*.txt), and its
    # hashed assets under /_next/. API paths keep the JSON error envelope.
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def web_asset(path: str, request: Request):
        found = None if path.startswith(("v1/", "health/")) else web_file(path)
        if found is None:
            return _error_response(
                request,
                status_code=404,
                code="not_found",
                message=render("error.not_found", _request_locale(request)),
            )
        return web_response(found)

    return app


load_dotenv()
app = create_app()
