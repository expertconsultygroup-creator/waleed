# Isnad redesign plan: Arabic-first UI, new visual identity, dashboard

Status: implemented · 2026-10-06. Decisions taken: Limestone & Lapis palette, Arabic-Indic numerals by default (switchable), server stats in memory with optional JSON file (`ISNAD_STATS_PATH`), all fonts embedded in both builds (≈194 KB of WOFF2 subsets). Still open: a subject-matter review of the Arabic glossary (§2.2) and the backend message catalog (`src/isnad_core/i18n/messages.py`).

## 0. Where the project is today

| Area | Current state | What this means for the redesign |
| --- | --- | --- |
| Frontend | One vanilla-JS single-page app (`frontend/app.js`, 2,853 lines), `theme.css` (947 lines), `icons.svg`, `index.template.html`. `frontend/build.py` inlines everything into `isnad-gui.html` (standalone) and `api/templates/gui.html` (served). | Keep the architecture: no framework, no bundler, no CDN. The redesign works inside the same build. |
| Look | "Retro pixel" style: Silkscreen/VT323 monospace stacks, square corners, 2–3px slabs, orange `#ff5a1f`, uppercase tracked labels. | Replaced completely, but class names stay so `app.js` changes stay small. |
| Language | English only. About 160 user-facing strings are hard-coded in `app.js`, plus all the template markup. RTL is a manual "Layout direction" toggle. | Needs a real i18n layer, Arabic as the default, and direction tied to language. |
| RTL in CSS | Already uses logical properties (no `margin-left`/`right:` found), with four `[dir="rtl"]` patches. | Good starting point. The RTL work is mostly typography, icons, numerals, and bidi isolation. |
| CSP / offline | `font-src 'self'`, no external assets allowed (`tests/test_api_gui.py::test_interface_loads_no_external_resources`). | Fonts must be shipped inside the build. Google Fonts links are not allowed. |
| Backend text | Explanations are English f-strings in `quran/verifier.py`, `hadith/hadeethenc.py`, `engine.py`. Error messages are English in `api/app.py`. | Needs a message catalog with stable keys and per-request locale negotiation. |
| Persistence | None on the server. Conversations live in browser `localStorage`. | The dashboard needs a stats source: the local history plus a new privacy-safe server counter endpoint. |

## 1. Design direction: "Limestone & Lapis"

This applies the article's guidance to a tool for scholars and students who check citations. The direction combines **Quran.com's clarity** (the source text is the hero), **MIA Doha's restraint** (stone tones, generous white space, pattern only as an accent), and **the Biennale's modernity** (Islamic but not old-fashioned).

### 1.1 Palette

Green is reserved for the meaning "matches the source". It is never used as the brand color, so a green element always signals verification.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F6F2EA` limestone | `#0D1320` night | page |
| `--surface` | `#FFFDF8` | `#141B2B` | cards, panels |
| `--surface-sunken` | `#EDE6D8` sand | `#0A0F1A` | inputs, table headers |
| `--border` | `#DCD2BF` | `#26304A` | hairlines |
| `--text` | `#1B2230` ink | `#ECE6D8` | body |
| `--text-muted` | `#5B6272` | `#9AA3B8` | meta |
| `--primary` | `#1F4E79` lapis | `#7FB3E0` | buttons, links, focus |
| `--ornament` | `#B08A3E` gold | `#D4B06A` | pattern, dividers, logo only (never text on light bg: contrast) |
| `--accent-turquoise` | `#2A8C8C` | `#5CC2C2` | charts' 2nd series, highlights |
| `--status-match` | `#1D6B3A` | `#5BC27E` | exact / normalized |
| `--status-partial` | `#9A6B00` | `#E0B24A` | partial, ambiguous |
| `--status-mismatch` | `#B23A2A` | `#F07A66` | mismatch, wrong reference, not found |
| `--status-info` | `#1F4E79` | `#7FB3E0` | reference-only, unsupported |

Every pair must pass WCAG AA (4.5:1 for text). This is checked in Phase 7.

