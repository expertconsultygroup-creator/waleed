"""Browser tests for the Next.js interface at /, skipped where no browser is installed.

They hold the new interface to the rules the classic one is held to: nothing a
model quotes is shown before the source has answered, the model's own wording
of a quotation never appears as source text, and markup in model output is
rendered as text. They also cover what is new: Arabic first, the language
switch, and the dashboard.
"""

from __future__ import annotations

import importlib.util
import threading
import time

import pytest

from tests.conftest import _PROVIDER_PATH, _free_port
from tests.test_gui_browser import ENGLISH, XSS_PAYLOAD, _seed_storage
from tests.test_web import EXPORT

pytestmark = pytest.mark.skipif(
    not (EXPORT / "index.html").is_file(), reason="the web interface has not been exported"
)


def _settings(model_base: str) -> dict[str, object]:
    return {
        "apiBase": "",
        "modelBase": model_base,
        "modelName": "fake-citation-model",
        "modelRememberKey": False,
        "temperature": 0.0,
        "showTimestamps": True,
    }


def _wait_ready(page) -> None:  # noqa: ANN001 - playwright types are optional
    page.wait_for_function(
        "() => document.querySelector('#api-status')?.dataset.state === 'ready'", timeout=20000
    )


def _collect_errors(page) -> list[str]:  # noqa: ANN001
    errors: list[str] = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    return errors


def test_opens_in_arabic_and_checks_a_quotation_by_hand(server_url, browser) -> None:
    page = browser.new_page(viewport={"width": 1400, "height": 950})
    errors = _collect_errors(page)
    page.goto(server_url, wait_until="load")
    _wait_ready(page)

    root = page.locator("html")
    assert root.get_attribute("lang") == "ar"
    assert root.get_attribute("dir") == "rtl"
    # Right to left: the sidebar is on the right of the page.
    sidebar = page.locator("aside").first.bounding_box()
    main = page.locator("main").bounding_box()
    assert sidebar and main and sidebar["x"] > main["x"]
    assert "ليست حكمًا على صحة الحديث" in page.inner_text("#disclaimer")

    quote = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
    page.click("#mode-verify")
    page.fill("#composer-input", quote)
    page.fill("#verify-reference", "1:1")
    page.click("#send-button")
    page.wait_for_selector(".report-card", timeout=30000)

    card = page.locator(".report-card").last
    assert card.get_attribute("data-status") == "normalized_match"
    # The source wording, set on the mushaf page in the Qur'anic face.
    source = card.locator(".evidence-text").first
    assert source.get_attribute("lang") == "ar"
    assert len(source.inner_text()) > 10
    # The reference is named for the reader (Al-Fatihah, ayah 1); the API's
    # notation stays on the element for anything that needs it.
    named = card.locator("bdi[data-reference='1:1']").first
    assert named.inner_text() == "الفاتحة: ١"
    assert named.get_attribute("dir") == "rtl"
    assert card.locator(".diff-source").count() >= 1
    assert errors == []
    page.close()


def test_chat_holds_quotations_until_the_source_answers(
    server_url, scripted_model_url, browser
) -> None:
    context = browser.new_context(viewport={"width": 1400, "height": 950})
    _seed_storage(context, **ENGLISH, **{"isnad.gui.settings.v2": _settings(scripted_model_url)})
    page = context.new_page()
    errors = _collect_errors(page)
    page.goto(server_url, wait_until="load")
    _wait_ready(page)
    assert page.locator("html").get_attribute("dir") == "ltr"

    page.fill("#composer-input", "Quote Sūrat al-Ikhlāṣ.")
    page.click("#send-button")
    page.wait_for_function(
        "() => document.querySelectorAll('.citation-slot .report-card').length === 2"
        " && !document.querySelector('#stop-button')",
        timeout=60000,
    )

    cards = page.locator(".citation-slot .report-card")
    assert cards.nth(0).get_attribute("data-status") == "normalized_match"
    assert "He is Allāh" in cards.nth(0).locator(".evidence-text").first.inner_text()
    assert cards.nth(1).get_attribute("data-status") in {
        "mismatch_at_cited_reference",
        "not_found_in_checked_corpus",
    }

    # Each card stands where the quotation was written.
    order = page.evaluate(
        "() => Array.from(document.querySelector('.assistant-content').children)"
        ".map(el => el.classList.contains('citation-slot') ? 'citation' : 'prose')"
    )
    assert order == ["prose", "citation", "prose", "citation", "prose"], order

    # A wording the corpus does not contain is only ever shown as what was
    # submitted: never as source text, never on the source side of a difference.
    for selector in (".evidence-text", ".diff-source"):
        for index in range(page.locator(selector).count()):
            assert "Everlasting Guardian" not in page.locator(selector).nth(index).inner_text()
    assert errors == []
    context.close()


