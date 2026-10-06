# REST and streaming API contract (v1)

This file describes the contract implemented by `isnad_core.api`. `GET /v1/capabilities` is the runtime source of truth for active languages, editions, statuses, input bounds, and the streaming markers. All verification surfaces call the same `VerificationEngine` and use the same response serializer.

## Language

Every human-readable string the API returns can be served in English (`en`, the default) or Arabic (`ar`): `explanation`, error `message`, source `display_name` and `coverage_note`, status labels and meanings, the streaming policy text, and an optional answer-language line in the system prompt. Machine-readable values are identical in every language: `status`, error `code`, references, source identifiers, evidence, and `explanation_key`. A client decides on those, never on prose.

The locale of a request is chosen in this order:

1. the `lang` query parameter (`?lang=ar` or `?lang=en`; an unsupported value is ignored, not rejected);
2. the `Accept-Language` header, by `q` weight (any `ar-*` tag means `ar`, any `en-*` tag means `en`; `q=0` and `*` never select a locale);
3. the `ISNAD_DEFAULT_LOCALE` environment variable (`en` or `ar`);
4. `en`.

JSON responses under `/v1/` carry `Content-Language: <locale>` and `Vary: Accept-Language`. With no `lang` and no `Accept-Language`, an English deployment returns exactly the English text it returned before localization existed.

## REST

### Discover capabilities

```http
GET /v1/capabilities
```

The response contains:

- the nine per-citation match statuses and the rule that they measure textual correspondence only;
- `status_details`: one entry per status, in the same order as `statuses`, with a localized `label` and `meaning`;
- `locales` (`["ar", "en"]`) and `locale`, the locale this response was rendered in;
- supported source/language pairs and source metadata, including a localized `display_name` and the HadeethEnc curated-coverage note;
- each adapter's reference format, normalization profile, and local/remote mode;
- quote/reference/evidence/stream limits; and
- the WebSocket path, markers, event names, placeholder code, and fail-closed policy; and
- `stats_enabled`, whether `GET /v1/stats` is enabled on this deployment.

Additions, shown with `?lang=ar` (all other fields are unchanged):

```json
{
  "statuses": ["exact_match", "normalized_match", "..."],
  "status_details": [
    {"status": "exact_match", "label": "مطابقة تامة",
     "meaning": "النص المُدخل يطابق نص المصدر في الموضع المذكور حرفًا بحرف."}
  ],
  "locales": ["ar", "en"],
  "locale": "ar",
  "sources": [
    {"source_id": "tanzil-quran-uthmani", "name": "Tanzil Project",
     "display_name": "مشروع تنزيل — الرسم العثماني", "...": "..."}
  ],
  "stats_enabled": false
}
```

`GET /health/live` is a process liveness probe. `GET /health/ready` reports registered adapters and pinned source metadata; HadeethEnc is a remote dependency, so readiness does not guarantee that its upstream API is currently reachable.

### Verify one citation

```http
POST /v1/verify
Content-Type: application/json

{
  "source_type": "quran",
  "language": "ar",
  "quote": "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
  "reference": "1:1"
}
```

`source_type` is `quran` or `hadith`; `language` is `ar` or `en`. Supply a non-empty `quote`, a `reference`, or both. `quote` is limited to 4,000 characters; the HTTP body is limited to 64 KiB. Qur'an references use `surah:ayah` or a bounded ayah range, such as `2:255-257`. HadeethEnc references are source-local IDs in the form `hadeethenc:<id>`; do not substitute or guess conventional hadith numbering.

A successful response has the stable `VerifyResponse` schema from `src/isnad_core/api/schemas.py`: a match `status`, source metadata, submitted quote and cited locator, matched references, source-backed evidence, exact wording differences, explanation, candidate count, and truncation flag. `explanation` is rendered in the request's locale; `explanation_key` (for example `quran.cited_match` or `hadith.not_found_in_checked_corpus`) identifies the same explanation in every locale and is `null` only for a custom adapter that supplies its own text. `source_metadata.name` is the upstream name, unchanged; `source_metadata.display_name` is the localized reader-facing name (for example «مشروع تنزيل — الرسم العثماني»). Evidence fields keep source text, attribution, grade text/source, named grader, and bibliographic reference separate. Missing grades or graders remain `null`.

`status` is **not** a hadith grade, authenticity determination, or religious ruling. A HadeethEnc not-found result is bounded to the curated source checked. A remote HadeethEnc outage returns HTTP `503` with `error.code = "source_unavailable"` and `Retry-After: 10`; it is not converted to `not_found_in_checked_corpus`. Malformed/out-of-corpus locators return `422` with a safe structured error. Validation errors do not echo the submitted quote. Error `message` text follows the request's locale; error `code` values never change with it.