### 1.2 Typography (the article's main warning)

| Role | Font | Notes |
| --- | --- | --- |
| Arabic UI and body | **IBM Plex Sans Arabic** 400/500/600 | Body 18px (Latin 16px), `line-height: 1.85`, **no `letter-spacing`, no `text-transform`** for Arabic |
| Latin UI | **IBM Plex Sans** 400/600 | Pairs with Plex Arabic metrics |
| Qur'an evidence text | **Amiri Quran** | Renders Tanzil Uthmani marks correctly. 24–28px, `line-height: 2.2` |
| Hadith text | **Amiri** (Naskh) | 20–22px, `line-height: 2` |
| References, status codes, checksums | **IBM Plex Mono** | Always `dir="ltr"` inside `<bdi>` |

All fonts are SIL OFL, so they can be redistributed. `NOTICE.md` gets the attributions.

**Delivery:** the fonts are subset with `pyftsubset` to the Arabic, Arabic Presentation Forms and Basic Latin ranges, saved as woff2 in `frontend/fonts/`, and inlined by `build.py` as base64 `@font-face` sources. Both CSP strings (`frontend/build.py:APPLICATION_CSP` and `api/app.py:_GUI_CSP`) change from `font-src 'self'` to `font-src 'self' data:`. Size budget: at most about 450 KB of font data in total. If Amiri Quran pushes past that, the standalone build falls back to system Naskh fonts (`"Geeza Pro", "Noto Naskh Arabic", "Traditional Arabic"`) and only the served build embeds it.

### 1.3 Geometry, not imagery

- **One generator, `frontend/geometry.js`**: it divides a circle into *n* parts and draws the classic 8-fold *khatam* star and a 12-fold rosette as SVG paths. Because the pattern is built in code, it is constructed correctly instead of looking like clip art (following the construction methods on artofislamicpattern.com).
- **Where it appears (accent only):**
  - Logo: an 8-point star inside a circle beside the wordmark **إسناد**. It replaces the pixel mark and favicon.
  - Empty chat state: a large faint rosette medallion (opacity 6%) behind the welcome title.
  - Sidebar head and dashboard header: a thin tiled star band, 24px tall, in `--ornament`.
  - Loader while a citation is verified: the star drawn stroke by stroke (`stroke-dashoffset`), respecting `prefers-reduced-motion`.
  - Section dividers: a hairline with a small 8-point star at the center.
- **Not allowed:** full-page patterns, mosque photos, or ornament behind text.

### 1.4 Shape and motion

- Radius: 12px on cards, 10px on controls, 999px on chips. 1px hairline borders and soft shadows instead of hard slabs.
- Motion: 160–220ms `cubic-bezier(.22,1,.36,1)`. Remove the `steps()` retro easing.
- Citation cards: the source text sits in a "mushaf panel" (a sunken surface, centered Amiri Quran text, ayah number in an ornamented circle ۝).

## 2. Arabic-first in the frontend

### 2.1 i18n layer: new `frontend/i18n.js`, inlined before `app.js`

```js
const I18N = {
  ar: { 'nav.newChat': 'محادثة جديدة', 'status.exact_match.label': 'مطابقة تامة', ... },
  en: { 'nav.newChat': 'New chat',      'status.exact_match.label': 'Exact match', ... },
};
function t(key, params) { /* lookup → fallback en → key; {name} interpolation */ }
function plural(key, n) { /* Intl.PluralRules('ar') → zero/one/two/few/many/other */ }
const fmt = { number(n), date(d), time(d), relative(d) }; // Intl with current locale
```