def test_model_output_cannot_inject_markup(server_url, browser) -> None:
    spec = importlib.util.spec_from_file_location("isnad_web_xss_provider", _PROVIDER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SCRIPT = XSS_PAYLOAD
    port = _free_port()
    server = module.ThreadingHTTPServer(("127.0.0.1", port), module.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    context = browser.new_context(viewport={"width": 1400, "height": 950})
    _seed_storage(
        context, **ENGLISH, **{"isnad.gui.settings.v2": _settings(f"http://127.0.0.1:{port}/v1")}
    )
    page = context.new_page()
    dialogs: list[str] = []
    page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    try:
        page.goto(server_url, wait_until="load")
        _wait_ready(page)
        page.fill("#composer-input", "Show me markup handling.")
        page.click("#send-button")
        page.wait_for_function(
            "() => document.querySelectorAll('.citation-slot .report-card').length === 1",
            timeout=60000,
        )
        page.wait_for_timeout(300)
        assert page.evaluate("() => window.__xss") is None
        assert dialogs == []
        assert page.locator('img[src="x"]').count() == 0
        assert page.locator('a[href^="javascript:"]').count() == 0
        body = page.inner_text("body")
        assert "<script>window.__xss = 1;</script>" in body
    finally:
        context.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_language_switch_flips_direction_and_is_remembered(server_url, browser) -> None:
    page = browser.new_page(viewport={"width": 1400, "height": 950})
    errors = _collect_errors(page)
    page.goto(server_url, wait_until="load")
    _wait_ready(page)
    page.click("#lang-toggle")
    assert page.locator("html").get_attribute("lang") == "en"
    assert page.locator("html").get_attribute("dir") == "ltr"
    page.reload(wait_until="load")
    _wait_ready(page)
    assert page.locator("html").get_attribute("dir") == "ltr"
    assert "not a hadith authenticity grade" in page.inner_text("#disclaimer")
    assert errors == []
    page.close()


def test_dashboard_summarises_this_devices_history(server_url, browser) -> None:
    now = int(time.time() * 1000)

    def report(status: str, quote: str, reference: str) -> dict[str, object]:
        return {
            "status": status,
            "sourceType": "quran",
            "language": "ar",
            "sourceMetadata": None,
            "submittedQuote": quote,
            "citedReference": reference,
            "matchedReferences": [reference] if status == "normalized_match" else [],
            "evidence": [],
            "wordingDifferences": [],
            "explanation": "",
            "candidateCount": 1,
            "evidenceTruncated": False,
        }

    def item(item_id: str, ts: int, status: str, quote: str, ref: str) -> dict[str, object]:
        return {
            "id": item_id,
            "kind": "report",
            "role": "tool",
            "status": "complete",
            "createdAt": ts,
            "durationMs": 15,
            "report": report(status, quote, ref),
        }

    state = {
        "activeId": "seed-a",
        "mode": "verify",
        "chats": [
            {
                "id": "seed-a",
                "title": "Seeded checks",
                "createdAt": now,
                "updatedAt": now,
                "items": [
                    item("item-match", now - 1000, "normalized_match", "بسم الله", "1:1"),
                    item("item-flagged", now, "mismatch_at_cited_reference", "seeded", "112:2"),
                ],
            }
        ],
    }
    context = browser.new_context(viewport={"width": 1400, "height": 950})
    _seed_storage(context, **ENGLISH, **{"isnad.gui.state.v2": state})
    page = context.new_page()
    errors = _collect_errors(page)
    page.goto(server_url + "dashboard/", wait_until="load")
    page.wait_for_selector(".dash-hero", timeout=20000)

    values = page.locator(".kpi-value").all_inner_texts()
    assert values[:2] == ["2", "1"]
    assert "50%" in page.inner_text(".dash-hero")
    rows = page.locator(".flagged-table tbody tr")
    assert rows.count() == 1
    assert "112:2" in rows.first.inner_text()

    page.click("[data-open-chat]")
    page.wait_for_url("**/#m-item-flagged", timeout=10000)
    page.wait_for_selector("#m-item-flagged", timeout=10000)

    # Server statistics are off unless the deployment enables them. Readers are
    # told to ask an administrator; only an administrator is shown the setting.
    page.goto(server_url + "dashboard/", wait_until="load")
    page.wait_for_selector(".dash-hero", timeout=20000)
    page.click('[data-dash-scope="server"]')
    page.wait_for_selector(".server-note", timeout=10000)
    note = page.inner_text(".server-note")
    assert "administrator" in note
    assert "ISNAD_STATS_ENABLED" not in note
    page.goto(server_url + "dashboard/?admin=1", wait_until="load")
    page.wait_for_selector(".dash-hero", timeout=20000)
    page.click('[data-dash-scope="server"]')
    page.wait_for_selector(".server-note", timeout=10000)
    assert "ISNAD_STATS_ENABLED" in page.inner_text(".server-note")
    assert errors == []
    context.close()


def test_narrow_layout_opens_and_closes_the_drawer(server_url, browser) -> None:
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = _collect_errors(page)
    page.goto(server_url, wait_until="load")
    page.click("button[aria-label='إظهار المحادثات']")
    page.wait_for_selector("[role=dialog] aside", timeout=5000)
    page.click("[role=dialog] >> text=محادثة جديدة")
    page.wait_for_selector("[role=dialog]", state="detached", timeout=5000)
    assert page.evaluate("() => document.documentElement.scrollWidth") <= 390
    assert errors == []
    page.close()