Responses set `Cache-Control: no-store`, `X-Request-ID`, and `X-Content-Type-Options: nosniff`.

### Citation protocol prompt

```http
GET /v1/system-prompt
```

Returns the versioned prompt (`isnad-citation-protocol-v2`) that defines the marker syntax a model must use for quotations, the reference formats, the status vocabulary, and what the statuses do not mean. A client injects `prompt` as the conversation's system message and checks the answer with the same markers, so the model and the verifier cannot drift apart about the protocol. The response also carries `block_open_marker` and `block_close_marker`, which equal the markers `isnad_core.streaming` enforces.

Version 2 adds a language rule: answer in the language the user writes in, keep quotations verbatim in their source language, and never translate inside citation markers. When the negotiated locale is `ar` (for example `GET /v1/system-prompt?lang=ar`), the prompt ends with one more line, «أجب بالعربية الفصحى ما لم يكتب المستخدم بلغة أخرى.»; `version` is the same.

### Server statistics

```http
GET /v1/stats
```

Disabled unless the deployment sets `ISNAD_STATS_ENABLED=1`; when disabled it returns `404` with the usual error envelope and `error.code = "not_found"`. It is off by default because the service has no authentication of its own.

The counters are aggregate only. The server never stores quote text, references, evidence, request IDs, or client addresses for them; source types and languages outside the configured adapters are counted as `other`. `/v1/verify` and the WebSocket gate both record each completed verification; rejected requests (`422`) are not counted, and source outages are counted separately.

```json
{
  "persistent": false,
  "started_at": "2026-10-06T08:00:00Z",
  "collecting_since": "2026-10-06T08:00:00Z",
  "uptime_seconds": 3600.0,
  "window_days": 30,
  "totals": {
    "verifications": 12,
    "source_unavailable_errors": 1,
    "by_status": {"exact_match": 7, "normalized_match": 2, "partial_match": 1,
                  "mismatch_at_cited_reference": 0, "quote_found_wrong_reference": 1,
                  "reference_found_without_quote": 0, "not_found_in_checked_corpus": 1,
                  "ambiguous_multiple_matches": 0, "unsupported_source_or_language": 0}
  },
  "breakdown": [
    {"status": "exact_match", "source_type": "quran", "language": "ar", "count": 7}
  ],
  "latency": {
    "buckets": [{"le_ms": 5, "count": 9}, {"le_ms": 10, "count": 1}, {"le_ms": 25, "count": 0},
                {"le_ms": 50, "count": 0}, {"le_ms": 100, "count": 0}, {"le_ms": 250, "count": 1},
                {"le_ms": 500, "count": 1}, {"le_ms": 1000, "count": 0}, {"le_ms": null, "count": 0}],
    "count": 12,
    "sum_ms": 712.4,
    "mean_ms": 59.367
  },
  "daily": [
    {"date": "2026-10-06", "total": 12, "source_unavailable_errors": 1,
     "by_status": {"exact_match": 7, "...": 0}}
  ]
}
```

- `totals.by_status` and every `daily[].by_status` list all nine statuses, zero-filled.
- `breakdown` lists only non-zero `status × source_type × language` combinations.
- `latency.buckets` are **non-cumulative** counts; `le_ms` is the inclusive upper bound in milliseconds and `null` is the open-ended last bucket. `mean_ms` is `null` before the first verification.
- `daily` always has `window_days` (30) entries, oldest first, ending with today's UTC date.
- `started_at` and `uptime_seconds` describe this process; `collecting_since` is when the counters began, which is earlier than `started_at` when they were loaded from a file.
- `persistent` is `true` when `ISNAD_STATS_PATH` is set: the file is loaded at startup and rewritten atomically every 60 seconds and on shutdown. Without it, counters reset on restart.

## Served interface

The same app serves a verification interface built on this contract:

```http
GET /                  # the interface, with a Content-Security-Policy header
GET /gui               # the same page when another service owns the root path
GET /gui/standalone.html   # the same interface as a downloadable single file
```

The page is one self-contained file: no external scripts, stylesheets, fonts or images, and no network request at all until it calls the API. It reads `/v1/capabilities` (limits, statuses, sources, marker protocol), `/health/ready` (loaded editions), `/v1/system-prompt` (the prompt it injects as the system message) and `POST /v1/verify`. In chat mode it also streams from the model endpoint the user configures in Model settings. The connection chip reports `API READY` when capabilities answered, and `API UNREACHABLE` when the base URL, the service, or the CORS allow-list is wrong; readiness is shown separately, because a reachable API does not mean the remote HadeethEnc service is reachable.