- **Arabic plurals matter:** "١ استشهاد", "استشهادان", "٣ استشهادات", "١١ استشهادًا". Use `Intl.PluralRules('ar')` for all six forms. Never build them by string concatenation.
- **Template:** static text gets `data-i18n="key"`, attributes get `data-i18n-attr="placeholder:key;aria-label:key;title:key"`. `applyLanguage(lang)` walks the DOM once and sets `<html lang dir>`.
- **Pre-paint script** (next to the existing theme script in `index.template.html`): it reads `isnad.gui.lang.v1` and sets `lang` and `dir` before CSS loads, so the page does not flash in LTR first.
- **Default language: Arabic.** English is a switch in the header (`ع | EN`) and in Settings.
- **Replace the "Layout direction" setting:** direction follows language. Mixed content uses `dir="auto"`, which is already in place.

### 2.2 Translation inventory (all user-visible text)

| Source | Approx. strings | Notes |
| --- | --- | --- |
| `index.template.html` | ~90 | sidebar, composer, settings, dialogs |
| `app.js` status table (`STATUS_INFO`, ~line 560–600) | 27 (9 statuses × label/tone/meaning) | see the glossary below |
| `app.js` other literals | ~160 | toasts, errors, empty states, result-card labels |
| New dashboard | ~60 | |

**Status glossary (to be reviewed by a subject expert before release):**

| Code | العربية | Meaning (ar) |
| --- | --- | --- |
| `exact_match` | مطابقة تامة | النص المُدخل يطابق نص المصدر في الموضع المذكور حرفًا بحرف. |
| `normalized_match` | مطابقة بعد توحيد الرسم | يطابق النصَّ بعد تجاوز الفروق غير اللفظية كالتشكيل والتطويل. |
| `partial_match` | مطابقة جزئية | جزء من النص فقط يوافق المصدر. |
| `mismatch_at_cited_reference` | لا يطابق الموضع المذكور | الموضع موجود، لكنه لا يتضمن النص المُدخل. |
| `quote_found_wrong_reference` | النص في موضع آخر | النص موجود في المصدر، لكن في موضع غير المذكور. |
| `reference_found_without_quote` | موضع بلا نص للمقارنة | الموضع موجود، ولم يُرسَل نص لمقارنته. |
| `not_found_in_checked_corpus` | غير موجود في المصدر المفحوص | لم يُعثر على النص في الإصدار المحدود الذي فُحص. |
| `ambiguous_multiple_matches` | مطابقات متعددة | طابق النصُّ أكثر من موضع، فتعذّر حصره في موضع واحد. |
| `unsupported_source_or_language` | المصدر أو اللغة غير مدعومة | لا يتوفر مُحقِّق لهذا المصدر وهذه اللغة. |

**The mandatory disclaimers must exist in both languages.** The tests in `test_api_gui.py` keep checking the English strings, which are still present in the inlined catalog. New tests check the Arabic strings as well:
> حالة المطابقة تصف التطابق النصي فقط، وليست حكمًا على صحة الحديث ولا فتوى شرعية. تُعرض درجة الحديث ومن حكم بها فقط إذا نصّ عليها المصدر، ولا تستنتجها هذه الواجهة أبدًا. وتعذّر الفحص لا يعني أن النص غير موجود.

### 2.3 RTL details

- **Bidi isolation:** wrap every reference (`2:255`, `hadeethenc:1234`), status code, checksum, model name and URL in `<bdi dir="ltr">`. This fixes `٢٥٥:٢` rendering as `255:2`.
- **Numerals:** a Settings option **"الأرقام: هندية ١٢٣ / عربية 123"**, default Arabic-Indic for UI counts via `Intl.NumberFormat('ar-SA')`. References always keep the digits the source uses.
- **Dates:** a Settings option for the calendar, Gregorian or Hijri (`ar-SA-u-ca-islamic-umalqura`). Timestamps and dashboard axes use it.
- **Icons:** audit `icons.svg`. Send, chevrons, back, collapse-sidebar and "expand" get `.icon-mirror`. Search, check, refresh and download are not mirrored.
- **Arabic-aware conversation search:** normalize both sides (strip tashkeel and tatweel, unify أإآ→ا, ى→ي, ة→ه) so "الرحمن" finds "ٱلرَّحْمَٰنِ". This reuses the same rules as `normalization.py`, ported to about 30 lines of JS.
- **Composer:** `dir="auto"` stays. The textarea placeholder and hints are translated, and the Enter/Shift+Enter hint uses localized key names.
- **Keyboard shortcuts** stay physical, but labels are localized.

