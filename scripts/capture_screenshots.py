"""Capture the interface screenshots that the README embeds.

Runs the real API, the real page in Chromium, and (for the chat shots) the
scripted provider from examples/. Output goes to docs/screenshots/.

    .venv/bin/python scripts/capture_screenshots.py

Screenshots are documentation, so they are captured from a running build rather
than assembled by hand: if a selector or a status label changes, re-running this
script updates the images the README points at. The interface opens in Arabic,
so most shots are Arabic; one chat and the hadith check show the English build.
"""

from __future__ import annotations

import importlib.util
import json
import socket
import threading
import time
from pathlib import Path

import uvicorn
from playwright.sync_api import sync_playwright

from isnad_core.api.app import create_app

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "screenshots"
PROVIDER = ROOT / "examples" / "fake_openai_provider.py"

QURAN_AR_QUOTE = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
HADITH_EN_QUOTE = "Verily, the reward of deeds depends on the intention"
CHAT_PROMPT = "Quote Sūrat al-Ikhlāṣ with its reference."
CHAT_PROMPT_AR = "اذكر سورة الإخلاص مع موضعها."


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def _start_api() -> str:
    port = _free_port()
    server = uvicorn.Server(
        uvicorn.Config(create_app(), host="127.0.0.1", port=port, log_level="warning")
    )
    threading.Thread(target=server.run, daemon=True).start()
    deadline = time.monotonic() + 20
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)
    if not server.started:  # pragma: no cover - environment dependent
        raise RuntimeError("the API did not start")
    return f"http://127.0.0.1:{port}/"


def _start_scripted_model() -> tuple[str, object]:
    spec = importlib.util.spec_from_file_location("isnad_screenshot_provider", PROVIDER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    port = _free_port()
    server = module.ThreadingHTTPServer(("127.0.0.1", port), module.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}/v1", server


def _wait_ready(page) -> None:
    """Wait for the connection chip to report ready (by attribute: narrow layouts hide it)."""

    page.wait_for_function(
        "() => document.querySelector('#api-status')?.dataset.state === 'ready'"
        " || document.querySelector('#apiBadge')?.dataset.state === 'ready'",
        timeout=20000,
    )


def _context(
    browser,
    *,
    theme: str,
    model_base: str | None,
    lang: str = "ar",
    width: int = 1440,
    height: int = 900,
):
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
    )
    settings = {
        "apiBase": "",
        "modelBase": model_base or "",
        "modelName": "fake-citation-model" if model_base else "",
        "modelRememberKey": False,
        "temperature": 0.3,
        "showTimestamps": True,
    }
    # The page stores every value JSON-encoded, the theme and language included.
    context.add_init_script(
        f"window.localStorage.setItem('isnad.gui.settings.v2', {json.dumps(json.dumps(settings))});"
        f"window.localStorage.setItem('isnad.gui.theme.v1', {json.dumps(json.dumps(theme))});"
        f"window.localStorage.setItem('isnad.gui.lang.v1', {json.dumps(json.dumps(lang))});"
    )
    return context


def _chat(context, base: str, page_path: Path, prompt: str = CHAT_PROMPT_AR) -> None:
    page = context.new_page()
    page.goto(base, wait_until="load")
    _wait_ready(page)
    page.fill("#composer-input", prompt)
    page.click("#send-button")
    page.wait_for_function(
        "() => document.querySelectorAll('.citation-slot .report-card').length === 2"
        " && !document.querySelector('#stop-button')",
        timeout=60000,
    )
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('.citation-slot').scrollIntoView({block:'start'})")
    page.evaluate("() => document.querySelector('#transcript').scrollBy(0, -150)")
    page.wait_for_timeout(250)
    page.screenshot(path=str(page_path))
    page.close()


def _pick(page, trigger: str, index: int) -> None:
    page.click(trigger)
    page.click(f"[role=option] >> nth={index}")


