"""Versioned Pydantic contracts for the REST API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from isnad_core.models import MatchStatus


class VerifyRequest(BaseModel):
    """One citation candidate to compare against a supported source."""

    model_config = ConfigDict(extra="forbid")

    source_type: str = Field(min_length=1, max_length=32, examples=["quran"])
    language: str = Field(min_length=2, max_length=8, examples=["ar"])
    quote: str | None = Field(default=None, max_length=4_000)
    reference: str | None = Field(default=None, max_length=64, examples=["2:255"])

    @field_validator("source_type", "language")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if not normalized:
            raise ValueError("This field must not be blank.")
        return normalized

    @model_validator(mode="after")
    def require_quote_or_reference(self) -> VerifyRequest:
        has_quote = self.quote is not None and bool(self.quote.strip())
        has_reference = self.reference is not None and bool(self.reference.strip())
        if not has_quote and not has_reference:
            raise ValueError("Provide a quote, a reference, or both.")
        return self


class SourceMetadataResponse(BaseModel):
    """Provenance for the exact source dataset used to generate evidence."""

    source_id: str
    name: str
    display_name: str
    url: str
    version: str
    license: str
    content_sha256: str | None
    coverage_note: str | None


class EvidenceResponse(BaseModel):
    """Verbatim source text and locator supporting a result."""

    reference: str
    source_text: str
    matched_fragment: str | None
    source_id: str
    source_version: str
    source_url: str
    footnotes: str | None
    record_title: str | None
    attribution_text: str | None
    grade_text: str | None
    grade_source: str | None
    graded_by: str | None
    bibliographic_reference: str | None


class WordingDifferenceResponse(BaseModel):
    """A source-backed word-level difference; values are never generated corrections."""

    kind: str
    submitted_text: str
    source_text: str


class VerifyResponse(BaseModel):
    """Stable response envelope for textual citation verification."""

    status: MatchStatus
    source_type: str
    language: str
    source_metadata: SourceMetadataResponse | None
    submitted_quote: str | None
    cited_reference: str | None
    matched_references: list[str]
    evidence: list[EvidenceResponse]
    wording_differences: list[WordingDifferenceResponse]
    explanation: str
    explanation_key: str | None = Field(
        default=None,
        description="Stable catalog key for `explanation`; identical in every locale.",
    )
    candidate_count: int | None
    evidence_truncated: bool


class ErrorDetailResponse(BaseModel):
    """Sanitized validation location and machine-readable error category."""

    location: list[str | int]
    code: str


class ErrorBodyResponse(BaseModel):
    """Safe API error; never echoes the submitted quote or credentials."""

    code: str
    message: str
    details: list[ErrorDetailResponse] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Common structured error envelope."""

    request_id: str
    error: ErrorBodyResponse


class HealthResponse(BaseModel):
    """Health state for deployment probes."""

    status: str
    service: str
    version: str


class ReadySourceResponse(BaseModel):
    """A pinned source edition loaded and available in the process."""

    source_type: str
    language: str
    source_id: str
    source_version: str
    source_sha256: str | None
    mode: str


class ReadyResponse(HealthResponse):
    """Readiness details identifying all active pinned source editions."""

    sources: list[ReadySourceResponse]


class SourceCapabilityResponse(BaseModel):
    """A source/language pair currently supported by a verifier adapter."""

    source_type: str
    language: str
    source_id: str
    name: str
    display_name: str
    source_version: str
    normalization_profile: str
    mode: str
    reference_format: str
    coverage_note: str | None


class LimitsResponse(BaseModel):
    """Public input and evidence bounds for GUI validation."""

    max_quote_characters: int
    max_reference_ayahs: int
    max_evidence_candidates: int
    max_stream_characters: int
    max_stream_chunk_characters: int
    max_websocket_message_bytes: int


class StreamingContractResponse(BaseModel):
    """Discoverable WebSocket message and event contract for citation streaming."""

    transport: str
    path: str
    input_message: str
    block_open_marker: str
    block_close_marker: str
    placeholder_code: str
    events: list[str]
    policy: str


class SystemPromptResponse(BaseModel):
    """Canonical citation protocol prompt for a model-facing client."""

    version: str
    prompt: str
    block_open_marker: str
    block_close_marker: str


class StatusDetailResponse(BaseModel):
    """Localized label and meaning of one match status; the `status` value never changes."""

    status: MatchStatus
    label: str
    meaning: str


class CapabilitiesResponse(BaseModel):
    """Discoverable contract details for clients such as the user's GUI."""

    api_version: str
    service: str
    status_semantics: str
    statuses: list[MatchStatus]
    status_details: list[StatusDetailResponse]
    locales: list[str]
    locale: str
    sources: list[SourceCapabilityResponse]
    limits: LimitsResponse
    streaming: StreamingContractResponse
    system_prompt_path: str
    stats_enabled: bool


class LatencyBucketResponse(BaseModel):
    """Verifications whose latency fell in this bucket (non-cumulative).

    `le_ms` is the inclusive upper bound in milliseconds; `null` is the open-ended
    last bucket.
    """

    le_ms: int | None
    count: int


class LatencyResponse(BaseModel):
    """Verification latency histogram with the sum and count for a mean."""

    buckets: list[LatencyBucketResponse]
    count: int
    sum_ms: float
    mean_ms: float | None


class StatsBreakdownResponse(BaseModel):
    """Verification count for one status, source type and language combination."""

    status: MatchStatus
    source_type: str
    language: str
    count: int


class StatsDayResponse(BaseModel):
    """One UTC calendar day of verification counts."""

    date: str
    total: int
    by_status: dict[str, int]
    source_unavailable_errors: int


class StatsTotalsResponse(BaseModel):
    """Totals since the counters were created (or loaded from the persistence file)."""

    verifications: int
    source_unavailable_errors: int
    by_status: dict[str, int]


class StatsResponse(BaseModel):
    """Aggregate server counters. No quote text, reference, or client detail is stored."""

    persistent: bool
    started_at: str
    collecting_since: str
    uptime_seconds: float
    window_days: int
    totals: StatsTotalsResponse
    breakdown: list[StatsBreakdownResponse]
    latency: LatencyResponse
    daily: list[StatsDayResponse]