## 3. Arabic in the backend

The goal: every human-readable string the API returns can be served in Arabic, while every machine-readable field (`status`, `code`, references) stays stable. The English default keeps the current API contract and its tests unchanged.

### 3.1 Locale negotiation

- New module `src/isnad_core/i18n/__init__.py`: `negotiate_locale(request) -> "ar" | "en"`. Order: `?lang=` query → `Accept-Language` header → `ISNAD_DEFAULT_LOCALE` env (default `en`).
- Responses carry `Content-Language`. Requests stay `Vary: Accept-Language` (cache safety, even though `no-store` is already set).
- `/v1/capabilities` adds `"locales": ["ar", "en"]`.

### 3.2 Message catalog

- `src/isnad_core/i18n/messages.py`: `MESSAGES = {"quran.full_match": {"en": "The quote matches a complete ayah or range in the pinned {edition} corpus. This is a textual comparison only.", "ar": "يطابق النصُّ آيةً كاملة أو مقطعًا متصلًا في نسخة {edition} المعتمدة. هذه مقارنة نصية فقط."}, ...}`
- Refactor `VerificationResult.explanation: str` → `explanation_key: str` + `explanation_params: Mapping[str, str]`, with a `render_explanation(locale)` helper. About 20 call sites in `quran/verifier.py`, `hadith/hadeethenc.py` and `engine.py` change from f-strings to `(key, params)`.
- `api/serializers.verification_response(result, locale)` renders `explanation` in the negotiated locale and **adds** `explanation_key` (an additive field, so existing clients are unaffected).
- Error handlers in `api/app.py` (6 messages) and the model-proxy errors get keys and Arabic text. `code` values do not change.
- Source metadata: add `display_name` per locale (for example, Tanzil → «مشروع تنزيل — الرسم العثماني», QuranEnc → «موسوعة القرآن الكريم المترجمة — صحيح الإنجليزية», HadeethEnc → «موسوعة الأحاديث النبوية»). Coverage notes are translated too.
- `/v1/capabilities` returns localized `label`/`meaning` for each status, so the API becomes a second source of truth. The frontend keeps its own catalog so the UI still works when the API is down.

### 3.3 Model behaviour in Arabic

- `prompt.py`: add a rule: *"Answer in the language the user writes in. Quotations stay verbatim in their source language; do not translate inside citation markers."* Bump `SYSTEM_PROMPT_VERSION` → `isnad-citation-protocol-v2` and update `tests/test_system_prompt.py`.
- `/v1/system-prompt?lang=ar` may append a one-line preference ("أجب بالعربية الفصحى ما لم يكتب المستخدم بغيرها") when the UI is in Arabic.

### 3.4 Integrations

- MCP server (`integrations/mcp_server.py`): an optional `locale` tool argument, default `en`.
- LiteLLM guardrail: a `locale` config key, default `en`.

### 3.5 Backend tests

- `tests/test_i18n.py`: every key has `ar` and `en` with the same placeholder set, there are no empty strings, and the Arabic strings contain Arabic characters.
- Parametrize `test_api.py` verify and error tests over `Accept-Language: ar|en`. Assert that `status`/`code` are identical across locales and that `explanation` differs.
- `test_engine.py` and the verifier tests assert on `explanation_key` instead of English prose, which makes them less brittle.

## 4. The dashboard page (لوحة المتابعة)

### 4.1 Routing