def _verify(
    context,
    base: str,
    page_path: Path,
    *,
    source: str,
    language: str,
    quote: str,
    reference: str,
) -> None:
    page = context.new_page()
    page.goto(base, wait_until="load")
    _wait_ready(page)
    page.click("#mode-verify")
    _pick(page, "#verify-source", 0 if source == "quran" else 1)
    _pick(page, "#verify-language", 0 if language == "ar" else 1)
    page.fill("#composer-input", quote)
    page.fill("#verify-reference", reference)
    page.click("#send-button")
    # The finished report, not the checking card, frames the shot.
    page.wait_for_selector(".report-card", timeout=45000)
    page.wait_for_timeout(400)
    page.evaluate("() => document.querySelector('.report-card').scrollIntoView({block:'start'})")
    page.evaluate("() => document.querySelector('#transcript').scrollBy(0, -24)")
    page.wait_for_timeout(250)
    page.screenshot(path=str(page_path))
    page.close()


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    base = _start_api()
    model_base, model_server = _start_scripted_model()
    saved: list[str] = []

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                light = _context(browser, theme="light", model_base=model_base)
                _chat(light, base, OUTPUT / "01-chat-citation-light.png")
                saved.append("01-chat-citation-light.png")
                _verify(
                    light,
                    base,
                    OUTPUT / "03-verify-quran-arabic.png",
                    source="quran",
                    language="ar",
                    quote=QURAN_AR_QUOTE,
                    reference="1:1",
                )
                saved.append("03-verify-quran-arabic.png")
                # The hadith report is the longest one, so it is captured in a
                # taller viewport framed from the result head: the status stays
                # visible next to the source-supplied grade.
                tall = _context(
                    browser, theme="light", model_base=model_base, lang="en", height=1150
                )
                _verify(
                    tall,
                    base,
                    OUTPUT / "04-verify-hadith-grade.png",
                    source="hadith",
                    language="en",
                    quote=HADITH_EN_QUOTE,
                    reference="hadeethenc:4560",
                )
                tall.close()
                saved.append("04-verify-hadith-grade.png")

                settings_page = light.new_page()
                settings_page.goto(base, wait_until="load")
                _wait_ready(settings_page)
                settings_page.click("aside >> text=الإعدادات")
                settings_page.wait_for_selector("#settings-dialog")
                settings_page.click("#settings-dialog [role=tab] >> nth=0")
                settings_page.wait_for_timeout(300)
                settings_page.screenshot(path=str(OUTPUT / "05-settings-language.png"))
                saved.append("05-settings-language.png")
                settings_page.close()

                # The dashboard reads this context's history: the checks above.
                dash = light.new_page()
                dash.goto(base + "dashboard/", wait_until="load")
                _wait_ready(dash)
                dash.wait_for_selector(".dash-hero", timeout=20000)
                dash.wait_for_timeout(600)
                dash.screenshot(path=str(OUTPUT / "07-dashboard.png"))
                saved.append("07-dashboard.png")
                dash.close()
                light.close()

                english = _context(browser, theme="light", model_base=model_base, lang="en")
                _chat(english, base, OUTPUT / "08-chat-english.png", prompt=CHAT_PROMPT)
                saved.append("08-chat-english.png")
                english.close()

                dark = _context(browser, theme="dark", model_base=model_base)
                _chat(dark, base, OUTPUT / "02-chat-citation-dark.png")
                saved.append("02-chat-citation-dark.png")
                dark.close()

                narrow = _context(
                    browser, theme="light", model_base=model_base, width=430, height=900
                )
                page = narrow.new_page()
                page.goto(base, wait_until="load")
                _wait_ready(page)
                page.fill("#composer-input", CHAT_PROMPT_AR)
                page.click("#send-button")
                page.wait_for_function(
                    "() => document.querySelectorAll('.citation-slot .report-card').length === 2",
                    timeout=60000,
                )
                page.wait_for_timeout(500)
                page.evaluate(
                    "() => document.querySelector('.citation-slot').scrollIntoView({block:'start'})"
                )
                page.wait_for_timeout(250)
                page.screenshot(path=str(OUTPUT / "06-narrow-layout.png"))
                saved.append("06-narrow-layout.png")
                page.close()
                narrow.close()
            finally:
                browser.close()
    finally:
        model_server.shutdown()  # type: ignore[attr-defined]
        model_server.server_close()  # type: ignore[attr-defined]

    for name in saved:
        path = OUTPUT / name
        print(f"{name}: {path.stat().st_size // 1024} KiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