`/gui/standalone.html` is offered as an attachment. Opened from disk it has no same-origin API, so its Connection settings take a base URL and it sends credentialed-free `fetch` requests to that origin, which must list the page's origin in `ISNAD_CORS_ORIGINS`. The field rejects non-`http(s)` values, URLs carrying userinfo, and anything that is not a bare base: no secret belongs in a page.

The served policy is `default-src 'none'` with inline script and style only. It deliberately omits `frame-ancestors` so preview panels and local dashboards can embed the page; set `ISNAD_GUI_FRAME_ANCESTORS` (for example `'self'`) to restrict framing in a deployment. The download variant carries the same policy minus `frame-ancestors`, which browsers ignore in a `meta` element.

The interface is a view over the API, not a second authority: it renders the returned status, source text, attribution, grade and grader as supplied, states "no grade or grader was supplied with this source record" when a record carries none, and renders a source failure as a failure that decided nothing rather than as `not_found_in_checked_corpus`.

## Streaming WebSocket

Connect to `ws(s)://<host>/v1/stream` (add `?lang=ar` for Arabic explanations in `citation_result` payloads; `Accept-Language` and the default locale apply as for REST). Browser origins must be in the configured CORS allow-list (`ISNAD_CORS_ORIGINS`); native clients without an `Origin` header may connect. The allow-list is not authentication.

Send one JSON message per model-output fragment:

```json
{"type":"chunk","text":"Ordinary prose before the citation. "}
```

Wrap every complete quote **and its reference** in the reserved markers returned by `/v1/capabilities`:

```text
[[ISNAD-CITATION source=quran language=ar reference=2:255]]quoted text[[/ISNAD-CITATION]]
```

Header attributes are whitespace-separated `key=value` pairs. `source` and `language` are required; `reference` is optional for quote-only lookup. Header values cannot contain spaces. Supported source/language pairs and reference formats are listed in capabilities. If the quote literally contains either reserved marker, escape it with a preceding backslash; a paired backslash represents a literal backslash immediately before a marker. The gate removes the escape before verification.

Then send:

```json
{"type":"finish"}
```

Server events:

```json
{"type":"text","text":"Ordinary prose before the citation. "}
{"type":"citation_checking","citation_id":1,"placeholder":"checking_citation"}
{"type":"citation_result","citation_id":1,"result":{"status":"exact_match", "...":"VerifyResponse fields"}}
{"type":"citation_rejected","citation_id":2,"code":"incomplete_citation"}
{"type":"citation_error","citation_id":3,"code":"source_unavailable"}
{"type":"stream_complete"}
```

These are illustrative event shapes; the authoritative property names and limits are in the schema and runtime capabilities response. Ordinary prose outside a block streams immediately. After an opening marker is recognized, the UI should display the checking placeholder and withhold the entire quote/reference block. A result event is emitted only after verification. Malformed headers, nested blocks, oversized quotes, incomplete markers/blocks, invalid locators, and source errors do not echo held quote text. The connection is capped at 1,000,000 characters; each chunk string is capped at 16,384 characters and each framed WebSocket message at 96 KiB, as reported by `/v1/capabilities`.

The stream gate handles one plain-text output stream. It does not infer citations from free-form prose. If a model omits the markers, the gate treats ordinary text as ordinary text; use the agent skill or a compatible integration to require the explicit marker protocol.

## Environment

| Variable | Effect |
| --- | --- |
| `ISNAD_CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `ISNAD_GUI_FRAME_ANCESTORS` | Optional `frame-ancestors` value for the served page |
| `ISNAD_DEFAULT_LOCALE` | `en` (default) or `ar`; used when a request sets neither `lang` nor `Accept-Language` |
| `ISNAD_STATS_ENABLED` | `1` (or `true`, `yes`, `on`) enables `GET /v1/stats`; unset or any other value leaves it disabled |
| `ISNAD_STATS_PATH` | Optional JSON file for the statistics counters (loaded at startup, flushed every 60 s and on shutdown) |
| `ISNAD_MODEL_API_KEY`, `ISNAD_MODEL_BASE_URL`, `ISNAD_MODEL_NAME` | Server-side model proxy at `/v1/model` |

The MCP tools `verify_citation` and `isnad_capabilities` take an optional `locale` argument (`en` by default), and the LiteLLM guardrail takes an optional `locale` constructor argument (`en` by default).

## Deployment boundary

The served interface is public to anyone who can reach the service and has no login of its own; it is a client, not an authorization layer. The REST/WebSocket service has no built-in user authentication or distributed rate limiter. CORS is not an access-control mechanism. Deploy behind a trusted local network, authenticated gateway, and appropriate per-user/source rate limits before exposing it to untrusted clients. HadeethEnc is a remote upstream with bounded request timeout and cache; deployments must handle source errors explicitly.