The app stays a single file. Add a tiny hash router in `app.js` with `#/chat` (the default, today's screen), `#/dashboard`, and `#/chat/<id>`. The sidebar gets a primary nav above the conversation list: **المحادثات** · **لوحة المتابعة**. On narrow screens, the nav becomes a bottom tab bar.

### 4.2 Data sources: two scopes, switchable at the top

| Scope | Source | Contains |
| --- | --- | --- |
| **هذا الجهاز** (this device), the default | Aggregated in the browser from the saved conversation history in `localStorage` | everything below, including the quote text of flagged items |
| **الخادم** (this server) | New `GET /v1/stats` | counts only: **no quote text and no references are stored on the server** (privacy by design) |

**Backend `/v1/stats`** (new `src/isnad_core/api/stats.py`):
- A thread-safe in-memory `StatsCollector`, incremented in `/v1/verify`, the WebSocket gate and the model proxy. It records counts by `status × source_type × language`, latency histogram buckets, per-day buckets for the last 30 days, `source_unavailable` errors, and uptime.
- Optional persistence: `ISNAD_STATS_PATH=/var/lib/isnad/stats.json`, flushed every 60s and on shutdown. Without it, counters reset on restart, and the dashboard says so.
- Exposed only when `ISNAD_STATS_ENABLED=1` (off by default, because the reference client has no auth; see the README's limitations). The response is localized like everything else.
- Tests in `tests/test_stats.py`: counters increment, there is no PII in the payload, and the endpoint returns 404 when disabled.

### 4.3 Layout (RTL-first, top to bottom)

```
┌──────────────────────────────────────────────────────────────┐
│ ✦ لوحة المتابعة            [هذا الجهاز | الخادم]  [٣٠ يومًا ▾] │  ← thin star band under header
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ استشهادات    │ نسبة المطابقة │ تحتاج مراجعة  │ متوسط زمن الفحص   │  ← KPI tiles + 30-day sparkline
│ مفحوصة ١٬٢٤٨  │ ٨٧٪           │ ٤٣            │ ١٨ م.ث            │
├──────────────┴──────────────┼──────────────┴─────────────────┤
│ توزيع حالات المطابقة          │ النشاط اليومي                       │
│ (horizontal bars, 9 statuses │ (stacked columns: matched /        │
│  colored by tone, sorted)    │  needs review, per day)            │
├─────────────────────────────┼────────────────────────────────┤
│ حسب المصدر واللغة             │ صحة المصادر                         │
│ القرآن · عربي   ███████ ٨١٢   │ ● تنزيل العثماني v1.1  sha256 ✓     │
│ القرآن · إنجليزي ██ ١٩٠       │ ● QuranEnc 1.1.2       sha256 ✓     │
│ الحديث · عربي   ███ ٢٠١       │ ● HadeethEnc API       متاح / متعذّر  │
│ الحديث · إنجليزي █ ٤٥         │ إصدار البروتوكول · النموذج · الواجهة    │
├─────────────────────────────┴────────────────────────────────┤
│ استشهادات تحتاج مراجعة (table: النص · الموضع المذكور · الحالة ·    │
│ المحادثة ↗ · الوقت)  — device scope only; filter by status/source │
└──────────────────────────────────────────────────────────────┘
```

- **"Needs review"** = `mismatch_at_cited_reference` + `quote_found_wrong_reference` + `not_found_in_checked_corpus` + `ambiguous_multiple_matches`. **"Match rate"** = exact + normalized + partial over all checked, with partial shown separately in the tooltip.
- **Charts** are hand-written inline SVG in a new `frontend/charts.js` (about 250 lines: bar, stacked column, sparkline). Chart libraries are ruled out by the CSP and the offline requirement. Charts are mirrored for RTL (time runs right → left in Arabic), label numerals follow the numerals setting, and every chart has a visually hidden data table for screen readers.
- **Empty state:** the rosette medallion plus «لم تُفحص أي استشهادات بعد — ابدأ محادثة أو تحقّق من نص» with two buttons.
- **Disclaimer footer**, as on the chat screen: match rates describe textual correspondence only.
- **Export:** CSV of the flagged table (UTF-8 with BOM so Excel opens Arabic correctly).

## 5. Execution phases

Each phase ends green on `scripts/verify.sh`, with `python frontend/build.py` re-run (the build-drift test `test_committed_builds_match_their_sources` requires this).

| # | Phase | Main files | Done when |
| --- | --- | --- | --- |
| 1 | **Foundations**: tokens, fonts, CSP | `theme.css` (`:root` tokens), `frontend/fonts/*`, `build.py` (font inlining, CSP), `api/app.py` (CSP), `NOTICE.md` | New palette and fonts render in both builds; no external requests; CSP tests updated |
| 2 | **Frontend i18n plumbing** | new `i18n.js`, `build.py` (inline order), `index.template.html` (`data-i18n`, pre-paint lang script), `app.js` (`t()` everywhere, language setting replaces direction toggle) | UI fully switchable ar ⇄ en; Arabic is the default; no hard-coded English left (grep check) |
| 3 | **Visual redesign of existing screens** | `theme.css` (rewrite components, keep class names), new `geometry.js`, `icons.svg` (new logo, mirrored icons), template | Sidebar, chat, citation card (mushaf panel), verify mode, settings and toasts match §1; both themes |
| 4 | **RTL polish** | `app.js` (bdi wrapping, numerals, Hijri option, Arabic search normalization), `theme.css` | Checklist in §2.3 passes in Arabic and English |
| 5 | **Backend i18n** | new `i18n/`, `models.py`, `quran/verifier.py`, `hadith/hadeethenc.py`, `engine.py`, `api/serializers.py`, `api/app.py`, `prompt.py`, integrations | §3.5 tests pass; the English contract is unchanged; `docs/api-contract.md` documents `lang`, `Accept-Language`, `explanation_key` |
| 6 | **Dashboard** | `app.js` (router, view), new `charts.js`, template, new `api/stats.py`, `api/app.py`, `tests/test_stats.py` | §4 is implemented; both scopes work; there are empty, loading and error states |
| 7 | **Quality pass** | `tests/test_gui_browser.py`, `scripts/capture_screenshots.py`, `README.md` | See §6; screenshots regenerated in Arabic and English, light and dark |

Phases 1–2 must come first. Phases 3 and 5 can run in parallel. Phase 6 depends on 2 and 3 (and on 5 for the server scope).

## 6. Verification checklist

- [ ] `scripts/verify.sh` passes (ruff, pytest, wheel and package-data contents, secret scan)
- [ ] `pyproject.toml` package-data still includes the templates. Fonts are inlined, so no new package data is needed.
- [ ] Browser tests (Playwright) cover: the language switch persists across reload; `<html dir>` flips; no LTR flash; the dashboard renders with seeded history; flagged rows link to their conversation; the RTL chart starts on the right
- [ ] Contrast meets AA for all tokens in both themes; keyboard focus is visible; dialogs trap focus; `prefers-reduced-motion` disables the star loader animation
- [ ] Arabic rendering: Amiri Quran shows all Tanzil marks (۞ ۩ small high letters); tashkeel is not clipped (line-height); no letter-spacing on Arabic anywhere (grep `letter-spacing` for `:lang(ar)` overrides)
- [ ] Mixed text: `٢:٢٥٥` vs `2:255`, `hadeethenc:1234` and `normalized_match` render in the correct order inside Arabic sentences
- [ ] Narrow layout at 360px: bottom nav, no horizontal scroll, composer usable
- [ ] Size: the standalone HTML stays within the font budget (§1.2)
- [ ] Disclaimers are present in both languages (tests)
- [ ] A subject-matter reviewer has signed off on the Arabic glossary (§2.2) and the backend explanation catalog

## 7. Decisions to confirm before starting

1. **Palette:** Limestone & Lapis (recommended), or the classic deep green, gold and cream? Green as the brand color would blur the "green = match" signal, which is why it is not recommended.
2. **Numerals default** in Arabic: Arabic-Indic ١٢٣ (recommended, matches `ar-SA`) or Western 123?
3. **Server stats:** in-memory plus optional JSON file (recommended), or skip the server scope and keep the dashboard local-only?
4. **Quran font in the standalone file:** embed Amiri Quran (larger file) or use system fonts in standalone only?
