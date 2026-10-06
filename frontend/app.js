/* ============================================================================
   ISNAD CORE — chat interface with source-checked quotations.

   Two surfaces, one shell:
   - Chat: the user talks to a model. The citation protocol prompt is injected
     automatically as the system message, the model's prose streams straight
     through, and every marked quotation is held, verified against the pinned
     source and rendered as a citation card.
   - Verify: the same verification applied by hand, for a quote with no model
     involved.
   - Dashboard: what was checked and how it matched, from this device's
     history or the server's anonymous counters.

   Every visible string comes from IsnadI18n (i18n.js); Arabic is the default
   language and right-to-left the default direction.

   Rules this file exists to enforce:
   - Nothing unverified is ever shown as a quotation. A marked block is held
     whole (quote and reference together) until the verifier answers.
   - The model's own words for a quotation are never displayed: the card shows
     the source's wording, or the API's failure, and nothing in between.
   - A match status is never presented as a hadith grade, an authenticity
     judgement, or a ruling. A grade appears only when the source supplies one.
   - The model API key is a secret: kept in memory by default, stored on the
     device only if the user explicitly asks, never logged, never sent anywhere
     except the model endpoint the user configured.
   ========================================================================= */
(function () {
  'use strict';

  /* ==========================================================================
     1. UTILITIES
     ======================================================================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const I18N = window.IsnadI18n;
  const t = I18N.t;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function icon(id, cls) {
    return '<svg aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') +
      '><use href="#' + id + '"/></svg>';
  }

  function formatTime(ts) {
    return I18N.time(ts);
  }

  function formatDuration(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '';
    return ms >= 1000
      ? t('duration.s', { n: I18N.number(ms / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
      : t('duration.ms', { n: Math.max(1, Math.round(ms)) });
  }

  function formatCount(n) {
    return I18N.number(n);
  }

  /* A reference or code inside running text: isolated and left-to-right, so
     the Arabic sentence around it cannot reorder its digits. */
  function refHtml(text) {
    return '<bdi class="ref" dir="ltr">' + escapeHtml(text) + '</bdi>';
  }

  function versionHtml(version) {
    const text = String(version || '');
    return refHtml(/^\d/.test(text) ? 'v' + text : text);
  }

  function sourceLabel(type) {
    return type === 'hadith' ? t('source.hadith') : (type === 'quran' ? t('source.quran') : String(type || ''));
  }

  function languageLabel(lang) {
    return lang === 'ar' ? t('lang.ar') : (lang === 'en' ? t('lang.en') : String(lang || ''));
  }

  function shortHash(value) {
    const text = String(value || '');
    return text.length > 12 ? text.slice(0, 12) + '…' : text;
  }

  function humanizeToken(value) {
    const text = String(value == null ? '' : value).replace(/_/g, ' ').trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  const storage = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };

  /* ==========================================================================
     2. MARKDOWN — escape first, then a small safe subset.
     ======================================================================= */
  const MD = (function () {

    function inline(src) {
      const codes = [];
      let s = src;
      s = s.replace(/`([^`]+)`/g, function (_, code) {
        codes.push(code);
        return '\u0000C' + (codes.length - 1) + '\u0000';
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      s = s.replace(
        /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>'
      );
      s = s.replace(/\u0000C(\d+)\u0000/g, function (_, i) {
        return '<code class="inline-code">' + codes[Number(i)] + '</code>';
      });
      return s;
    }

    function codeBlock(escapedCode, lang) {
      const safeLang = escapeHtml(lang || 'text');
      return '<div class="codeblock">' +
        '<div class="codeblock__bar">' +
          '<span class="codeblock__lang">' + safeLang + '</span>' +
          '<button class="codeblock__copy" type="button" data-copy-code>' + escapeHtml(t('code.copy')) + '</button>' +
        '</div>' +
        '<pre class="codeblock__pre" tabindex="0" role="region" aria-label="' +
          escapeHtml(t('code.sample', { lang: lang || 'text' })) + '"><code>' + escapedCode + '</code></pre>' +
      '</div>';
    }

    /* Returns one HTML string per top-level block, so a streaming message can
       repaint only the block that is still being written. */
    function renderBlocks(source) {
      const lines = escapeHtml(source == null ? '' : source).split('\n');
      const blocks = [];
      let html = '';
      let i = 0;
      let listType = null;
      let inCode = false;
      let codeLang = '';
      let codeBuf = [];

      function flush() { if (html !== '') { blocks.push(html); html = ''; } }
      function closeList() { if (listType) { html += '</' + listType + '>'; listType = null; flush(); } }

      while (i < lines.length) {
        const line = lines[i];

        const fence = line.match(/^```(\w*)\s*$/);
        if (fence) {
          if (!inCode) { closeList(); inCode = true; codeLang = fence[1] || 'text'; codeBuf = []; }
          else { inCode = false; html += codeBlock(codeBuf.join('\n'), codeLang); flush(); }
          i += 1;
          continue;
        }
        if (inCode) { codeBuf.push(line); i += 1; continue; }

        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
          closeList();
          const level = Math.min(heading[1].length + 2, 6);
          html += '<h' + level + ' dir="auto">' + inline(heading[2]) + '</h' + level + '>';
          flush();
          i += 1;
          continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
          closeList(); html += '<hr>'; flush(); i += 1; continue;
        }

        if (/^&gt;\s?/.test(line)) {
          closeList();
          const buf = [];
          while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
            buf.push(lines[i].replace(/^&gt;\s?/, ''));
            i += 1;
          }
          html += '<blockquote dir="auto">' + renderBlocks(unescapeNested(buf.join('\n'))).join('') + '</blockquote>';
          flush();
          continue;
        }

        const ul = line.match(/^\s*[-*]\s+(.*)$/);
        if (ul) {
          if (listType !== 'ul') { closeList(); html += '<ul dir="auto">'; listType = 'ul'; }
          html += '<li>' + inline(ul[1]) + '</li>';
          i += 1;
          continue;
        }

        const ol = line.match(/^\s*\d+\.\s+(.*)$/);
        if (ol) {
          if (listType !== 'ol') { closeList(); html += '<ol dir="auto">'; listType = 'ol'; }
          html += '<li>' + inline(ol[1]) + '</li>';
          i += 1;
          continue;
        }

        if (line.trim() === '') { closeList(); i += 1; continue; }

        closeList();
        const buf = [line];
        i += 1;
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s|&gt;)/.test(lines[i])
        ) {
          buf.push(lines[i]);
          i += 1;
        }
        html += '<p dir="auto">' + inline(buf.join(' ')) + '</p>';
        flush();
      }

      if (inCode) { html += codeBlock(codeBuf.join('\n'), codeLang); flush(); }
      closeList();
      flush();
      return blocks;
    }

    function unescapeNested(s) {
      return s
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    }

    return { render: (source) => renderBlocks(source).join(''), renderBlocks: renderBlocks, escape: escapeHtml };
  })();

  /* The transcript paints block by block and reuses finished blocks, so a
     streaming answer costs one block per token, not a re-parse of everything. */
  const Rich = (function () {
    const states = new WeakMap();

    function paint(container, source) {
      if (!container) return 0;
      const blocks = MD.renderBlocks(source || '');
      let state = states.get(container);
      if (!state) { state = { html: [], nodes: [] }; states.set(container, state); }

      while (state.nodes.length > blocks.length) {
        const gone = state.nodes.pop();
        state.html.pop();
        if (gone && gone.parentNode === container) container.removeChild(gone);
      }

      for (let i = 0; i < blocks.length; i += 1) {
        const previous = state.nodes[i];
        if (state.html[i] === blocks[i] && previous && previous.parentNode === container) continue;

        const holder = document.createElement('div');
        holder.innerHTML = blocks[i];
        const node = holder.firstElementChild;
        if (!node) continue;

        if (previous && previous.parentNode === container) container.replaceChild(node, previous);
        else container.appendChild(node);

        state.nodes[i] = node;
        state.html[i] = blocks[i];
      }
      return blocks.length;
    }

    return { paint: paint };
  })();

  /* ==========================================================================
     3. TOASTS
     ======================================================================= */
  const Toasts = (function () {
    const root = $('#toasts');
    const active = new Map();

    function dismiss(el) {
      el.setAttribute('data-leaving', 'true');
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 180);
    }

    function show(message, tone) {
      const key = (tone || '') + '|' + message;
      const existing = active.get(key);
      if (existing) {
        window.clearTimeout(existing.timer);
        existing.timer = window.setTimeout(function () { active.delete(key); dismiss(existing.el); }, 3200);
        return;
      }
      const el = document.createElement('div');
      el.className = 'toast' + (tone ? ' toast--' + tone : '');
      el.setAttribute('role', 'status');
      el.innerHTML = (tone === 'error' ? icon('ic-warn') : icon('ic-check')) +
        '<span>' + escapeHtml(message) + '</span>';
      root.appendChild(el);
      const entry = { el: el, timer: 0 };
      entry.timer = window.setTimeout(function () { active.delete(key); dismiss(el); }, 3200);
      active.set(key, entry);
    }

    return { show: show };
  })();

  /* ==========================================================================
     4. VERIFICATION API CLIENT
     ======================================================================= */
  const Api = (function () {

    function normalizeBase(value) {
      const raw = String(value == null ? '' : value).trim();
      if (!raw) return '';
      let parsed;
      try { parsed = new URL(raw); } catch (e) { throw new Error('not-a-url'); }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad-scheme');
      if (parsed.username || parsed.password) throw new Error('credentials-in-url');
      if (parsed.search || parsed.hash) throw new Error('not-a-base');
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }

    function base() { return Store.state.settings.apiBase || ''; }
    function url(path) { return base() + path; }
    function describeBase() {
      if (base()) return base();
      return window.location.protocol === 'file:' ? t('api.thisOrigin') : window.location.origin;
    }

    async function request(path, options) {
      const opts = options || {};
      const controller = new AbortController();
      const onAbort = function () { controller.abort(); };
      if (opts.signal) {
        if (opts.signal.aborted) controller.abort();
        else opts.signal.addEventListener('abort', onAbort, { once: true });
      }
      const timer = window.setTimeout(function () { controller.abort('timeout'); }, opts.timeoutMs || 15000);
      const started = Date.now();

      let response;
      try {
        response = await window.fetch(url(path), {
          method: opts.method || 'GET',
          headers: Object.assign(
            { Accept: 'application/json', 'Accept-Language': I18N.language() },
            opts.body ? { 'Content-Type': 'application/json' } : null
          ),
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
          mode: 'cors'
        });
      } catch (err) {
        const aborted = controller.signal.aborted;
        const external = opts.signal && opts.signal.aborted;
        const reason = controller.signal.reason;
        if (aborted && !external && reason === 'timeout') {
          throw apiError('timeout', t('error.timeoutRaw', { base: describeBase() }));
        }
        if (external || aborted) throw apiError('cancelled', t('error.requestCancelled'));
        throw apiError('network', t('error.networkRaw', { base: describeBase() }));
      } finally {
        window.clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      }

      const text = await response.text();
      let payload = null;
      if (text) { try { payload = JSON.parse(text); } catch (e) { payload = null; } }

      if (!response.ok) {
        const body = payload && payload.error ? payload.error : {};
        throw apiError(body.code || ('http_' + response.status), body.message || response.statusText, {
          httpStatus: response.status,
          requestId: payload && payload.request_id,
          retryAfter: response.headers.get('Retry-After'),
          details: body.details || [],
          durationMs: Date.now() - started
        });
      }
      if (!payload || typeof payload !== 'object') {
        throw apiError('invalid_response', t('error.notJson'));
      }
      return { payload: payload, durationMs: Date.now() - started, status: response.status };
    }

    function apiError(code, message, extra) {
      const err = new Error(message);
      err.isnad = Object.assign({ code: code, message: message }, extra || {});
      return err;
    }

    return {
      normalizeBase: normalizeBase,
      base: base,
      describeBase: describeBase,
      capabilities: (options) => request('/v1/capabilities', options),
      ready: (options) => request('/health/ready', options),
      systemPrompt: (options) => request('/v1/system-prompt?lang=' + I18N.language(), options),
      stats: (options) => request('/v1/stats', options),
      verify: (body, options) => request('/v1/verify', Object.assign({ method: 'POST', body: body, timeoutMs: 45000 }, options)),
      error: apiError
    };
  })();

  /* ==========================================================================
     5. MODEL CLIENT — any OpenAI-compatible chat completions endpoint.

     Streaming only: the citation gate needs to see tokens as they arrive, and a
     non-streamed answer would arrive with its quotations already displayed.
     ======================================================================= */
  const Model = (function () {

    function normalizeBase(value) {
      const raw = String(value == null ? '' : value).trim();
      if (!raw) return '';
      let parsed;
      try { parsed = new URL(raw); } catch (e) { throw new Error('not-a-url'); }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad-scheme');
      if (parsed.username || parsed.password) throw new Error('credentials-in-url');
      if (parsed.search || parsed.hash) throw new Error('not-a-base');
      const path = parsed.pathname.replace(/\/+$/, '');
      return parsed.origin + (path || '/v1');
    }

    /* The verification server can proxy a model with a key it holds itself
       (/v1/model). It is the default endpoint whenever the page is served over
       http(s) or points at a configured API, so chat works without a key. */
    const SERVER_MODEL_NAME = 'zai-org/glm-5.3';

    function serverBase() {
      const origin = Api.base() ||
        (window.location.protocol === 'http:' || window.location.protocol === 'https:' ? window.location.origin : '');
      if (!origin) return '';
      try { return normalizeBase(origin.replace(/\/+$/, '') + '/v1/model'); } catch (e) { return ''; }
    }

    function configured() {
      const settings = Store.state.settings;
      return Boolean(settings.modelBase && settings.modelName);
    }

    function endpoint() {
      return Store.state.settings.modelBase.replace(/\/+$/, '') + '/chat/completions';
    }

    function label() {
      const settings = Store.state.settings;
      return settings.modelName || t('model.noneSelected');
    }

    /* Reads an OpenAI-style SSE stream. Chunks can split anywhere, so a buffer
       keeps the tail until a newline arrives. */
    async function streamChat(messages, options) {
      const opts = options || {};
      const settings = Store.state.settings;
      const providerKey = Store.modelKey();

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };
      if (providerKey) headers.Authorization = 'Bearer ' + providerKey;
      if (settings.modelReferer) headers['HTTP-Referer'] = settings.modelReferer;
      if (settings.modelTitle) headers['X-Title'] = settings.modelTitle;

      const controller = new AbortController();
      const onAbort = function () { controller.abort(); };
      if (opts.signal) {
        if (opts.signal.aborted) controller.abort();
        else opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      let response;
      try {
        response = await window.fetch(endpoint(), {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: settings.modelName,
            messages: messages,
            stream: true,
            temperature: settings.temperature
          }),
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit'
        });
      } catch (err) {
        if (controller.signal.aborted) throw modelError('cancelled', t('modelError.cancelledRaw'));
        throw modelError('network', t('modelError.networkRaw', { base: settings.modelBase }));
      }

      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.text();
          detail = body.slice(0, 400);
        } catch (e) { /* the status alone will have to do */ }
        throw modelError('http_' + response.status,
          t('modelError.refusedRaw', { status: String(response.status) }),
          { httpStatus: response.status, detail: detail });
      }
      if (!response.body) throw modelError('no_stream', t('modelError.noStreamMsg'));

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });

          let newline = buffer.indexOf('\n');
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf('\n');
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { opts.onDone && opts.onDone(); return; }
            let parsed;
            try { parsed = JSON.parse(data); } catch (e) { continue; }
            const choice = parsed && parsed.choices && parsed.choices[0];
            const delta = choice && (choice.delta || choice.message);
            const text = delta && typeof delta.content === 'string' ? delta.content : '';
            if (text) opts.onText && opts.onText(text);
            if (parsed && parsed.error) {
              throw modelError('provider_error',
                String(parsed.error.message || t('modelError.providerMsg')));
            }
          }
        }
        opts.onDone && opts.onDone();
      } finally {
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
        try { reader.releaseLock(); } catch (e) { /* already released */ }
      }
    }

    function modelError(code, message, extra) {
      const err = new Error(message);
      err.isnad = Object.assign({ code: code, message: message }, extra || {});
      return err;
    }

    return {
      normalizeBase: normalizeBase,
      serverBase: serverBase,
      SERVER_MODEL_NAME: SERVER_MODEL_NAME,
      configured: configured,
      label: label,
      endpoint: endpoint,
      streamChat: streamChat
    };
  })();

  /* ==========================================================================
     6. STATUS TABLE AND ERROR COPY

     Nine textual-correspondence statuses. None is an authenticity grade, and
     the copy says so rather than leaving room to assume one.
     ======================================================================= */
  const STATUS_TONES = {
    exact_match: 'positive',
    normalized_match: 'positive',
    partial_match: 'caution',
    mismatch_at_cited_reference: 'negative',
    quote_found_wrong_reference: 'caution',
    reference_found_without_quote: 'info',
    not_found_in_checked_corpus: 'negative',
    ambiguous_multiple_matches: 'caution',
    unsupported_source_or_language: 'info'
  };

  /* Label and meaning come from the catalog, in the reader's language. An
     unknown status is shown as its raw value with a warning, never guessed. */
  function statusInfo(status) {
    if (Object.prototype.hasOwnProperty.call(STATUS_TONES, status)) {
      return {
        label: t('status.' + status + '.label'),
        meaning: t('status.' + status + '.meaning'),
        tone: STATUS_TONES[status]
      };
    }
    return {
      label: String(status || t('status.unknown.label')), tone: 'info',
      meaning: t('status.unknown.meaning')
    };
  }

  function hasNoApiOrigin() {
    return !Api.base() && window.location.protocol === 'file:';
  }

  function describeError(err) {
    const e = (err && err.isnad) || { code: 'unknown', message: String(err && err.message || err) };
    const base = Api.describeBase();

    switch (e.code) {
      case 'cancelled':
        return { title: t('error.cancelled'), tone: 'cancelled', message: t('error.cancelledMsg') };
      case 'timeout':
        return { title: t('error.timeout'), tone: 'error', message: t('error.timeoutMsg', { base: base }) };
      case 'network':
        if (hasNoApiOrigin()) {
          return { title: t('error.noApi'), tone: 'error', message: t('error.noApiMsg') };
        }
        return { title: t('error.unreachable'), tone: 'error', message: t('error.unreachableMsg', { base: base }) };
      case 'source_unavailable':
        return {
          title: t('error.sourceUnavailable'), tone: 'error',
          message: t('error.sourceUnavailableMsg') +
            (e.retryAfter ? t('error.retryAfter', { n: Number(e.retryAfter) || e.retryAfter }) : ''),
          detail: t('error.sourceUnavailableDetail')
        };
      case 'validation_error':
      case 'invalid_reference':
      case 'unsupported_source':
      case 'unsupported_language':
        return {
          title: t('error.rejected'), tone: 'error',
          message: e.message || t('error.rejectedMsg'),
          detail: e.details && e.details.length
            ? t('error.fields', { fields: e.details.map(function (d) {
                return (d.location || []).join('.') + (d.code ? ' (' + d.code + ')' : '');
              }).join(', ') })
            : ''
        };
      case 'rate_limited':
        return {
          title: t('error.rateLimited'), tone: 'error',
          message: t('error.rateLimitedMsg') +
            (e.retryAfter ? t('error.retryAfterShort', { n: Number(e.retryAfter) || e.retryAfter }) : '')
        };
      case 'invalid_response':
        return { title: t('error.invalidResponse'), tone: 'error', message: t('error.invalidResponseMsg') };
      default:
        return {
          title: t('error.verifyFailed'), tone: 'error',
          message: e.message || t('error.verifyFailedMsg'),
          detail: [e.httpStatus ? 'HTTP ' + e.httpStatus : '', e.code ? t('error.code', { code: e.code }) : '']
            .filter(Boolean).join(' · ')
        };
    }
  }

  function describeModelError(err) {
    const e = (err && err.isnad) || { code: 'unknown', message: String(err && err.message || err) };
    const settings = Store.state.settings;
    switch (e.code) {
      case 'cancelled':
        return { title: t('modelError.stopped'), tone: 'cancelled', message: t('modelError.stoppedMsg') };
      case 'network':
        return {
          title: t('modelError.unreachable'), tone: 'error',
          message: t('modelError.unreachableMsg', { base: settings.modelBase || t('modelError.theEndpoint') })
        };
      case 'http_401':
      case 'http_403':
        return { title: t('modelError.badKey'), tone: 'error', message: t('modelError.badKeyMsg', { status: String(e.httpStatus) }) };
      case 'http_429':
        return { title: t('modelError.rateLimited'), tone: 'error', message: t('modelError.rateLimitedMsg') };
      case 'no_stream':
        return { title: t('modelError.noStream'), tone: 'error', message: t('modelError.noStreamMsg') };
      case 'provider_error':
        return { title: t('modelError.provider'), tone: 'error', message: e.message };
      default:
        return {
          title: t('modelError.failed'), tone: 'error',
          message: e.message || t('modelError.failedMsg'),
          detail: [e.httpStatus ? 'HTTP ' + e.httpStatus : '', e.detail || ''].filter(Boolean).join(' — ')
        };
    }
  }

  /* ==========================================================================
     7. STORE
     ======================================================================= */
  const Store = (function () {

    const LIMITS = { chats: 40, items: 120 };

    const state = {
      chats: [],
      activeId: null,
      query: '',
      mode: 'chat',
      theme: document.documentElement.getAttribute('data-theme') || 'light',
      settings: {
        apiBase: '',
        modelBase: '',
        modelName: '',
        modelRememberKey: false,
        temperature: 0.3,
        numerals: 'arab',
        calendar: 'gregory',
        showTimestamps: true
      },
      running: { active: false, controller: null },
      capabilities: null,
      ready: null,
      systemPrompt: null,
      apiState: 'checking'
    };

    /* The key lives here and nowhere else unless the user opts in. It is never
       written into a conversation, an export, or a log line. */
    let modelKey = '';

    const listeners = [];
    function emit() {
      listeners.forEach(function (fn) {
        try { fn(state); } catch (e) { /* one broken listener must not stop the rest */ }
      });
    }
    function subscribe(fn) {
      listeners.push(fn);
      return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }

    function chat(id) { return state.chats.find(function (c) { return c.id === id; }) || null; }
    function active() { return chat(state.activeId); }
    function item(chatId, itemId) {
      const record = chat(chatId);
      return record ? (record.items.find(function (m) { return m.id === itemId; }) || null) : null;
    }

    function createChat() {
      /* An untitled chat stores no title; the name shown is the catalog's, in
         whichever language the reader has chosen at the time. */
      const record = {
        id: uid(), title: '', items: [], createdAt: Date.now(), updatedAt: Date.now()
      };
      state.chats.unshift(record);
      state.activeId = record.id;
      emit();
      return record;
    }

    function selectChat(id) { if (chat(id)) { state.activeId = id; emit(); } }

    function deleteChat(id) {
      const idx = state.chats.findIndex(function (c) { return c.id === id; });
      if (idx < 0) return;
      state.chats.splice(idx, 1);
      if (state.activeId === id) state.activeId = state.chats.length ? state.chats[0].id : null;
      if (!state.chats.length) createChat(); else emit();
    }

    function renameChat(id, title) {
      const record = chat(id);
      if (!record) return;
      const next = String(title || '').trim();
      if (!next) return;
      record.title = next;
      record.updatedAt = Date.now();
      emit();
    }

    function addItem(chatId, entry) {
      const record = chat(chatId);
      if (!record) return null;
      const created = Object.assign({ id: uid(), createdAt: Date.now() }, entry);
      record.items.push(created);
      record.updatedAt = Date.now();
      emit();
      return created;
    }

    function updateItem(chatId, itemId, patch) {
      const existing = item(chatId, itemId);
      if (!existing) return;
      Object.assign(existing, patch);
      const record = chat(chatId);
      if (record) record.updatedAt = Date.now();
      emit();
    }

    function removeItem(chatId, itemId) {
      const record = chat(chatId);
      if (!record) return;
      const idx = record.items.findIndex(function (m) { return m.id === itemId; });
      if (idx >= 0) { record.items.splice(idx, 1); emit(); }
    }

    function appendToItem(chatId, itemId, text) {
      const existing = item(chatId, itemId);
      if (!existing) return;
      existing.text = (existing.text || '') + text;
      const record = chat(chatId);
      if (record) record.updatedAt = Date.now();
      emit();
    }

    function truncateAfter(chatId, itemId) {
      const record = chat(chatId);
      if (!record) return;
      const idx = record.items.findIndex(function (m) { return m.id === itemId; });
      if (idx >= 0) { record.items.length = idx + 1; emit(); }
    }

    function setQuery(q) { state.query = q; emit(); }
    function setTheme(t) { state.theme = t; emit(); }
    function setMode(mode) { state.mode = mode === 'verify' ? 'verify' : 'chat'; emit(); }
    function setSettings(patch) { Object.assign(state.settings, patch); emit(); }
    function setRunning(active_, controller) {
      state.running.active = !!active_;
      state.running.controller = controller || null;
      emit();
    }
    function setApiState(next, capabilities, ready, prompt) {
      state.apiState = next;
      if (capabilities !== undefined) state.capabilities = capabilities;
      if (ready !== undefined) state.ready = ready;
      if (prompt !== undefined) state.systemPrompt = prompt;
      emit();
    }

    function modelKeyValue() { return modelKey; }
    function setModelKey(value, remember) {
      modelKey = value || '';
      if (remember) storage.set('isnad.gui.modelkey.v1', modelKey);
      else storage.remove('isnad.gui.modelkey.v1');
    }

    const KEY = 'isnad.gui.state.v2';
    const SETTINGS_KEY = 'isnad.gui.settings.v2';
    const LEGACY_SETTINGS_KEY = 'isnad.gui.settings.v1';

    function load() {
      const saved = storage.get(KEY, null);
      if (saved && Array.isArray(saved.chats) && saved.chats.length) {
        state.chats = saved.chats;
        state.activeId = saved.activeId && saved.chats.some(function (c) { return c.id === saved.activeId; })
          ? saved.activeId : saved.chats[0].id;
      } else {
        const record = { id: uid(), title: '', items: [], createdAt: Date.now(), updatedAt: Date.now() };
        state.chats = [record];
        state.activeId = record.id;
      }

      /* Settings written by the previous build are read once, field by field,
         so an upgrade does not silently reset a working setup. Its chat log is
         deliberately not imported: those items were shaped for the previous
         renderer, and re-interpreting them risks showing a result card without
         the report that backs it. */
      const savedSettings = storage.get(SETTINGS_KEY, null) || storage.get(LEGACY_SETTINGS_KEY, null);
      if (savedSettings && typeof savedSettings === 'object') {
        try { state.settings.apiBase = Api.normalizeBase(savedSettings.apiBase); } catch (e) { state.settings.apiBase = ''; }
        try { state.settings.modelBase = Model.normalizeBase(savedSettings.modelBase); } catch (e) { state.settings.modelBase = ''; }
        if (typeof savedSettings.modelName === 'string') state.settings.modelName = savedSettings.modelName.slice(0, 120);
        if (typeof savedSettings.temperature === 'number') state.settings.temperature = Math.min(2, Math.max(0, savedSettings.temperature));
        if (savedSettings.numerals === 'arab' || savedSettings.numerals === 'latn') state.settings.numerals = savedSettings.numerals;
        if (savedSettings.calendar === 'gregory' || savedSettings.calendar === 'islamic-umalqura') state.settings.calendar = savedSettings.calendar;
        if (typeof savedSettings.showTimestamps === 'boolean') state.settings.showTimestamps = savedSettings.showTimestamps;
        state.settings.modelRememberKey = savedSettings.modelRememberKey === true;
      }
      if (!state.settings.modelBase) {
        state.settings.modelBase = Model.serverBase();
        if (state.settings.modelBase && !state.settings.modelName) state.settings.modelName = Model.SERVER_MODEL_NAME;
      }
      const remembered = storage.get('isnad.gui.modelkey.v1', '');
      if (state.settings.modelRememberKey && typeof remembered === 'string') modelKey = remembered;
      if (saved && (saved.mode === 'chat' || saved.mode === 'verify')) state.mode = saved.mode;
    }

    /* Written field by field: a new field has to be added here deliberately or
       it will not survive a reload. The api key is stored separately, and only
       when the user asked for it. */
    function serializableItem(m) {
      return {
        id: m.id,
        kind: m.kind,
        createdAt: m.createdAt,
        status: m.status || null,
        role: m.role || null,
        text: m.text || null,
        request: m.request || null,
        report: m.report || null,
        citations: m.citations || null,
        parts: m.parts || null,
        error: m.error || null,
        model: m.model || null,
        durationMs: typeof m.durationMs === 'number' ? m.durationMs : null,
        statsData: m.statsData || null,
        promptTokens: typeof m.tokens === 'number' ? m.tokens : null
      };
    }

    function persist() {
      storage.set(SETTINGS_KEY, state.settings);

      let chats = state.chats.slice(0, LIMITS.chats);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const ok = storage.set(KEY, {
          activeId: state.activeId,
          mode: state.mode,
          chats: chats.map(function (c) {
            return {
              id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt,
              items: c.items.slice(-LIMITS.items).map(serializableItem)
            };
          })
        });
        if (ok) return true;
        if (chats.length <= 1) { storage.remove(KEY); return false; }
        chats = chats.slice(0, Math.max(1, Math.ceil(chats.length / 2)));
      }
      return false;
    }

    return {
      state: state, subscribe: subscribe, emit: emit,
      chat: chat, active: active, item: item,
      createChat: createChat, selectChat: selectChat, deleteChat: deleteChat,
      renameChat: renameChat, addItem: addItem, updateItem: updateItem,
      removeItem: removeItem, appendToItem: appendToItem, truncateAfter: truncateAfter,
      setQuery: setQuery, setTheme: setTheme, setMode: setMode, setSettings: setSettings,
      setRunning: setRunning, setApiState: setApiState,
      modelKey: modelKeyValue, setModelKey: setModelKey,
      load: load, persist: persist
    };
  })();

  /* ==========================================================================
     8. RESULT AND ERROR CARDS
     ======================================================================= */

  function termValue(term, valueHtml, options) {
    const opts = options || {};
    return '<dt class="result__term">' + escapeHtml(term) + '</dt>' +
      '<dd class="result__value' + (opts.pending ? ' result__value--pending' : '') + '">' +
      valueHtml + '</dd>';
  }

  function quotedSpan(text) {
    return '<span dir="auto">' + escapeHtml(text) + '</span>';
  }

  function pendingSpan(key) {
    return '<span class="result__value--pending">' + escapeHtml(t(key)) + '</span>';
  }

  function escapedLinkOrText(text, href) {
    const label = escapeHtml(text || t('result.unnamedSource'));
    if (!href || !/^https?:\/\//.test(href)) return label;
    return '<a class="evidence__link" href="' + escapeHtml(href) + '" target="_blank" ' +
      'rel="noopener noreferrer nofollow">' + label + '</a>';
  }

  /* The API may localise a source's name (display_name); the pinned edition
     name is the fallback and is what the checksum belongs to. */
  function sourceName(meta) {
    return (meta && (meta.display_name || meta.name)) || '';
  }

  function sourceLine(meta) {
    if (!meta) return pendingSpan('result.notReported');
    return [
      escapedLinkOrText(sourceName(meta), meta.url),
      meta.version ? versionHtml(meta.version) : '',
      meta.license ? '<span dir="auto">' + escapeHtml(meta.license) + '</span>' : '',
      meta.content_sha256 ? refHtml('sha256 ' + shortHash(meta.content_sha256)) : ''
    ].filter(Boolean).join(' · ');
  }

  /* The ayah number after a Qur'anic verse, drawn as the end-of-ayah sign the
     mushaf uses. It sits outside the source text and is not copied with it. */
  function ayahMark(reference) {
    const match = /^\d{1,3}:(\d{1,3})$/.exec(String(reference || '').trim());
    if (!match) return '';
    const digits = match[1].replace(/\d/g, function (d) { return String.fromCharCode(0x0660 + Number(d)); });
    return '<span class="ayah-mark" aria-hidden="true">۝' + digits + '</span>';
  }

  function renderEvidence(evidence, report) {
    const arabic = report && report.language === 'ar';
    const quran = report && report.sourceType === 'quran';
    const parts = [];
    parts.push('<div class="evidence__head">' +
      '<span class="evidence__ref" dir="ltr">' + escapeHtml(evidence.reference || t('evidence.unknownRef')) + '</span>' +
      '<span class="evidence__source">' +
        escapedLinkOrText(evidence.source_id, evidence.source_url) +
        (evidence.source_version ? ' · ' + versionHtml(evidence.source_version) : '') +
      '</span>' +
    '</div>');

    /* Arabic source text is set as in a mushaf: the Qur'anic face, centred,
       framed. The text itself is the source's, byte for byte. */
    parts.push('<p class="evidence__text' + (arabic ? ' evidence__text--scripture' : '') + '"' +
      (arabic ? ' lang="ar" dir="rtl"' : ' dir="auto"') + '>' +
      '<span class="evidence__words">' + escapeHtml(evidence.source_text || '') + '</span>' +
      (arabic && quran ? ayahMark(evidence.reference) : '') + '</p>');

    if (evidence.matched_fragment) {
      parts.push('<p class="evidence__fragment" dir="auto">' + escapeHtml(t('evidence.fragment')) +
        '<span dir="auto">' + escapeHtml(evidence.matched_fragment) + '</span></p>');
    }

    const rows = [];
    const row = function (labelKey, value, asLink) {
      if (!value) return;
      rows.push('<dt>' + escapeHtml(t(labelKey)) + '</dt><dd>' +
        (asLink
          ? escapedLinkOrText(t('evidence.openRecord'), value)
          : '<span dir="auto">' + escapeHtml(value) + '</span>') +
      '</dd>');
    };
    row('evidence.recordTitle', evidence.record_title);
    row('evidence.attribution', evidence.attribution_text);
    row('evidence.bibliographic', evidence.bibliographic_reference);
    row('evidence.grade', evidence.grade_text);
    row('evidence.gradeSource', evidence.grade_source);
    row('evidence.gradedBy', evidence.graded_by);
    row('evidence.footnotes', evidence.footnotes);
    row('evidence.sourceRecord', evidence.source_url, true);

    if (rows.length) parts.push('<dl class="evidence__meta">' + rows.join('') + '</dl>');

    if (!evidence.grade_text && !evidence.graded_by && !evidence.grade_source) {
      parts.push('<p class="grade-note">' + escapeHtml(t('evidence.noGrade')) + '</p>');
    }

    return '<div class="evidence">' + parts.join('') + '</div>';
  }

  function diffKindLabel(kind) {
    const key = 'diff.kind.' + kind;
    const label = t(key);
    return label === key ? humanizeToken(kind || t('diff.difference')) : label;
  }

  function renderDifferences(diffs) {
    return '<div class="diff">' + diffs.map(function (d) {
      return '<div class="diff__row">' +
        '<span class="diff__kind">' + escapeHtml(diffKindLabel(d.kind)) + '</span>' +
        '<div class="diff__pair">' +
          '<span class="diff__text" data-side="submitted">' + escapeHtml(t('diff.submitted')) +
            '<span dir="auto">' + escapeHtml(d.submitted_text || '—') + '</span></span>' +
          '<span class="diff__text" data-side="source">' + escapeHtml(t('diff.source')) +
            '<span dir="auto">' + escapeHtml(d.source_text || '—') + '</span></span>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* The report card: shared by model citations and by hand verification. */
  function renderReportCard(report, options) {
    const opts = options || {};
    const info = statusInfo(report.status);
    const meta = report.sourceMetadata;

    const flags = [];
    if (report.evidenceTruncated) {
      flags.push('<span class="connection-badge" data-state="checking">' + escapeHtml(t('result.partialCoverage')) + '</span>');
    }
    if (typeof report.candidateCount === 'number' && report.candidateCount > 0) {
      flags.push('<span class="connection-badge">' + escapeHtml(t('result.candidates', { n: report.candidateCount })) + '</span>');
    }

    const metaLine = [
      opts.heading ? escapeHtml(opts.heading) : '',
      escapeHtml(sourceLabel(report.sourceType)),
      escapeHtml(languageLabel(report.language)),
      meta && meta.version ? escapeHtml(sourceName(meta)) + ' ' + versionHtml(meta.version) : '',
      escapeHtml(formatDuration(opts.durationMs))
    ].filter(Boolean).join(' · ');

    const rows = [];
    rows.push(termValue(t('result.quotedText'),
      report.submittedQuote ? quotedSpan(report.submittedQuote) : pendingSpan('result.noQuote')));
    rows.push(termValue(t('result.citedRef'),
      report.citedReference ? refHtml(report.citedReference) : pendingSpan('result.noRef')));
    rows.push(termValue(t('result.matchedRefs'), report.matchedReferences && report.matchedReferences.length
      ? report.matchedReferences.map(refHtml).join('، ')
      : pendingSpan('result.noneForStatus')));
    rows.push(termValue(t('result.source'), sourceLine(meta)));
    if (meta && meta.coverage_note) rows.push(termValue(t('result.coverage'), quotedSpan(meta.coverage_note)));

    const body = [];
    body.push('<p class="result__explanation">' + escapeHtml(info.meaning) + '</p>');
    if (report.explanation) {
      body.push('<div class="result__note rich" dir="auto">' + MD.render(report.explanation) + '</div>');
    }
    if (flags.length) body.push('<div class="result__flags">' + flags.join('') + '</div>');

    if (report.evidence && report.evidence.length) {
      body.push('<div>' + report.evidence.map(function (e) { return renderEvidence(e, report); }).join('') + '</div>');
    } else {
      body.push('<p class="result__note">' + escapeHtml(t('result.noEvidence')) + '</p>');
    }

    body.push('<dl class="result__grid">' + rows.join('') + '</dl>');

    if (report.wordingDifferences && report.wordingDifferences.length) {
      body.push('<div><p class="result__note">' + escapeHtml(t('result.differences')) + '</p>' +
        renderDifferences(report.wordingDifferences) + '</div>');
    }

    return '<div class="result" data-tone="' + escapeHtml(info.tone) + '">' +
      '<div class="result__head">' +
        '<span class="result__status">' + escapeHtml(info.label) +
          ' <code dir="ltr">' + escapeHtml(report.status) + '</code></span>' +
        '<span class="result__badge">' + metaLine + '</span>' +
      '</div>' +
      '<div class="result__body">' + body.join('') + '</div>' +
    '</div>';
  }

  function renderErrorCard(error, badgeText) {
    const cancelled = error.tone === 'cancelled';
    return '<div class="result ' + (cancelled ? '' : 'result--error') + '" data-tone="' + escapeHtml(error.tone) + '">' +
      '<div class="result__head">' +
        '<span class="result__status">' + escapeHtml(error.title) + '</span>' +
        (badgeText ? '<span class="result__badge">' + escapeHtml(badgeText) + '</span>' : '') +
      '</div>' +
      '<div class="result__body">' +
        '<p class="result__explanation">' + escapeHtml(error.message) + '</p>' +
        (error.detail ? '<p class="result__note error-code">' + escapeHtml(error.detail) + '</p>' : '') +
        '<p class="result__note">' + escapeHtml(t('error.nothingDecided')) + '</p>' +
      '</div>' +
    '</div>';
  }

  /* The source-check loader: the octagram traced stroke by stroke. */
  function checkingHtml(text) {
    return '<div class="checking" role="status">' +
      '<svg class="loader-star" aria-hidden="true"><use href="#ic-octagram"/></svg>' +
      '<span class="checking__text">' + escapeHtml(text) + '</span>' +
    '</div>';
  }

  /* ==========================================================================
     9. CHAT ITEMS
     ======================================================================= */

  /* A citation card always has the same spine: the status, the source wording,
     then the verification detail. A pending card says only that a check is
     running — it never shows the model's version of the quote. */
  function citationCardHtml(citation) {
    const reference = citation.header.reference ||
      (citation.report && citation.report.citedReference) || '';
    const refPart = reference
      ? '<span class="citation__ref" dir="ltr">' + escapeHtml(reference) + '</span>'
      : '<span class="citation__ref citation__ref--none">' + escapeHtml(t('citation.noRef')) + '</span>';

    if (citation.state === 'checking') {
      return '<div class="citation citation--checking" role="status">' +
        '<div class="citation__head">' +
          '<span class="citation__kind">' + escapeHtml(t('citation.kind')) + '</span>' + refPart +
          '<span class="citation__state">' + escapeHtml(t('citation.checking')) + '</span>' +
        '</div>' +
        '<div class="citation__body">' + checkingHtml(t('citation.holding')) + '</div>' +
      '</div>';
    }

    if (citation.state === 'error') {
      return '<div class="citation citation--error">' +
        '<div class="citation__head">' +
          '<span class="citation__kind">' + escapeHtml(t('citation.kind')) + '</span>' + refPart +
          '<span class="citation__state">' + escapeHtml(t('citation.notChecked')) + '</span>' +
        '</div>' +
        '<div class="citation__body">' + renderErrorCard(citation.error) + '</div>' +
      '</div>';
    }

    const info = statusInfo(citation.report.status);
    return '<div class="citation" data-tone="' + escapeHtml(info.tone) + '">' +
      '<div class="citation__head">' +
        '<span class="citation__kind">' + escapeHtml(t('citation.kind')) + '</span>' + refPart +
        '<span class="citation__state">' + escapeHtml(info.label) + '</span>' +
      '</div>' +
      '<div class="citation__body">' + renderReportCard(citation.report, { durationMs: citation.durationMs }) + '</div>' +
    '</div>';
  }

  function renderUserItem(entry) {
    return '<p class="rich" dir="auto" style="margin:0;white-space:pre-wrap">' + escapeHtml(entry.text || '') + '</p>';
  }

  function renderVerifyResultItem(entry) {
    if (entry.kind === 'error') {
      return renderErrorCard(entry.error,
        (entry.request ? sourceLabel(entry.request.source_type) + ' · ' + formatDuration(entry.durationMs) : ''));
    }
    if (entry.kind === 'pending') {
      const request = entry.request || {};
      return '<div class="result" data-tone="info">' +
        '<div class="result__head">' +
          '<span class="result__status">' + escapeHtml(t('result.checking')) + '</span>' +
          '<span class="result__badge">' + escapeHtml(sourceLabel(request.source_type) + ' · ' + languageLabel(request.language)) + '</span>' +
        '</div>' +
        '<div class="result__body">' + checkingHtml(t('result.waitingApi', { base: Api.describeBase() })) + '</div>' +
      '</div>';
    }
    if (entry.kind === 'request') {
      const request = entry.request || {};
      const facts = [
        escapeHtml(sourceLabel(request.source_type)),
        escapeHtml(languageLabel(request.language)),
        request.reference
          ? escapeHtml(t('result.reference', { ref: '\u0000' })).replace('\u0000', refHtml(request.reference))
          : escapeHtml(t('result.noReference'))
      ].join(' · ');
      return '<p class="rich" dir="auto" style="margin:0;white-space:pre-wrap">' +
          escapeHtml(request.quote || t('result.referenceOnly')) + '</p>' +
        '<p class="result__note" style="margin:var(--space-2) 0 0">' + facts + '</p>';
    }
    return renderReportCard(entry.report, { durationMs: entry.durationMs });
  }

  /* A message is a sequence of parts: the prose the model wrote, and one entry
     for each marked quotation, in that order. Rendering follows the sequence, so
     a card stands where the quotation was rather than in a block at the foot of
     the answer. Messages saved before this existed carry text and citations
     only, so their parts are derived the old way. */
  function entryParts(entry) {
    if (Array.isArray(entry.parts) && entry.parts.length) return entry.parts;
    const parts = [];
    if (entry.text) parts.push({ kind: 'prose', text: entry.text });
    (entry.citations || []).forEach(function (citation) {
      parts.push({ kind: 'citation', id: citation.id });
    });
    return parts;
  }

  function assistantContentHtml(entry) {
    const parts = [];
    if (entry.kind === 'assistant' || entry.kind === 'streaming') {
      let citationIndex = 0;
      entryParts(entry).forEach(function (part, index) {
        if (part.kind === 'citation') {
          parts.push('<div class="citation-slot" data-part="' + index + '"' +
            ' data-citation-id="' + escapeHtml(String(part.id == null ? citationIndex : part.id)) + '"' +
            ' data-citation-index="' + citationIndex + '"></div>');
          citationIndex += 1;
        } else {
          parts.push('<div class="rich" data-rich data-part="' + index + '"></div>');
        }
      });
    }
    if (entry.kind === 'error') {
      parts.push(renderErrorCard(entry.error, formatDuration(entry.durationMs)));
    }
    if (entry.kind === 'notice') {
      parts.push('<p class="msg__notice">' + escapeHtml(entry.text || '') + '</p>');
    }
    return parts.join('');
  }

  function itemElement(entry, chatId) {
    const article = document.createElement('article');
    const isUser = entry.role === 'user';
    article.className = 'msg msg--' + (isUser ? 'user' : 'assistant');
    if (entry.kind === 'pending' || entry.kind === 'streaming') article.classList.add('msg--streaming');
    article.dataset.itemId = entry.id;
    article.id = 'm-' + entry.id;

    const meta = ['<span class="msg__who">' + escapeHtml(isUser ? t('msg.you') : t('msg.isnad')) + '</span>'];
    if (Store.state.settings.showTimestamps && entry.createdAt) {
      meta.push('<time class="msg__time" datetime="' + new Date(entry.createdAt).toISOString() + '">' +
        formatTime(entry.createdAt) + '</time>');
    }
    if (!isUser && entry.kind === 'assistant' && entry.model) {
      meta.push('<span class="msg__model">' + escapeHtml(entry.model) + '</span>');
    }

    let content = '';
    if (isUser) {
      content = renderUserItem(entry);
    } else if (entry.role === 'tool') {
      /* A manual check has its own pending and error panels. Only the model's
         placeholder item shows the typing dots. */
      content = renderVerifyResultItem(entry);
    } else if (entry.kind === 'pending') {
      content = '<div class="typing" role="status" aria-label="' + escapeHtml(t('msg.waiting')) + '">' +
        '<span class="typing__dot"></span><span class="typing__dot"></span><span class="typing__dot"></span>' +
      '</div>';
    } else {
      content = assistantContentHtml(entry);
    }

    function action(act, labelKey, titleKey, iconId, pressed) {
      return '<button class="iconbtn iconbtn--xs" type="button" data-act="' + act + '"' +
        ' aria-label="' + escapeHtml(t(labelKey)) + '" title="' + escapeHtml(t(titleKey || labelKey)) + '"' +
        (pressed ? ' aria-pressed="true"' : '') + '>' + icon(iconId) + '</button>';
    }

    const actions = [];
    if (entry.kind === 'error' && entry.request) {
      actions.push(action('retry', 'msg.retry', null, 'ic-refresh'));
    }
    if (entry.kind === 'assistant' || entry.kind === 'streaming') {
      actions.push(action('copy', 'msg.copyReply', null, 'ic-copy'));
      actions.push(action('copymd', 'msg.copyMd', null, 'ic-markdown'));
      if (Speech.supported) actions.push(action('speak', 'msg.speak', null, 'ic-speak'));
      actions.push(action('link', 'msg.link', 'msg.linkShort', 'ic-anchor'));
      actions.push('<span class="msg__sep" aria-hidden="true"></span>');
      actions.push(action('regenerate', 'msg.regenerate', 'msg.regenerateShort', 'ic-refresh'));
      actions.push(action('up', 'msg.good', null, 'ic-thumb-up', entry.feedback === 'up'));
      actions.push(action('down', 'msg.poor', null, 'ic-thumb-down', entry.feedback === 'down'));
      actions.push(action('prompt', 'msg.prompt', 'msg.promptShort', 'ic-info'));
    }
    if (isUser) {
      actions.push(action('edit', 'msg.edit', null, 'ic-pencil'));
      actions.push(action('copy', 'msg.copyMessage', null, 'ic-copy'));
    }
    if (entry.kind !== 'pending') {
      actions.push('<span class="msg__sep" aria-hidden="true"></span>');
      actions.push(action('remove', 'msg.remove', 'msg.removeShort', 'ic-trash'));
    }

    article.innerHTML =
      '<span class="avatar avatar--md ' + (isUser ? 'avatar--user' : 'avatar--ai') + '" aria-hidden="true">' +
        '<svg><use href="#' + (isUser ? 'px-user' : 'px-spark') + '"/></svg>' +
      '</span>' +
      '<div class="msg__body">' +
        '<div class="msg__meta">' + meta.join('') + '</div>' +
        '<div class="msg__content">' + content + '</div>' +
        (entry.kind === 'assistant' && (entry.statsData || entry.stats)
          ? '<p class="msg__stats">' + escapeHtml(statsLine(entry)) + '</p>' : '') +
        (actions.length ? '<div class="msg__actions">' + actions.join('') + '</div>' : '') +
      '</div>';

    const parts = entryParts(entry);
    article.querySelectorAll('[data-part]').forEach(function (node) {
      if (!node.hasAttribute('data-rich')) return;
      const part = parts[Number(node.dataset.part)];
      Rich.paint(node, (part && part.text) || '');
    });
    article.querySelectorAll('.citation-slot').forEach(function (slot) {
      const citation = (entry.citations || [])[Number(slot.dataset.citationIndex)];
      if (citation) slot.innerHTML = citationCardHtml(citation);
    });

    article.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;

      if (act === 'copy') {
        copyText(plainTextOf(entry));
      } else if (act === 'copymd') {
        copyText(markdownOf(entry), t('copy.markdown'));
      } else if (act === 'speak') {
        if (Speech.isSpeaking(entry.id)) Speech.stop();
        else {
          Speech.speak(entry.id, plainTextOf(entry), btn, function () {
            btn.setAttribute('aria-pressed', 'false');
          });
          btn.setAttribute('aria-pressed', 'true');
        }
      } else if (act === 'link') {
        copyPermalink(entry.id);
      } else if (act === 'remove') {
        Store.removeItem(chatId, entry.id);
        Store.persist();
      } else if (act === 'regenerate') {
        regenerate(chatId, entry.id);
      } else if (act === 'up' || act === 'down') {
        const next = entry.feedback === act ? null : act;
        Store.updateItem(chatId, entry.id, { feedback: next });
        Store.persist();
        const row = btn.parentElement;
        $$('[data-act="up"], [data-act="down"]', row).forEach(function (b) {
          if (b.dataset.act === next) b.setAttribute('aria-pressed', 'true');
          else b.removeAttribute('aria-pressed');
        });
      } else if (act === 'edit') {
        editMessage(chatId, entry.id);
      } else if (act === 'retry') {
        if (entry.request) runVerifyFlow(chatId, entry.request, { afterItemId: entry.id });
      } else if (act === 'prompt') {
        openPromptDialog();
      }
    });

    return article;
  }

  /* Spoken and copied text carries the verified source wording and the match
     status together, because that is what the reader was shown: the model's
     unverified version of a quotation is never repeated as if it were a quote. */
  /* The line under a finished reply, rendered in the current language from
     the numbers saved with it. Replies saved before that carry a fixed line. */
  function statsLine(entry) {
    const data = entry.statsData;
    if (!data) return entry.stats || '';
    return [
      formatDuration(data.elapsedMs),
      t('msg.statsChecked', { n: data.checked || 0 }),
      data.failed ? t('msg.statsFailed', { n: data.failed }) : '',
      data.stopped ? t('msg.statsStopped') : ''
    ].filter(Boolean).join(' · ');
  }

  function plainTextOf(entry) {
    const parts = [];
    if (entry.text) parts.push(entry.text);
    (entry.citations || []).forEach(function (citation) {
      if (citation.state !== 'done' || !citation.report) {
        if (citation.state === 'error' && citation.error) {
          parts.push(t('citation.notCheckedPlain', { title: citation.error.title }));
        }
        return;
      }
      const reference = citation.report.matchedReferences[0] || citation.report.citedReference || '';
      const text = citation.report.evidence.length ? citation.report.evidence[0].source_text : '';
      const line = [text, statusInfo(citation.report.status).label].filter(Boolean).join(' — ');
      parts.push('[' + (reference || t('citation.kind')) + '] ' + line);
    });
    return parts.join('\n\n').trim();
  }

  function markdownOf(entry) {
    const parts = [];
    if (entry.text) parts.push(entry.text);
    (entry.citations || []).forEach(function (citation) {
      if (citation.state !== 'done' || !citation.report) return;
      const report = citation.report;
      parts.push('> ' + (report.matchedReferences[0] || report.citedReference || t('verify.reference')));
      if (report.evidence.length) parts.push('> ' + report.evidence[0].source_text);
      parts.push('>');
      parts.push('> ' + t('msg.statusLine') + ': `' + report.status + '` — ' + statusInfo(report.status).meaning);
      if (report.evidence.length && report.evidence[0].grade_text) {
        parts.push('> ' + t('msg.gradeAsSupplied') + ': ' + report.evidence[0].grade_text +
          (report.evidence[0].grade_source ? ' (' + report.evidence[0].grade_source + ')' : ''));
      }
    });
    return parts.join('\n\n').trim();
  }

  const Speech = (function () {
    const supported = typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function';
    let current = null;

    function stop() {
      if (!supported) return;
      const previous = current;
      current = null;
      if (previous && previous.button) previous.button.setAttribute('aria-pressed', 'false');
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }

    function speak(msgId, text, button, onEnd) {
      if (!supported) return;
      stop();
      const plain = String(text || '')
        .replace(/```[\s\S]*?```/g, ' code block ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^[#>\-*\s]+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      if (!plain) return;
      const utterance = new window.SpeechSynthesisUtterance(plain);
      utterance.lang = /[\u0600-\u06FF]/.test(plain) ? 'ar' : 'en';
      utterance.onend = function () { if (current && current.msgId === msgId) stop(); else if (onEnd) onEnd(); };
      utterance.onerror = function () { if (current && current.msgId === msgId) stop(); else if (onEnd) onEnd(); };
      current = { msgId: msgId, button: button || null };
      try { window.speechSynthesis.speak(utterance); } catch (e) { stop(); }
    }

    function isSpeaking(msgId) {
      return !!current && (msgId === undefined || current.msgId === msgId);
    }

    return { supported: supported, speak: speak, stop: stop, isSpeaking: isSpeaking };
  })();

  function copyText(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { Toasts.show(message || t('copy.copied'), 'success'); },
        function () { Toasts.show(t('copy.failed'), 'error'); }
      );
    } else {
      Toasts.show(t('copy.unavailable'), 'error');
    }
  }

  function copyPermalink(itemId) {
    try { window.history.replaceState(null, '', '#m-' + itemId); } catch (e) { /* file:// */ }
    copyText(window.location.href, t('copy.link'));
    highlightItem(itemId);
  }

  function highlightItem(itemId) {
    const node = document.getElementById('m-' + itemId);
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.remove('msg--target');
    void node.offsetWidth;
    node.classList.add('msg--target');
    window.setTimeout(function () { node.classList.remove('msg--target'); }, 2400);
  }

  /* ==========================================================================
     10. CHAT TRANSCRIPT
     ======================================================================= */

  function renderItems(options) {
    const opts = options || {};
    const container = $('#messages');
    const record = Store.active();
    container.innerHTML = '';

    if (Store.state.mode === 'verify') {
      renderVerifySurface(container, record);
      if (opts.scroll !== false) scrollToBottom(opts.instant === true);
      return;
    }

    if (!record || !record.items.length) {
      container.appendChild(emptyState());
      if (opts.scroll !== false) scrollToBottom(opts.instant === true);
      return;
    }

    record.items.forEach(function (entry) { container.appendChild(itemElement(entry, record.id)); });

    if (Store.state.running.active && Store.state.running.kind === 'chat') {
      const wrap = document.createElement('div');
      wrap.className = 'stoprow';
      const stopBtn = document.createElement('button');
      stopBtn.type = 'button';
      stopBtn.className = 'btn btn--ghost btn--sm';
      stopBtn.innerHTML = icon('ic-stop') + escapeHtml(t('composer.stopGenerating'));
      stopBtn.addEventListener('click', stopGeneration);
      wrap.appendChild(stopBtn);
      container.appendChild(wrap);
    }

    if (opts.scroll !== false) scrollToBottom(opts.instant === true);
  }

  /* Painting the streaming message only. The transcript container is left
     alone: rebuilding it on every token would drop the reader's scroll
     position and rerun every card in the conversation. */
  function patchStreamingItem(chatId, itemId) {
    const entry = Store.item(chatId, itemId);
    const article = document.querySelector('[data-item-id="' + itemId + '"]');
    if (!entry || !article) return false;

    const parts = entryParts(entry);
    const nodes = article.querySelectorAll('[data-part]');
    /* A new part changes the shape of the message, which the caller handles by
       rebuilding it; here only the streaming text and the cards are refreshed. */
    if (nodes.length !== parts.length) return false;

    nodes.forEach(function (node) {
      if (!node.hasAttribute('data-rich')) return;
      const part = parts[Number(node.dataset.part)];
      Rich.paint(node, (part && part.text) || '');
    });

    const citations = entry.citations || [];
    const slots = Array.prototype.slice.call(article.querySelectorAll('.citation-slot'));
    slots.forEach(function (slot) {
      const citation = citations[Number(slot.dataset.citationIndex)];
      if (!citation) return;
      if (slot.dataset.rendered === citation.state && slot.dataset.renderedRef === String(citation.header.reference)) return;
      slot.innerHTML = citationCardHtml(citation);
      slot.dataset.rendered = citation.state;
      slot.dataset.renderedRef = String(citation.header.reference);
    });
    return true;
  }

  /* ---- Empty states --------------------------------------------------- */

  function chatEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'empty';
    const configured = Model.configured();
    const ready = Store.state.apiState === 'ready';

    const prompts = Store.state.chatPrompts || [];

    wrap.innerHTML =
      '<span class="empty__medallion" aria-hidden="true">' + window.IsnadGeometry.medallion(200) + '</span>' +
      '<svg class="empty__mark" aria-hidden="true"><use href="#px-mark"/></svg>' +
      '<div>' +
        '<h2 class="empty__title">' + escapeHtml(configured ? t('empty.chatTitle') : t('empty.connectTitle')) + '</h2>' +
        '<p class="empty__sub">' + escapeHtml(configured ? t('empty.chatSub') : t('empty.connectSub')) + '</p>' +
      '</div>' +
      (ready ? '' : '<div class="empty__caps"><p class="empty__note">' +
        escapeHtml(hasNoApiOrigin() ? t('empty.fromDisk') : t('empty.apiDown')) +
        '</p></div>') +
      '<div class="suggestions" role="list"></div>';

    const grid = $('.suggestions', wrap);
    (prompts.length ? prompts : [
      { label: t('empty.suggestVerse'), text: t('empty.suggestVerseText') },
      { label: t('empty.suggestHadith'), text: t('empty.suggestHadithText') },
      { label: t('empty.suggestAsk'), text: t('empty.suggestAskText') }
    ]).forEach(function (prompt) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion';
      btn.setAttribute('role', 'listitem');
      btn.innerHTML = '<span class="suggestion__label">' + escapeHtml(prompt.label) + '</span>' +
        '<span class="suggestion__text">' + escapeHtml(prompt.text) + '</span>';
      btn.addEventListener('click', function () {
        if (!configured) { openSettings(); return; }
        const input = $('#composerInput');
        input.value = prompt.text;
        autoGrow(input);
        updateSendState();
        sendMessage();
      });
      grid.appendChild(btn);
    });

    return wrap;
  }

  const STATUS_ORDER = [
    'exact_match', 'normalized_match', 'partial_match', 'mismatch_at_cited_reference',
    'quote_found_wrong_reference', 'reference_found_without_quote',
    'not_found_in_checked_corpus', 'ambiguous_multiple_matches', 'unsupported_source_or_language'
  ];

  function verifyEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'empty';
    const caps = Store.state.capabilities;

    let capsHtml;
    if (Store.state.apiState === 'checking') {
      capsHtml = '<p class="empty__note">' +
        escapeHtml(t('empty.readingCaps', { path: '\u0000' })).replace('\u0000', '<code dir="ltr">/v1/capabilities</code>') + '</p>';
    } else if (!caps) {
      capsHtml = '<p class="empty__note">' + escapeHtml(hasNoApiOrigin() ? t('empty.capsFromDisk') : t('empty.capsDown')) + '</p>';
    } else {
      const rows = [];
      rows.push(termValue(t('empty.apiVersion'), refHtml(String(caps.api_version || t('api.unreported')))));
      rows.push(termValue(t('empty.statuses'), escapeHtml(t('empty.statusesValue', { n: (caps.statuses || []).length }))));
      rows.push(termValue(t('empty.quoteLimit'), escapeHtml(t('empty.quoteLimitValue', { n: quoteLimit() }))));
      if (caps.limits && caps.limits.max_websocket_message_bytes) {
        rows.push(termValue(t('empty.streaming'), escapeHtml(t('empty.streamingValue', {
          path: (caps.streaming && caps.streaming.path) || '/v1/stream',
          n: Math.round(caps.limits.max_websocket_message_bytes / 1024)
        }))));
      }
      capsHtml = '<dl class="result__grid">' + rows.join('') + '</dl>';
    }

    const statusRows = STATUS_ORDER.map(function (status) {
      const info = statusInfo(status);
      return termValue(info.label, escapeHtml(info.meaning) + '<br><code class="status-code" dir="ltr">' + escapeHtml(status) + '</code>');
    }).join('');

    wrap.innerHTML =
      '<span class="empty__medallion" aria-hidden="true">' + window.IsnadGeometry.medallion(200) + '</span>' +
      '<svg class="empty__mark" aria-hidden="true"><use href="#px-mark"/></svg>' +
      '<div>' +
        '<h2 class="empty__title">' + escapeHtml(t('empty.verifyTitle')) + '</h2>' +
        '<p class="empty__sub">' + escapeHtml(t('empty.verifySub')) + '</p>' +
      '</div>' +
      '<div class="empty__caps">' + capsHtml + '</div>' +
      '<details class="empty__caps guide">' +
        '<summary class="set-section__title">' + escapeHtml(t('empty.statusGuide')) + '</summary>' +
        '<dl class="result__grid" style="margin-top:var(--space-3)">' + statusRows + '</dl>' +
        '<p class="result__note">' + escapeHtml(t('empty.statusGuideNote')) + '</p>' +
      '</details>';

    if (caps && caps.sources && caps.sources.length) {
      const list = document.createElement('div');
      list.className = 'empty__caps';
      list.innerHTML = '<div class="guide">' +
        '<h3 class="set-section__title">' + escapeHtml(t('empty.supported')) + '</h3>' +
        '<dl class="result__grid">' + caps.sources.map(function (s) {
          return termValue(sourceLabel(s.source_type) + ' · ' + languageLabel(s.language),
            escapeHtml(s.display_name || s.name) + ' · ' + versionHtml(s.source_version) +
            '<br><span class="result__note">' + refHtml(s.reference_format || '') +
            (s.coverage_note ? ' — <span dir="auto">' + escapeHtml(s.coverage_note) + '</span>' : '') + '</span>');
        }).join('') + '</dl>' +
        (Store.state.ready && Store.state.ready.sources
          ? '<p class="result__note">' + escapeHtml(t('empty.readiness', { n: Store.state.ready.sources.length })) + '</p>'
          : '') +
      '</div>';
      wrap.appendChild(list);
    }

    return wrap;
  }

  function emptyState() {
    return Store.state.mode === 'verify' ? verifyEmptyState() : chatEmptyState();
  }

  /* The verify surface reuses the chat transcript: hand checks are items in the
     same conversation, so nothing needs a second history. */
  function renderVerifySurface(container, record) {
    const items = record ? record.items.filter(function (entry) {
      return entry.role === 'tool' || entry.kind === 'pending' || entry.kind === 'request' || entry.kind === 'error';
    }) : [];
    if (!items.length) {
      container.appendChild(verifyEmptyState());
      return;
    }
    items.forEach(function (entry) { container.appendChild(itemElement(entry, record.id)); });
  }

  /* ==========================================================================
     11. MESSAGE FLOW — model streaming with citation gating
     ======================================================================= */

  function quoteLimit() {
    const caps = Store.state.capabilities;
    return caps && caps.limits && caps.limits.max_quote_characters ? caps.limits.max_quote_characters : 4000;
  }

  function chatMessagesFor(record, upToIndex) {
    const messages = [];
    const prompt = Store.state.systemPrompt && Store.state.systemPrompt.prompt;
    if (prompt) messages.push({ role: 'system', content: prompt });

    const items = record.items.slice(0, upToIndex === undefined ? record.items.length : upToIndex);
    items.forEach(function (entry) {
      if (entry.role === 'user' && entry.kind !== 'pending') {
        messages.push({ role: 'user', content: entry.text || '' });
      } else if (entry.kind === 'assistant' && entry.text) {
        /* The assistant's own text is replayed exactly as written, markers
           included: the protocol is part of the conversation the model sees. */
        messages.push({ role: 'assistant', content: entry.text + citationSuffix(entry) });
      }
    });
    return messages;
  }

  function citationSuffix(entry) {
    return (entry.citations || []).map(function (citation) {
      return '\n\n[[ISNAD-CITATION source=' + citation.header.source +
        ' language=' + citation.header.language +
        (citation.header.reference ? ' reference=' + citation.header.reference : '') +
        ']]' + (citation.modelQuote || '') + '[[/ISNAD-CITATION]]';
    }).join('');
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  function updateSendState() {
    const input = $('#composerInput');
    const btn = $('#sendBtn');
    const text = input.value.trim();
    const busy = Store.state.running.active;
    const verifyMode = Store.state.mode === 'verify';

    if (verifyMode) {
      const request = readVerifyForm();
      const problem = validateVerifyRequest(request);
      btn.disabled = Boolean(problem) || busy;
      btn.title = problem ? problem.message : t('composer.verifyTitle');
    } else {
      const missing = !Model.configured();
      btn.disabled = busy || missing || !text;
      btn.title = missing ? t('composer.configureFirst') : t('composer.send');
    }
    btn.setAttribute('aria-disabled', String(btn.disabled));
  }

  function currentAbort() {
    return Store.state.running.controller;
  }

  function stopGeneration() {
    const controller = currentAbort();
    if (controller) controller.abort();
  }

  async function sendMessage() {
    if (Store.state.running.active) return;
    if (!Model.configured()) { openSettings(); return; }

    const input = $('#composerInput');
    const text = input.value.trim();
    if (!text) return;

    let record = Store.active();
    if (!record) record = Store.createChat();

    Store.addItem(record.id, { role: 'user', kind: 'message', text: text, status: 'complete' });

    if (record.items.filter(function (m) { return m.role === 'user'; }).length === 1) {
      Store.renameChat(record.id, text.length > 46 ? text.slice(0, 46).trim() + '…' : text);
    }

    input.value = '';
    autoGrow(input);
    updateSendState();
    Store.persist();

    await runAssistant(record.id);
  }

  async function runAssistant(chatId) {
    const record = Store.chat(chatId);
    if (!record) return;

    const controller = new AbortController();
    Store.setRunning(true, controller);
    Store.state.running.kind = 'chat';
    updateSendState();

    const placeholder = Store.addItem(chatId, {
      role: 'assistant', kind: 'pending', status: 'pending'
    });
    scrollToBottom();

    const streamer = window.IsnadCitationStream.createStreamer();
    const startedAt = Date.now();
    let text = '';
    let citations = [];
    let parts = [];

    /* Prose joins the current text part; each marked block starts a new part
       after it, so the message keeps the shape the model wrote. */
    function appendProse(chunk) {
      const last = parts.length ? parts[parts.length - 1] : null;
      if (last && last.kind === 'prose') last.text += chunk;
      else parts = parts.concat([{ kind: 'prose', text: chunk }]);
    }
    function appendCitationPart(id) {
      parts = parts.concat([{ kind: 'citation', id: id }]);
    }
    function streamingItem() {
      return {
        kind: 'streaming', status: 'streaming',
        text: text, citations: citations, parts: parts
      };
    }

    /* One block at a time: a new citation can only start after the previous
       one has been verified, so the cards keep their order. */
    let queue = Promise.resolve();

    function applyEvents(events) {
      events.forEach(function (event) {
        if (event.type === 'prose') {
          text += event.text;
          appendProse(event.text);
          Store.updateItem(chatId, placeholder.id, streamingItem());
        } else if (event.type === 'citation_start') {
          citations = citations.concat([{
            id: event.id,
            header: event.header,
            state: 'checking',
            report: null,
            error: null
          }]);
          appendCitationPart(event.id);
          Store.updateItem(chatId, placeholder.id, streamingItem());
        } else if (event.type === 'citation_end') {
          const pendingCitation = citations[citations.length - 1];
          if (!pendingCitation || pendingCitation.id !== event.id) return;
          pendingCitation.modelQuote = event.quote;
          pendingCitation.state = 'checking';
          Store.updateItem(chatId, placeholder.id, streamingItem());
          const snapshot = citations;
          const targetId = placeholder.id;
          queue = queue.then(function () {
            return verifyCitation(chatId, targetId, snapshot, pendingCitation, controller, startedAt);
          });
        } else if (event.type === 'citation_incomplete') {
          const note = t('citation.incompleteMsg', { n: Number(event.withheld_characters) || 0 });
          citations = citations.concat([{
            id: event.id,
            header: { source: 'unknown', language: 'unknown', reference: '' },
            state: 'error',
            error: { title: t('citation.incomplete'), tone: 'error', message: note, detail: '' }
          }]);
          appendCitationPart(event.id);
          Store.updateItem(chatId, placeholder.id, streamingItem());
        } else if (event.type === 'citation_invalid') {
          const reasons = {
            malformed_header: t('citation.malformed'),
            oversized_header: t('citation.oversized'),
            unterminated_header: t('citation.unterminated')
          };
          citations = citations.concat([{
            id: event.id || 0,
            header: { source: 'unknown', language: 'unknown', reference: '' },
            state: 'error',
            error: {
              title: t('citation.rejected'), tone: 'error',
              message: (reasons[event.reason] || t('citation.rejectedGeneric')) + t('citation.withheld'),
              detail: t('citation.reason', { reason: event.reason })
            }
          }]);
          appendCitationPart(event.id || 0);
          Store.updateItem(chatId, placeholder.id, streamingItem());
        }
      });
      patchStreamingItem(chatId, placeholder.id);
    }

    try {
      Store.updateItem(chatId, placeholder.id, {
        kind: 'streaming', status: 'streaming', text: '', citations: [], parts: [], model: Model.label()
      });

      const messages = chatMessagesFor(Store.chat(chatId), Store.chat(chatId).items.length - 1);
      await Model.streamChat(messages, {
        signal: controller.signal,
        onText: function (chunk) { applyEvents(streamer.push(chunk)); }
      });

      applyEvents(streamer.finish());
      await queue;

      const elapsed = Date.now() - startedAt;
      const checked = citations.filter(function (c) { return c.state === 'done'; }).length;
      const failed = citations.filter(function (c) { return c.state === 'error'; }).length;
      Store.updateItem(chatId, placeholder.id, {
        kind: 'assistant', status: 'complete', text: text, citations: citations,
        parts: parts, statsData: { elapsedMs: elapsed, checked: checked, failed: failed }
      });
    } catch (err) {
      applyEvents(streamer.finish());
      const described = describeModelError(err);
      if (described.tone === 'cancelled') {
        Store.updateItem(chatId, placeholder.id, {
          kind: 'assistant', status: 'complete', text: text, citations: citations,
          parts: parts,
          statsData: {
            elapsedMs: Date.now() - startedAt,
            checked: citations.filter(function (c) { return c.state === 'done'; }).length,
            failed: 0, stopped: true
          }
        });
      } else {
        Store.updateItem(chatId, placeholder.id, {
          kind: 'error', status: 'error', text: text, citations: citations, parts: parts,
          error: described, durationMs: Date.now() - startedAt
        });
        Toasts.show(described.title, 'error');
      }
    } finally {
      Store.setRunning(false);
      Store.state.running.kind = null;
      updateSendState();
      Store.persist();
      scrollToBottom();
    }
  }

  /* Verify one held quotation and fold the answer into the card. */
  async function verifyCitation(chatId, itemId, citations, citation, controller, startedAt) {
    const request = {
      source_type: citation.header.source,
      language: citation.header.language,
      quote: citation.modelQuote || null,
      reference: citation.header.reference || null
    };
    try {
      const result = await Api.verify(request, { signal: controller.signal });
      citation.state = 'done';
      citation.durationMs = result.durationMs;
      citation.report = normalizeReport(result.payload);
    } catch (err) {
      const described = describeError(err);
      citation.state = 'error';
      citation.error = described;
    }
    citation.modelQuote = citation.modelQuote || '';
    const current = Store.item(chatId, itemId);
    if (!current) return;
    Store.updateItem(chatId, itemId, {
      kind: 'streaming', status: 'streaming', text: current.text, citations: citations,
      parts: current.parts
    });
    patchStreamingItem(chatId, itemId);
  }

  function normalizeReport(payload) {
    return {
      status: payload.status,
      sourceType: payload.source_type,
      language: payload.language,
      sourceMetadata: payload.source_metadata || null,
      submittedQuote: payload.submitted_quote || null,
      citedReference: payload.cited_reference || null,
      matchedReferences: payload.matched_references || [],
      evidence: (payload.evidence || []).map(function (e) {
        return {
          reference: e.reference, source_text: e.source_text, matched_fragment: e.matched_fragment,
          source_id: e.source_id, source_version: e.source_version, source_url: e.source_url,
          footnotes: e.footnotes, record_title: e.record_title, attribution_text: e.attribution_text,
          grade_text: e.grade_text, grade_source: e.grade_source, graded_by: e.graded_by,
          bibliographic_reference: e.bibliographic_reference
        };
      }),
      wordingDifferences: (payload.wording_differences || []).map(function (d) {
        return { kind: d.kind, submitted_text: d.submitted_text, source_text: d.source_text };
      }),
      explanation: payload.explanation || '',
      candidateCount: typeof payload.candidate_count === 'number' ? payload.candidate_count : null,
      evidenceTruncated: payload.evidence_truncated === true
    };
  }

  function regenerate(chatId, itemId) {
    const record = Store.chat(chatId);
    if (!record) return;
    const idx = record.items.findIndex(function (m) { return m.id === itemId; });
    if (idx < 1) return;
    record.items.length = idx;
    Store.emit();
    Store.persist();
    runAssistant(chatId);
  }

  function editMessage(chatId, itemId) {
    const entry = Store.item(chatId, itemId);
    if (!entry) return;
    const input = $('#composerInput');
    input.value = entry.text || '';
    autoGrow(input);
    updateSendState();
    input.focus();
    Store.truncateAfter(chatId, itemId);
    Store.persist();
  }

  /* ==========================================================================
     12. VERIFY-SURFACE FLOW (manual)
     ======================================================================= */
  function readVerifyForm() {
    return {
      source_type: $('#sourceSelect').value,
      language: $('#languageSelect').value,
      quote: $('#composerInput').value,
      reference: $('#referenceInput').value.trim()
    };
  }

  function validateVerifyRequest(request) {
    const quote = (request.quote || '').trim();
    const reference = (request.reference || '').trim();
    if (!quote && !reference) return { message: t('validate.empty') };
    if (request.quote.length > quoteLimit()) {
      return { message: t('validate.tooLong', { length: request.quote.length, limit: quoteLimit() }) };
    }
    if (reference.length > 64) return { message: t('validate.refTooLong') };
    const caps = Store.state.capabilities;
    if (caps && Array.isArray(caps.sources)) {
      const supported = caps.sources.some(function (s) {
        return s.source_type === request.source_type && s.language === request.language;
      });
      if (!supported) {
        return { message: t('validate.unsupported', {
          pair: sourceLabel(request.source_type) + ' · ' + languageLabel(request.language)
        }) };
      }
    }
    return null;
  }

  function supportedPair() {
    const caps = Store.state.capabilities;
    if (!caps || !Array.isArray(caps.sources)) return null;
    return caps.sources.find(function (s) {
      return s.source_type === $('#sourceSelect').value && s.language === $('#languageSelect').value;
    }) || null;
  }

  async function runVerifyFlow(chatId, request, options) {
    const opts = options || {};
    if (Store.state.running.active) { Toasts.show(t('error.busy'), 'error'); return; }
    if (opts.afterItemId) Store.truncateAfter(chatId, opts.afterItemId);

    const pending = Store.addItem(chatId, { role: 'tool', kind: 'pending', status: 'pending', request: request });
    const controller = new AbortController();
    Store.setRunning(true, controller);
    Store.state.running.kind = 'verify';
    scrollToBottom();

    try {
      const result = await Api.verify(request, { signal: controller.signal });
      Store.updateItem(chatId, pending.id, {
        kind: 'report', status: 'complete', durationMs: result.durationMs,
        report: normalizeReport(result.payload)
      });
      Store.persist();
      refreshApiState();
    } catch (err) {
      const described = describeError(err);
      Store.updateItem(chatId, pending.id, {
        kind: 'error', status: described.tone === 'cancelled' ? 'cancelled' : 'error',
        durationMs: Date.now() - pending.createdAt, error: described, request: request
      });
      Store.persist();
      if (described.tone !== 'cancelled') Toasts.show(described.title, 'error');
    } finally {
      Store.setRunning(false);
      Store.state.running.kind = null;
      updateSendState();
      scrollToBottom();
    }
  }

  function sendVerifyRequest() {
    const request = readVerifyForm();
    const problem = validateVerifyRequest(request);
    if (problem) { Toasts.show(problem.message, 'error'); $('#composerInput').focus(); return; }

    let record = Store.active();
    if (!record) record = Store.createChat();

    const trimmed = {
      source_type: request.source_type, language: request.language,
      quote: request.quote.trim() || null, reference: request.reference || null
    };
    Store.addItem(record.id, { role: 'tool', kind: 'request', status: 'complete', request: trimmed });
    if (record.items.filter(function (m) { return m.role === 'tool'; }).length === 1) {
      Store.renameChat(record.id, t('chat.checkTitle', { ref: trimmed.reference || (trimmed.quote || '').slice(0, 32) }));
    }
    $('#composerInput').value = '';
    autoGrow($('#composerInput'));
    updateSendState();
    Store.persist();
    runVerifyFlow(record.id, trimmed);
  }

  /* ==========================================================================
     13. API STATE
     ======================================================================= */
  async function refreshApiState(options) {
    const opts = options || {};
    Store.setApiState('checking');
    try {
      const caps = await Api.capabilities({ timeoutMs: 8000 });
      let ready = null;
      let prompt = Store.state.systemPrompt;
      try {
        const probe = await Api.ready({ timeoutMs: 8000 });
        ready = probe.payload;
      } catch (e) { /* readiness is informational */ }
      if (opts.forcePrompt || !prompt || prompt.version !== (caps.payload.system_prompt_version || prompt.version)) {
        try {
          const fetched = await Api.systemPrompt({ timeoutMs: 8000 });
          prompt = fetched.payload;
        } catch (e) { /* chat stays disabled without the protocol prompt */ }
      }
      Store.setApiState('ready', caps.payload, ready, prompt);
    } catch (err) {
      Store.setApiState('unavailable', null, null, Store.state.systemPrompt);
      if (!opts.quiet && err && err.isnad && err.isnad.code !== 'cancelled') {
        const described = describeError(err);
        Toasts.show(Api.base() ? described.title + ' — ' + Api.base() : described.title, 'error');
      }
    }
  }

  function renderConnection() {
    const badge = $('#apiBadge');
    const state = Store.state;
    const labels = { checking: t('api.checking'), ready: t('api.ready'), unavailable: t('api.unavailable') };
    badge.setAttribute('data-state', state.apiState);
    badge.textContent = labels[state.apiState] || 'API';

    const caps = state.capabilities;
    const ready = state.ready;
    const parts = [Api.base() || hasNoApiOrigin() ? '' : t('api.connectedTo', { base: Api.describeBase() })];
    if (!Api.base() && hasNoApiOrigin()) parts.push(t('api.noneConfigured'));
    if (caps) parts.push(t('api.version', { version: caps.api_version || t('api.unreported') }));
    if (caps && caps.sources) parts.push(t('api.pairs', { n: caps.sources.length }));
    if (ready && ready.sources) parts.push(t('api.editions', { n: ready.sources.length }));
    if (state.apiState === 'ready' && !state.systemPrompt) parts.push(t('api.promptMissing'));
    if (state.apiState === 'unavailable') {
      parts.push(hasNoApiOrigin() ? t('api.enterBase') : t('api.unreachableHint'));
    }
    if (state.apiState === 'ready' && !ready) parts.push(t('api.readinessSilent'));
    badge.title = parts.filter(Boolean).join(' · ');

    const modelBadge = $('#modelBadge');
    const configured = Model.configured();
    modelBadge.setAttribute('data-state', configured ? 'ready' : 'unavailable');
    modelBadge.textContent = configured ? Model.label() : t('model.none');
    modelBadge.setAttribute('dir', configured ? 'ltr' : 'auto');
    modelBadge.title = configured
      ? t('model.endpoint', { base: Store.state.settings.modelBase }) + ' · ' +
        (Store.modelKey() ? (Store.state.settings.modelRememberKey ? t('model.keyDevice') : t('model.keyMemory')) : t('model.noKey'))
      : t('model.openSettings');
  }

  /* ==========================================================================
     14. CHAT LIST, SIDEBAR, THEME, EXPORT
     ======================================================================= */
  function groupLabel(ts) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= startOfToday) return t('group.today');
    if (ts >= startOfToday - 86400000) return t('group.yesterday');
    if (ts >= startOfToday - 86400000 * 7) return t('group.week');
    if (new Date(ts).getFullYear() === now.getFullYear()) return t('group.year');
    return t('group.older');
  }

  function renderChatList() {
    const list = $('#convList');
    const state = Store.state;
    /* Arabic-aware: "الرحمن" finds "ٱلرَّحْمَٰنِ", and أ/إ/آ/ا, ى/ي and ة/ه match. */
    const query = I18N.searchKey(state.query.trim());
    const has = function (text) { return I18N.searchKey(text).indexOf(query) >= 0; };

    const matches = state.chats.filter(function (c) {
      if (!query) return true;
      if (has(chatTitle(c))) return true;
      return c.items.some(function (m) {
        if (has(m.text || '')) return true;
        if (m.request && has(m.request.quote || '')) return true;
        if (m.report && has(m.report.submittedQuote || '')) return true;
        return (m.citations || []).some(function (c2) {
          return c2.report && c2.report.evidence && c2.report.evidence.some(function (e) { return has(e.source_text || ''); });
        });
      });
    });

    const count = $('#historyCount');
    count.hidden = !query;
    if (query) {
      count.textContent = t('list.matches', { n: matches.length, total: state.chats.length });
    }

    list.innerHTML = '';
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'sidebar__group';
      empty.textContent = query ? t('list.noMatch') : t('list.empty');
      list.appendChild(empty);
      return;
    }

    const sorted = matches.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    let group = '';
    sorted.forEach(function (record) {
      const label = groupLabel(record.updatedAt);
      if (label !== group) {
        group = label;
        const heading = document.createElement('div');
        heading.className = 'sidebar__group';
        heading.textContent = label;
        list.appendChild(heading);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'conv';
      btn.setAttribute('aria-current', String(record.id === state.activeId));
      btn.dataset.chatId = record.id;
      btn.innerHTML = icon('ic-chat', 'conv__icon') +
        '<span class="conv__title" dir="auto">' + escapeHtml(chatTitle(record)) + '</span>';
      btn.addEventListener('click', function () {
        Store.selectChat(record.id);
        navigate('chat');
        scrollToBottom(true);
        if (isNarrow()) setSidebar('collapsed');
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'conv__del';
      del.setAttribute('aria-label', t('list.delete', { title: chatTitle(record) }));
      del.title = t('list.deleteShort');
      del.innerHTML = icon('ic-trash');
      del.addEventListener('click', function (event) {
        event.stopPropagation();
        confirmDelete(record.id);
      });

      btn.appendChild(del);
      list.appendChild(btn);
    });
  }

  function confirmDelete(id) {
    const record = Store.chat(id);
    if (!record) return;
    if (!window.confirm(t('list.confirmDelete', { title: chatTitle(record) }))) return;
    Store.deleteChat(id);
    Store.persist();
    Toasts.show(t('list.deleted'), 'success');
  }

  function isNarrow() { return window.matchMedia('(max-width: 900px)').matches; }

  function setSidebar(mode) {
    const shell = $('#shell');
    const sidebar = $('#sidebar');
    const backdrop = $('#sidebarBackdrop');
    const menuBtn = $('#menuBtn');
    shell.setAttribute('data-sidebar', mode);

    const expanded = mode === 'expanded';
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(expanded));
    if (sidebar) {
      sidebar.inert = !expanded;
      if (expanded) sidebar.removeAttribute('aria-hidden');
      else sidebar.setAttribute('aria-hidden', 'true');
    }
    if (isNarrow()) {
      backdrop.hidden = !expanded;
      backdrop.setAttribute('data-visible', String(expanded));
      document.body.style.overflow = expanded ? 'hidden' : '';
    } else {
      backdrop.hidden = true;
      backdrop.setAttribute('data-visible', 'false');
      document.body.style.overflow = '';
    }
  }

  function toggleSidebar() {
    setSidebar($('#shell').getAttribute('data-sidebar') === 'expanded' ? 'collapsed' : 'expanded');
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    Store.setTheme(next);
    storage.set('isnad.gui.theme.v1', next);
    const use = $('#themeIcon use');
    if (use) use.setAttribute('href', next === 'dark' ? '#ic-sun' : '#ic-moon');
    const btn = $('#themeBtn');
    if (btn) btn.setAttribute('aria-label', next === 'dark' ? t('header.themeToLight') : t('header.themeToDark'));
  }

  /* Language sets direction: Arabic is right-to-left, English left-to-right.
     Static markup is re-labelled from the catalog, and every rendered view is
     drawn again in the new language. */
  function applyLanguage(lang) {
    I18N.setLanguage(lang);
    I18N.setFormat({ numerals: Store.state.settings.numerals, calendar: Store.state.settings.calendar });
    I18N.apply(document);
    const other = I18N.language() === 'ar' ? 'en' : 'ar';
    $('#langBtn').setAttribute('lang', other);
    $$('[data-lang-opt]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.langOpt === I18N.language()));
    });
    applyTheme(Store.state.theme);
    $('#toggleKeyBtn').textContent = $('#modelKeyInput').type === 'text' ? t('settings.hide') : t('settings.show');
    renderChatList();
    renderConnection();
    refreshApiState({ forcePrompt: true, quiet: true });
    applyMode(Store.state.mode || 'chat');
    applyRoute();
  }

  function applyFormat(patch) {
    Store.setSettings(patch);
    Store.persist();
    I18N.setFormat({ numerals: Store.state.settings.numerals, calendar: Store.state.settings.calendar });
    $$('[data-numerals]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.numerals === Store.state.settings.numerals)); });
    $$('[data-calendar]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.calendar === Store.state.settings.calendar)); });
    renderChatList();
    syncComposer();
    renderItems({ scroll: false });
    applyRoute();
  }

  function chatTitle(record) {
    /* "New chat" was stored literally before titles were localised. */
    const title = record && record.title;
    return title && title !== 'New chat' ? title : t('chat.untitled');
  }

  function exportConversation() {
    const record = Store.active();
    if (!record || !record.items.length) { Toasts.show(t('export.nothing'), 'error'); return; }

    const lines = ['# ' + chatTitle(record), ''];
    record.items.forEach(function (entry) {
      if (entry.role === 'user') {
        lines.push('**' + t('export.you') + '**', '', entry.text || '', '');
      } else if (entry.kind === 'assistant') {
        lines.push('**' + t('msg.isnad') + ' (' + (entry.model || t('export.model')) + ')**', '');
        if (entry.text) lines.push(entry.text, '');
        (entry.citations || []).forEach(function (citation) {
          lines.push('### ' + t('export.citation') + ' · ' + (citation.header.reference || t('citation.noRef')));
          if (citation.state === 'done' && citation.report) {
            const report = citation.report;
            lines.push('', '- ' + t('export.status') + ': `' + report.status + '` (' + statusInfo(report.status).label + ')');
            if (report.sourceMetadata) {
              lines.push('- ' + t('export.source') + ': ' + sourceName(report.sourceMetadata) + ' v' + report.sourceMetadata.version +
                (report.sourceMetadata.content_sha256 ? ' · sha256 ' + report.sourceMetadata.content_sha256 : ''));
            }
            report.evidence.forEach(function (evidence) {
              lines.push('', '> ' + evidence.reference, '>', '> ' + evidence.source_text);
              if (evidence.attribution_text) lines.push('>', '> ' + t('export.attribution') + ': ' + evidence.attribution_text);
              lines.push('>', '> ' + t('export.grade') + ': ' + (evidence.grade_text
                ? evidence.grade_text + (evidence.grade_source ? ' (' + evidence.grade_source + ')' : '')
                : t('export.gradeNone')));
            });
            lines.push('', '_' + statusInfo(report.status).meaning + '_', '');
          } else if (citation.state === 'error' && citation.error) {
            lines.push('', '- ' + t('export.notChecked') + ': ' + citation.error.title + ' — ' + citation.error.message, '');
          }
        });
        lines.push('');
      } else if (entry.role === 'tool' && entry.kind === 'report') {
        const report = entry.report;
        lines.push('**' + t('export.handCheck') + '**', '', '- ' + t('export.status') + ': `' + report.status + '`', '');
        report.evidence.forEach(function (evidence) {
          lines.push('> ' + evidence.reference, '>', '> ' + evidence.source_text, '');
        });
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (chatTitle(record) || 'conversation').replace(/[^\w\u0600-\u06FF-]+/g, '-').slice(0, 40) + '.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    Toasts.show(t('export.done'), 'success');
  }

  /* ==========================================================================
     15. SETTINGS
     ======================================================================= */
  const PROVIDERS = {
    server: { label: 'Novita GLM 5.3 (key held by this server)', base: '', model: Model.SERVER_MODEL_NAME },
    openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: '' },
    groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', model: '' },
    ollama: { label: 'Ollama (local)', base: 'http://127.0.0.1:11434/v1', model: 'llama3.1' },
    litellm: { label: 'LiteLLM proxy (local)', base: 'http://127.0.0.1:4000/v1', model: '' },
    custom: { label: 'Other OpenAI-compatible endpoint', base: '', model: '' }
  };

  function openSettings(tab) {
    const dialog = $('#settingsDialog');
    const settings = Store.state.settings;
    /* Called directly as a click handler the argument is an event, not a tab
       name, so only a known tab name is honoured. */
    const which = (tab === 'api' || tab === 'appearance') ? tab : 'model';
    $$('[data-settings-tab]').forEach(function (button) {
      button.setAttribute('aria-selected', String(button.dataset.settingsTab === which));
    });
    $$('[data-settings-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.settingsPanel !== which;
    });

    $('#providerSelect').value = detectProvider(settings.modelBase);
    $('#modelBaseInput').value = settings.modelBase || '';
    $('#modelNameInput').value = settings.modelName || '';
    $('#modelKeyInput').value = Store.modelKey() || '';
    $('#rememberKeyInput').checked = settings.modelRememberKey === true;
    $('#temperatureInput').value = String(settings.temperature);
    $('#apiBaseInput').value = settings.apiBase || '';
    $('#settingsError').hidden = true;

    $$('[data-lang-opt]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.langOpt === I18N.language()));
    });
    $$('[data-numerals]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.numerals === settings.numerals)); });
    $$('[data-calendar]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.calendar === settings.calendar)); });
    $$('[data-theme-opt]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.themeOpt === Store.state.theme));
    });
    $('#tsSwitch').setAttribute('aria-checked', String(settings.showTimestamps));
    $('#promptStatus').textContent = Store.state.systemPrompt
      ? t('settings.promptLoaded', { version: Store.state.systemPrompt.version })
      : t('settings.promptDisabled');

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    $('#' + (which === 'model' ? 'modelBaseInput' : 'apiBaseInput')).focus();
  }

  function detectProvider(base) {
    if (base && base === Model.serverBase()) return 'server';
    const entry = Object.keys(PROVIDERS).find(function (key) {
      return PROVIDERS[key].base && PROVIDERS[key].base === base;
    });
    return entry || (base ? 'custom' : 'server');
  }

  function closeSettings() {
    const dialog = $('#settingsDialog');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function saveSettings() {
    const error = $('#settingsError');
    let modelBase;
    let apiBase;
    try {
      modelBase = Model.normalizeBase($('#modelBaseInput').value);
    } catch (e) {
      return settingsError(error, e, 'model');
    }
    try {
      apiBase = Api.normalizeBase($('#apiBaseInput').value);
    } catch (e) {
      return settingsError(error, e, 'verification');
    }
    if (modelBase && !$('#modelNameInput').value.trim()) {
      error.textContent = t('settings.needModelName');
      error.hidden = false;
      return;
    }

    const remember = $('#rememberKeyInput').checked;
    Store.setModelKey($('#modelKeyInput').value.trim(), remember);
    Store.setSettings({
      modelBase: modelBase,
      modelName: $('#modelNameInput').value.trim().slice(0, 120),
      modelRememberKey: remember,
      temperature: Math.min(2, Math.max(0, Number($('#temperatureInput').value) || 0)),
      apiBase: apiBase
    });
    Store.persist();
    error.hidden = true;
    closeSettings();
    Toasts.show(modelBase ? t('settings.modelSet', { model: Model.label() }) : t('settings.modelDisconnected'), 'success');
    refreshApiState();
  }

  function settingsError(node, exception, which) {
    const reasons = {
      'not-a-url': t('settings.errNotUrl'),
      'bad-scheme': t('settings.errScheme'),
      'credentials-in-url': t('settings.errCredentials'),
      'not-a-base': t('settings.errNotBase')
    };
    node.textContent = (which === 'model' ? t('settings.errModel') : t('settings.errApi')) +
      (reasons[exception.message] || t('settings.errUnusable'));
    node.hidden = false;
  }

  function openPromptDialog() {
    const prompt = Store.state.systemPrompt;
    const body = prompt && prompt.prompt ? prompt.prompt : t('prompt.notLoadedBody');
    const dialog = $('#promptDialog');
    $('#promptIntro').textContent = t('prompt.intro', { version: prompt ? prompt.version : t('prompt.notLoaded') });
    $('#promptText').textContent = body;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  /* ==========================================================================
     16. COMPOSER
     ======================================================================= */
  function syncComposer() {
    const input = $('#composerInput');
    const used = input.value.length;
    const limit = quoteLimit();
    const counter = $('#charCount');
    counter.textContent = formatCount(used) + ' / ' + formatCount(limit);
    counter.setAttribute('dir', 'ltr');
    $('.composer__meta').setAttribute('data-over-limit', String(used > limit));
    autoGrow(input);
    updateReferenceHint();
    updateSendState();
  }

  function updateReferenceHint() {
    const mode = Store.state.mode;
    const hint = $('#referenceHint');
    if (mode === 'chat') {
      hint.textContent = t('composer.hintChat');
      return;
    }
    const pair = supportedPair();
    const reference = $('#referenceInput').value.trim();
    if (!pair) {
      hint.textContent = Store.state.capabilities ? t('composer.hintNoAdapter') : t('composer.hintDefault');
      $('#referenceInput').placeholder = '2:255';
      return;
    }
    hint.textContent = reference
      ? t('composer.hintFormat', { format: pair.reference_format })
      : t('composer.hintOptional');
    $('#referenceInput').placeholder = String(pair.reference_format || '').trim().slice(0, 40) || '2:255';
  }

  function applyMode(mode) {
    Store.setMode(mode);
    const verify = mode === 'verify';
    $('#verifyFields').hidden = !verify;
    $('#modeChat').setAttribute('aria-pressed', String(!verify));
    $('#modeVerify').setAttribute('aria-pressed', String(verify));
    $('#composerInput').placeholder = verify ? t('composer.placeholderVerify') : t('composer.placeholderChat');
    $('#sendBtnLabel').textContent = verify ? t('composer.verify') : t('composer.send');
    $('#sendIcon').innerHTML = '<use href="#' + (verify ? 'ic-check' : 'ic-send') + '"></use>';
    $('#sendIcon').classList.toggle('icon-mirror', !verify);
    const prompts = Store.state.capabilities && Store.state.capabilities.chat_prompt_suggestions;
    Store.state.chatPrompts = prompts || [];
    syncComposer();
    renderItems({ scroll: false });
    scrollToBottom(true);
  }

  /* ==========================================================================
     17. SCROLL
     ======================================================================= */
  function scrollToBottom(instant) {
    const area = $('#scrollArea');
    if (!area) return;
    window.requestAnimationFrame(function () {
      area.scrollTo({ top: area.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
    });
  }

  function updateScrollFade() {
    const area = $('#scrollArea');
    if (!area) return;
    area.setAttribute('data-scroll-top', String(area.scrollTop > 2));
    area.setAttribute('data-scroll-bottom', String(area.scrollTop + area.clientHeight < area.scrollHeight - 2));
  }

  /* ==========================================================================
     17b. ROUTER — #/chat (default) and #/dashboard. Permalinks (#m-<id>)
     belong to the chat view.
     ======================================================================= */
  function currentRoute() {
    return (window.location.hash || '').indexOf('#/dashboard') === 0 ? 'dashboard' : 'chat';
  }

  function navigate(route) {
    const target = route === 'dashboard' ? '#/dashboard' : '#/chat';
    if (currentRoute() === route && (route === 'dashboard' || window.location.hash)) { applyRoute(); return; }
    if (window.location.hash !== target) window.location.hash = target;
    else applyRoute();
  }

  function applyRoute() {
    const route = currentRoute();
    const dashboard = route === 'dashboard';
    $('#shell').setAttribute('data-view', route);
    $('#dashView').hidden = !dashboard;
    $$('[data-route]').forEach(function (link) {
      if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const toggle = $('#viewToggleBtn');
    toggle.setAttribute('aria-label', dashboard ? t('nav.openChat') : t('nav.openDashboard'));
    toggle.title = toggle.getAttribute('aria-label');
    $('#viewToggleIcon').innerHTML = '<use href="#' + (dashboard ? 'ic-chat' : 'ic-dashboard') + '"></use>';
    const record = Store.active();
    $('#convTitle').textContent = dashboard ? t('dash.title') : chatTitle(record);
    if (dashboard) Dashboard.render();
  }

  /* ==========================================================================
     17c. DASHBOARD

     Two scopes. "This device" is computed here from the saved conversations,
     so it can list the flagged quotations themselves. "Server" reads the
     API's anonymous counters (/v1/stats), which hold no quotation text and
     no references, so the flagged list is unavailable there by design.
     ======================================================================= */
  const Dashboard = (function () {
    const MATCHED = ['exact_match', 'normalized_match', 'partial_match'];
    const REVIEW = ['mismatch_at_cited_reference', 'quote_found_wrong_reference',
      'not_found_in_checked_corpus', 'ambiguous_multiple_matches'];
    const DAY = 86400000;
    const view = { scope: 'device', range: 30, filter: '', server: null, serverState: 'idle', lastKey: '' };

    function dayKey(ts) {
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function startOfDay(ts) {
      const d = new Date(ts);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    function group(status) {
      if (MATCHED.indexOf(status) >= 0) return 'matched';
      if (REVIEW.indexOf(status) >= 0) return 'review';
      return 'other';
    }

    /* Every finished check on this device: model citations and hand checks. */
    function deviceRecords() {
      const records = [];
      const failures = [];
      Store.state.chats.forEach(function (chat) {
        chat.items.forEach(function (entry) {
          const ts = entry.createdAt || chat.updatedAt || Date.now();
          (entry.citations || []).forEach(function (citation) {
            if (citation.state === 'done' && citation.report) {
              records.push({
                ts: ts, report: citation.report, durationMs: citation.durationMs,
                chatId: chat.id, itemId: entry.id, reference: citation.header && citation.header.reference
              });
            } else if (citation.state === 'error') {
              failures.push({ ts: ts });
            }
          });
          if (entry.role === 'tool' && entry.kind === 'report' && entry.report) {
            records.push({
              ts: ts, report: entry.report, durationMs: entry.durationMs,
              chatId: chat.id, itemId: entry.id, reference: entry.report.citedReference
            });
          } else if (entry.role === 'tool' && entry.kind === 'error') {
            failures.push({ ts: ts });
          }
        });
      });
      return { records: records, failures: failures };
    }

    function emptyStatusCounts() {
      const counts = {};
      STATUS_ORDER.forEach(function (status) { counts[status] = 0; });
      return counts;
    }

    function deviceModel() {
      const all = deviceRecords();
      const now = Date.now();
      const earliest = all.records.reduce(function (m, r) { return Math.min(m, r.ts); }, now);
      const span = view.range || Math.min(90, Math.max(7, Math.ceil((now - earliest) / DAY) + 1));
      const from = startOfDay(now) - (span - 1) * DAY;
      const inRange = function (r) { return view.range ? r.ts >= from : true; };
      const records = all.records.filter(inRange);

      const byStatus = emptyStatusCounts();
      const bySource = {};
      const days = [];
      const dayIndex = {};
      for (let i = 0; i < span; i += 1) {
        const ts = from + i * DAY;
        dayIndex[dayKey(ts)] = days.length;
        days.push({ ts: ts, matched: 0, review: 0, other: 0, latencySum: 0, latencyCount: 0 });
      }
      let latencySum = 0;
      let latencyCount = 0;
      records.forEach(function (r) {
        const status = r.report.status;
        byStatus[status] = (byStatus[status] || 0) + 1;
        const pair = (r.report.sourceType || 'other') + ':' + (r.report.language || 'other');
        bySource[pair] = (bySource[pair] || 0) + 1;
        const day = days[dayIndex[dayKey(r.ts)]];
        if (day) day[group(status)] += 1;
        if (typeof r.durationMs === 'number' && isFinite(r.durationMs)) {
          latencySum += r.durationMs; latencyCount += 1;
          if (day) { day.latencySum += r.durationMs; day.latencyCount += 1; }
        }
      });

      const flagged = records.filter(function (r) { return REVIEW.indexOf(r.report.status) >= 0; })
        .sort(function (a, b) { return b.ts - a.ts; });

      return {
        scope: 'device',
        total: records.length,
        byStatus: byStatus,
        bySource: bySource,
        days: days,
        meanLatency: latencyCount ? latencySum / latencyCount : null,
        notChecked: all.failures.filter(inRange).length,
        flagged: flagged,
        hasAny: all.records.length > 0 || all.failures.length > 0
      };
    }

    /* /v1/stats → the same model. The server counts per UTC day for its own
       window; this view trims it to the selected range. */
    function serverModel(payload) {
      const byStatus = emptyStatusCounts();
      const totals = (payload && payload.totals) || {};
      Object.keys(totals.by_status || {}).forEach(function (status) { byStatus[status] = totals.by_status[status]; });
      const bySource = {};
      (payload.breakdown || []).forEach(function (row) {
        const pair = row.source_type + ':' + row.language;
        bySource[pair] = (bySource[pair] || 0) + row.count;
      });
      let daily = (payload.daily || []).slice();
      if (view.range && daily.length > view.range) daily = daily.slice(daily.length - view.range);
      const days = daily.map(function (d) {
        const parts = String(d.date).split('-').map(Number);
        const day = { ts: new Date(parts[0], parts[1] - 1, parts[2]).getTime(), matched: 0, review: 0, other: 0, latencySum: 0, latencyCount: 0 };
        Object.keys(d.by_status || {}).forEach(function (status) { day[group(status)] += d.by_status[status]; });
        return day;
      });
      const latency = payload.latency || {};
      return {
        scope: 'server',
        total: typeof totals.verifications === 'number' ? totals.verifications : 0,
        byStatus: byStatus,
        bySource: bySource,
        days: days,
        meanLatency: typeof latency.mean_ms === 'number' ? latency.mean_ms : null,
        notChecked: totals.source_unavailable_errors || 0,
        flagged: null,
        persistent: payload.persistent === true,
        since: payload.collecting_since || payload.started_at || null,
        hasAny: true
      };
    }

    function loadServer() {
      const caps = Store.state.capabilities;
      if (!caps || caps.stats_enabled !== true) { view.serverState = 'disabled'; view.server = null; return; }
      if (view.serverState === 'loading') return;
      view.serverState = 'loading';
      Api.stats({ timeoutMs: 8000 }).then(function (result) {
        view.server = result.payload;
        view.serverState = 'ready';
        render();
      }, function (err) {
        view.server = null;
        view.serverState = err && err.isnad && err.isnad.code === 'not_found' ? 'disabled' : 'error';
        render();
      });
    }

    /* ---- rendering ------------------------------------------------------- */

    function kpi(label, valueHtml, hintHtml, extraHtml, tone) {
      return '<div class="kpi"' + (tone ? ' data-tone="' + tone + '"' : '') + '>' +
        '<span class="kpi__label">' + escapeHtml(label) + '</span>' +
        '<span class="kpi__value">' + valueHtml + '</span>' +
        (hintHtml ? '<span class="kpi__hint">' + hintHtml + '</span>' : '') +
        (extraHtml || '') +
      '</div>';
    }

    function card(title, bodyHtml, options) {
      const opts = options || {};
      return '<section class="card' + (opts.wide ? ' card--wide' : '') + '" aria-label="' + escapeHtml(title) + '">' +
        '<div class="card__head"><h3 class="card__title">' + escapeHtml(title) + '</h3>' + (opts.tools || '') + '</div>' +
        '<div class="card__body">' + bodyHtml + '</div>' +
      '</section>';
    }

    function legend(items) {
      return '<ul class="legend">' + items.map(function (item) {
        return '<li class="legend__item"><span class="legend__swatch" data-tone="' + item.tone + '"></span>' + escapeHtml(item.label) + '</li>';
      }).join('') + '</ul>';
    }

    function axisLabel(ts) {
      return I18N.date(ts, { day: 'numeric', month: 'short' });
    }

    function statusSection(model) {
      const rows = STATUS_ORDER.map(function (status) {
        const info = statusInfo(status);
        return { label: info.label, value: model.byStatus[status] || 0, display: formatCount(model.byStatus[status] || 0),
          tone: info.tone, title: info.meaning };
      });
      return window.IsnadCharts.barList(rows) +
        window.IsnadCharts.dataTable(t('dash.statusTitle'), [t('dash.colStatus'), t('dash.count')],
          rows.map(function (r) { return [r.label, r.display]; }));
    }

    function activitySection(model) {
      const segs = [
        { key: 'matched', tone: 'positive', label: t('dash.activityMatched') },
        { key: 'review', tone: 'negative', label: t('dash.activityReview') },
        { key: 'other', tone: 'info', label: t('dash.activityOther') }
      ];
      const cols = model.days.map(function (day) {
        return {
          label: I18N.date(day.ts, { dateStyle: 'medium' }),
          axis: axisLabel(day.ts),
          segments: segs.map(function (seg) {
            return { value: day[seg.key], tone: seg.tone, label: seg.label, display: formatCount(day[seg.key]) };
          })
        };
      });
      const every = Math.max(1, Math.ceil(cols.length / 6));
      return window.IsnadCharts.columns(cols, { every: every }) +
        '<div style="margin-top:var(--space-3)">' + legend(segs) + '</div>' +
        window.IsnadCharts.dataTable(t('dash.activityTitle'),
          [t('dash.day')].concat(segs.map(function (seg) { return seg.label; })),
          cols.map(function (col) { return [col.label].concat(col.segments.map(function (seg) { return seg.display; })); }));
    }

    function sourcesSection(model) {
      const pairs = ['quran:ar', 'quran:en', 'hadith:ar', 'hadith:en'];
      Object.keys(model.bySource).forEach(function (pair) { if (pairs.indexOf(pair) < 0) pairs.push(pair); });
      const tones = { 'quran:ar': 'info', 'quran:en': 'turquoise', 'hadith:ar': 'caution', 'hadith:en': 'neutral' };
      const rows = pairs.map(function (pair) {
        const bits = pair.split(':');
        const value = model.bySource[pair] || 0;
        return { label: sourceLabel(bits[0]) + ' · ' + languageLabel(bits[1]), value: value, display: formatCount(value), tone: tones[pair] || 'neutral' };
      });
      return window.IsnadCharts.barList(rows) +
        window.IsnadCharts.dataTable(t('dash.sourcesTitle'), [t('dash.colSource'), t('dash.count')],
          rows.map(function (r) { return [r.label, r.display]; }));
    }

    function healthSection() {
      const caps = Store.state.capabilities;
      const ready = Store.state.ready;
      const rows = [];
      const apiState = Store.state.apiState;
      rows.push(healthRow(apiState === 'ready' ? 'ok' : (apiState === 'checking' ? 'warn' : 'down'),
        t('dash.healthApi'),
        apiState === 'ready' ? t('dash.healthReady') : (apiState === 'checking' ? t('api.checking') : t('api.unavailable')),
        caps ? escapeHtml(Api.describeBase()) + ' · ' + versionHtml(caps.api_version || '?') : escapeHtml(Api.describeBase())));
      if (caps && caps.sources) {
        caps.sources.forEach(function (source) {
          const loaded = ready && ready.sources && ready.sources.find(function (r) {
            return r.source_type === source.source_type && r.language === source.language;
          });
          const remote = /remote/.test(String(source.mode || ''));
          rows.push(healthRow(loaded ? (remote ? 'warn' : 'ok') : 'warn',
            source.display_name || source.name,
            remote ? t('dash.healthRemote') : (loaded ? t('dash.healthLoaded') : t('dash.healthUnknown')),
            escapeHtml(sourceLabel(source.source_type) + ' · ' + languageLabel(source.language)) + ' · ' + versionHtml(source.source_version) +
            (loaded && loaded.source_sha256 ? ' · ' + escapeHtml(t('dash.healthChecksum')) + ' ' + refHtml(shortHash(loaded.source_sha256)) : '')));
        });
      } else if (apiState !== 'checking') {
        rows.push('<li class="health__row"><span class="health__dot"></span><span class="health__name">' + escapeHtml(t('dash.healthOffline')) + '</span></li>');
      }
      const prompt = Store.state.systemPrompt;
      rows.push(healthRow(prompt ? 'ok' : 'down', t('dash.healthProtocol'), prompt ? t('dash.healthLoaded') : t('prompt.notLoaded'),
        prompt ? refHtml(prompt.version) : ''));
      rows.push(healthRow(Model.configured() ? 'ok' : 'down', t('dash.healthModel'),
        Model.configured() ? t('dash.healthReady') : t('model.none'),
        Model.configured() ? refHtml(Model.label()) : ''));
      return '<ul class="health">' + rows.join('') + '</ul>';
    }

    function healthRow(state, name, stateLabel, metaHtml) {
      return '<li class="health__row">' +
        '<span class="health__dot" data-state="' + state + '"></span>' +
        '<span class="health__name" dir="auto">' + escapeHtml(name) + '</span>' +
        '<span class="health__state">' + escapeHtml(stateLabel) + '</span>' +
        (metaHtml ? '<span class="health__meta">' + metaHtml + '</span>' : '') +
      '</li>';
    }

    function flaggedSection(model) {
      if (!model.flagged) return '<p class="dash__note">' + escapeHtml(t('dash.flaggedServer')) + '</p>';
      const rows = model.flagged.filter(function (r) { return !view.filter || r.report.status === view.filter; }).slice(0, 50);
      if (!rows.length) return '<p class="result__note">' + escapeHtml(t('dash.flaggedEmpty')) + '</p>';
      return '<div class="table-wrap"><table class="dtable"><thead><tr>' +
        ['dash.colText', 'dash.colRef', 'dash.colStatus', 'dash.colSource', 'dash.colWhen', ''].map(function (key) {
          return '<th scope="col">' + (key ? escapeHtml(t(key)) : '<span class="sr-only">' + escapeHtml(t('dash.open')) + '</span>') + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          const info = statusInfo(r.report.status);
          return '<tr>' +
            '<td><div class="dtable__text" dir="auto">' + escapeHtml(r.report.submittedQuote || t('result.referenceOnly')) + '</div></td>' +
            '<td>' + (r.reference || r.report.citedReference ? refHtml(r.reference || r.report.citedReference) : '—') + '</td>' +
            '<td><span class="status-pill" data-tone="' + info.tone + '">' + escapeHtml(info.label) + '</span></td>' +
            '<td>' + escapeHtml(sourceLabel(r.report.sourceType) + ' · ' + languageLabel(r.report.language)) + '</td>' +
            '<td class="dtable__when">' + escapeHtml(I18N.date(r.ts, { dateStyle: 'medium' })) + '</td>' +
            '<td><button class="linkbtn" type="button" data-open-chat="' + escapeHtml(r.chatId) + '" data-open-item="' + escapeHtml(r.itemId) + '">' +
              escapeHtml(t('dash.open')) + icon('ic-external') + '</button></td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    function headerHtml() {
      const ranges = [[7, 'dash.range7'], [30, 'dash.range30'], [90, 'dash.range90'], [0, 'dash.rangeAll']];
      return '<header class="dash__head">' +
        '<div class="dash__titles"><h2 class="sr-only" id="dashTitle">' + escapeHtml(t('dash.title')) + '</h2>' +
          '<p class="dash__sub">' + escapeHtml(t('dash.subtitle')) + '</p></div>' +
        '<div class="dash__controls">' +
          '<div class="segmented" role="radiogroup" aria-label="' + escapeHtml(t('dash.scope')) + '">' +
            ['device', 'server'].map(function (scope) {
              return '<button class="segmented__opt" type="button" role="radio" data-dash-scope="' + scope + '" aria-checked="' + (view.scope === scope) + '">' +
                escapeHtml(t(scope === 'device' ? 'dash.scopeDevice' : 'dash.scopeServer')) + '</button>';
            }).join('') +
          '</div>' +
          '<span class="select"><select id="dashRange" aria-label="' + escapeHtml(t('dash.range')) + '">' +
            ranges.map(function (r) {
              return '<option value="' + r[0] + '"' + (view.range === r[0] ? ' selected' : '') + '>' + escapeHtml(t(r[1])) + '</option>';
            }).join('') +
          '</select><svg class="select__chev" aria-hidden="true" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>' +
          (view.scope === 'device' ? '<button class="btn btn--sm" type="button" id="dashCsv">' + icon('ic-download') + escapeHtml(t('dash.exportCsv')) + '</button>' : '') +
        '</div>' +
      '</header>' +
      '<span class="dash__band" data-geo="band" aria-hidden="true"></span>';
    }

    function emptyHtml() {
      return '<div class="dash__empty">' +
        '<span class="empty__medallion" aria-hidden="true">' + window.IsnadGeometry.medallion(200) + '</span>' +
        '<svg class="empty__mark" aria-hidden="true"><use href="#px-mark"/></svg>' +
        '<h3 class="empty__title">' + escapeHtml(t('dash.emptyTitle')) + '</h3>' +
        '<p class="empty__sub">' + escapeHtml(t('dash.emptySub')) + '</p>' +
        '<div class="dash__empty-actions">' +
          '<button class="btn btn--primary" type="button" data-dash-start="chat">' + icon('ic-spark-small') + escapeHtml(t('dash.startChat')) + '</button>' +
          '<button class="btn" type="button" data-dash-start="verify">' + icon('ic-check') + escapeHtml(t('dash.startVerify')) + '</button>' +
        '</div>' +
      '</div>';
    }

    function bodyHtml(model) {
      const matched = MATCHED.reduce(function (n, s) { return n + (model.byStatus[s] || 0); }, 0);
      const review = REVIEW.reduce(function (n, s) { return n + (model.byStatus[s] || 0); }, 0);
      const rate = model.total ? matched / model.total : 0;
      const totals = model.days.map(function (d) { return d.matched + d.review + d.other; });
      const reviews = model.days.map(function (d) { return d.review; });
      const latencies = model.days.map(function (d) { return d.latencyCount ? d.latencySum / d.latencyCount : 0; });

      const kpis = '<div class="kpis">' +
        kpi(t('dash.kpiChecked'), escapeHtml(formatCount(model.total)),
          model.notChecked ? escapeHtml(t('dash.kpiNotChecked', { n: model.notChecked })) : '',
          '<span class="kpi__spark">' + window.IsnadCharts.sparkline(totals) + '</span>') +
        kpi(t('dash.kpiMatchRate'), model.total ? escapeHtml(I18N.percent(rate)) : '—',
          escapeHtml(t('dash.kpiMatchRateHint')),
          '<span class="kpi__ring">' + window.IsnadCharts.ring(rate) + '</span>', model.total ? 'positive' : '') +
        kpi(t('dash.kpiReview'), escapeHtml(formatCount(review)), escapeHtml(t('dash.kpiReviewHint')),
          '<span class="kpi__spark">' + window.IsnadCharts.sparkline(reviews) + '</span>', review ? 'negative' : '') +
        kpi(t('dash.kpiLatency'), model.meanLatency == null ? '—' : escapeHtml(formatDuration(model.meanLatency)), '',
          model.scope === 'device' ? '<span class="kpi__spark">' + window.IsnadCharts.sparkline(latencies) + '</span>' : '') +
      '</div>';

      const statusFilter = '<span class="select"><select id="dashFilter" aria-label="' + escapeHtml(t('dash.colStatus')) + '">' +
        '<option value="">' + escapeHtml(t('dash.filterAll')) + '</option>' +
        REVIEW.map(function (status) {
          return '<option value="' + status + '"' + (view.filter === status ? ' selected' : '') + '>' + escapeHtml(statusInfo(status).label) + '</option>';
        }).join('') +
        '</select><svg class="select__chev" aria-hidden="true" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>';

      return kpis +
        '<div class="dash__grid">' +
          card(t('dash.statusTitle'), statusSection(model)) +
          card(t('dash.activityTitle'), activitySection(model)) +
          card(t('dash.sourcesTitle'), sourcesSection(model)) +
          card(t('dash.healthTitle'), healthSection()) +
          card(t('dash.flaggedTitle'), flaggedSection(model), { wide: true, tools: model.flagged ? '<div class="dash__controls">' + statusFilter + '</div>' : '' }) +
        '</div>';
    }

    function render() {
      const root = $('#dashContent');
      if (!root || currentRoute() !== 'dashboard') return;
      let html = headerHtml();
      if (view.scope === 'server') {
        if (view.serverState === 'idle') loadServer();
        if (view.serverState === 'disabled') {
          html += '<p class="dash__note dash__note--warn">' + escapeHtml(t('dash.serverDisabled')) + '</p>';
        } else if (view.serverState === 'loading' || view.serverState === 'idle') {
          html += '<div class="dash__note">' + checkingHtml(t('dash.serverLoading')) + '</div>';
        } else if (view.serverState === 'error' || !view.server) {
          html += '<p class="dash__note dash__note--warn">' + escapeHtml(t('dash.serverError')) + '</p>';
        } else {
          const model = serverModel(view.server);
          const notes = [];
          if (!model.persistent) notes.push(t('dash.serverVolatile'));
          if (model.since) notes.push(t('dash.serverSince', { date: I18N.date(model.since, { dateStyle: 'medium', timeStyle: 'short' }) }));
          html += '<p class="dash__note">' + escapeHtml(notes.join(' · ')) + '</p>' + bodyHtml(model);
        }
      } else {
        const model = deviceModel();
        html += model.hasAny ? bodyHtml(model) : emptyHtml();
      }
      html += '<p class="dash__disclaimer">' + escapeHtml(t('dash.disclaimer')) + '</p>';
      root.innerHTML = html;
      window.IsnadGeometry.mount(root);
    }

    /* Re-renders only when something the dashboard shows has changed, so a
       streaming reply does not redraw it on every token. */
    function maybeRender() {
      if (currentRoute() !== 'dashboard') return;
      const key = [
        Store.state.apiState, Store.state.chats.length,
        Store.state.chats.reduce(function (m, c) { return Math.max(m, c.updatedAt || 0); }, 0),
        Store.state.running.active, Boolean(Store.state.systemPrompt), Model.configured()
      ].join('|');
      if (key === view.lastKey) return;
      view.lastKey = key;
      if (view.scope === 'server' && view.serverState !== 'loading') view.serverState = 'idle';
      render();
    }

    function csv() {
      const model = deviceModel();
      const quote = function (value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; };
      const header = ['date', 'status', 'status_label', 'source_type', 'language', 'cited_reference', 'matched_references', 'quoted_text', 'duration_ms'];
      const all = deviceRecords().records.filter(function (r) { return view.range ? r.ts >= startOfDay(Date.now()) - (view.range - 1) * DAY : true; })
        .sort(function (a, b) { return b.ts - a.ts; });
      const lines = [header.join(',')].concat(all.map(function (r) {
        return [
          new Date(r.ts).toISOString(), r.report.status, statusInfo(r.report.status).label,
          r.report.sourceType, r.report.language, r.reference || r.report.citedReference || '',
          (r.report.matchedReferences || []).join(' '), r.report.submittedQuote || '',
          typeof r.durationMs === 'number' ? Math.round(r.durationMs) : ''
        ].map(quote).join(',');
      }));
      /* The BOM makes spreadsheet apps read the Arabic as UTF-8. */
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'isnad-citations-' + dayKey(Date.now()) + '.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      Toasts.show(t('dash.csvDone'), 'success');
      return model;
    }

    function wire() {
      const root = $('#dashContent');
      root.addEventListener('click', function (event) {
        const scope = event.target.closest('[data-dash-scope]');
        if (scope) {
          view.scope = scope.dataset.dashScope;
          if (view.scope === 'server') view.serverState = 'idle';
          render();
          return;
        }
        if (event.target.closest('#dashCsv')) { csv(); return; }
        const open = event.target.closest('[data-open-chat]');
        if (open) {
          Store.selectChat(open.dataset.openChat);
          const itemId = open.dataset.openItem;
          Store.setMode(Store.state.mode);
          navigate('chat');
          window.setTimeout(function () { highlightItem(itemId); }, 120);
          return;
        }
        const start = event.target.closest('[data-dash-start]');
        if (start) {
          navigate('chat');
          applyMode(start.dataset.dashStart === 'verify' ? 'verify' : 'chat');
          $('#composerInput').focus();
        }
      });
      root.addEventListener('change', function (event) {
        if (event.target.id === 'dashRange') { view.range = Number(event.target.value) || 0; render(); }
        else if (event.target.id === 'dashFilter') { view.filter = event.target.value; render(); }
      });
    }

    return { render: render, maybeRender: maybeRender, wire: wire };
  })();

  /* ==========================================================================
     18. EVENT WIRING
     ======================================================================= */
  function wireEvents() {

    $('#composerForm').addEventListener('submit', function (event) {
      event.preventDefault();
      if (Store.state.mode === 'verify') sendVerifyRequest();
      else sendMessage();
    });

    const input = $('#composerInput');
    input.addEventListener('input', syncComposer);
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.isComposing) return;
      const verifyMode = Store.state.mode === 'verify';
      if (verifyMode && !event.shiftKey) {
        event.preventDefault();
        sendVerifyRequest();
        return;
      }
      if (!verifyMode && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    $('#referenceInput').addEventListener('input', function () { updateReferenceHint(); updateSendState(); });
    $('#sourceSelect').addEventListener('change', function () { updateReferenceHint(); updateSendState(); });
    $('#languageSelect').addEventListener('change', function () { updateReferenceHint(); updateSendState(); });

    $('#stopBtn').addEventListener('click', stopGeneration);

    $('#modeChat').addEventListener('click', function () { applyMode('chat'); });
    $('#modeVerify').addEventListener('click', function () { applyMode('verify'); });

    $('#newChatBtn').addEventListener('click', function () {
      Store.createChat();
      navigate('chat');
      Store.persist();
      renderItems({ instant: true });
      $('#composerInput').value = '';
      autoGrow($('#composerInput'));
      updateSendState();
      if (isNarrow()) setSidebar('collapsed');
      $('#composerInput').focus();
    });

    const searchInput = $('#convSearch');
    const clearBtn = $('#clearSearchBtn');
    searchInput.addEventListener('input', function () {
      clearBtn.hidden = searchInput.value.length === 0;
      Store.setQuery(searchInput.value);
    });
    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      clearBtn.hidden = true;
      Store.setQuery('');
      searchInput.focus();
    });

    $('#themeBtn').addEventListener('click', function () {
      applyTheme(Store.state.theme === 'dark' ? 'light' : 'dark');
    });
    $('#exportBtn').addEventListener('click', exportConversation);
    $('#refreshApiBtn').addEventListener('click', function () {
      refreshApiState().then(function () { Toasts.show(t('settings.refreshed'), 'success'); });
    });
    $('#modelBadge').addEventListener('click', function () { openSettings('model'); });

    $('#settingsBtn').addEventListener('click', function () { openSettings('model'); });
    $('#closeSettingsBtn').addEventListener('click', closeSettings);
    $('#cancelSettingsBtn').addEventListener('click', closeSettings);
    $('#saveSettingsBtn').addEventListener('click', saveSettings);

    $$('[data-settings-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        const which = button.dataset.settingsTab;
        $$('[data-settings-tab]').forEach(function (other) {
          other.setAttribute('aria-selected', String(other === button));
        });
        $$('[data-settings-panel]').forEach(function (panel) {
          panel.hidden = panel.dataset.settingsPanel !== which;
        });
        $('#settingsError').hidden = true;
      });
    });

    $('#providerSelect').addEventListener('change', function () {
      const provider = PROVIDERS[$('#providerSelect').value];
      if (!provider) return;
      if ($('#providerSelect').value === 'server') {
        $('#modelBaseInput').value = Model.serverBase();
        $('#modelNameInput').value = provider.model;
        $('#modelKeyInput').value = '';
        return;
      }
      if (provider.base) $('#modelBaseInput').value = provider.base;
      if (provider.model && !$('#modelNameInput').value.trim()) $('#modelNameInput').value = provider.model;
    });

    $('#toggleKeyBtn').addEventListener('click', function () {
      const field = $('#modelKeyInput');
      const showing = field.type === 'text';
      field.type = showing ? 'password' : 'text';
      $('#toggleKeyBtn').textContent = showing ? t('settings.show') : t('settings.hide');
    });

    $('#closePromptBtn').addEventListener('click', function () {
      const dialog = $('#promptDialog');
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    });

    $('#clearHistoryBtn').addEventListener('click', function () {
      if (!window.confirm(t('settings.confirmClear'))) return;
      storage.remove('isnad.gui.state.v2');
      Store.state.chats = [];
      Store.state.activeId = null;
      Store.createChat();
      Store.persist();
      closeSettings();
      Toasts.show(t('settings.cleared'), 'success');
    });

    $('#forgetKeyBtn').addEventListener('click', function () {
      Store.setModelKey('', false);
      Store.setSettings({ modelRememberKey: false });
      $('#modelKeyInput').value = '';
      $('#rememberKeyInput').checked = false;
      Store.persist();
      Toasts.show(t('settings.keyForgotten'), 'success');
    });

    $$('[data-theme-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.dataset.themeOpt);
        $$('[data-theme-opt]').forEach(function (b) {
          b.setAttribute('aria-checked', String(b.dataset.themeOpt === Store.state.theme));
        });
      });
    });

    $$('[data-lang-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyLanguage(btn.dataset.langOpt); });
    });
    $('#langBtn').addEventListener('click', function () {
      applyLanguage(I18N.language() === 'ar' ? 'en' : 'ar');
    });
    $$('[data-numerals]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyFormat({ numerals: btn.dataset.numerals }); });
    });
    $$('[data-calendar]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyFormat({ calendar: btn.dataset.calendar }); });
    });
    $('#viewToggleBtn').addEventListener('click', function () {
      navigate(currentRoute() === 'dashboard' ? 'chat' : 'dashboard');
    });
    $$('[data-route]').forEach(function (link) {
      link.addEventListener('click', function () { if (isNarrow()) setSidebar('collapsed'); });
    });
    Dashboard.wire();

    $('#tsSwitch').addEventListener('click', function () {
      const next = $('#tsSwitch').getAttribute('aria-checked') !== 'true';
      $('#tsSwitch').setAttribute('aria-checked', String(next));
      Store.setSettings({ showTimestamps: next });
      Store.persist();
    });

    $('#menuBtn').addEventListener('click', toggleSidebar);
    $('#collapseBtn').addEventListener('click', function () { setSidebar('collapsed'); });
    $('#sidebarBackdrop').addEventListener('click', function () { setSidebar('collapsed'); });

    const composerEl = $('.composer');
    const syncComposerHeight = function () {
      $('#surface').style.setProperty('--composer-h', composerEl.offsetHeight + 'px');
    };
    syncComposerHeight();
    if (window.ResizeObserver) new ResizeObserver(syncComposerHeight).observe(composerEl);

    $('#scrollArea').addEventListener('scroll', updateScrollFade, { passive: true });

    $('#messages').addEventListener('click', function (event) {
      const btn = event.target.closest('[data-copy-code]');
      if (!btn) return;
      const block = btn.closest('.codeblock');
      const code = block ? $('.codeblock__pre code', block) : null;
      if (code) copyText(code.textContent);
    });

    document.addEventListener('keydown', function (event) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        $('#convSearch').focus();
        if (isNarrow()) setSidebar('expanded');
      } else if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      } else if (mod && event.key.toLowerCase() === ',') {
        event.preventDefault();
        openSettings('model');
      } else if (event.key === 'Escape' && isNarrow() && $('#shell').getAttribute('data-sidebar') === 'expanded') {
        setSidebar('collapsed');
      }
    });

    let resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (isNarrow()) setSidebar($('#shell').getAttribute('data-sidebar') === 'expanded' ? 'expanded' : 'collapsed');
        else setSidebar($('#shell').getAttribute('data-sidebar') || 'expanded');
        updateScrollFade();
      }, 120);
    });

    window.addEventListener('beforeunload', function () {
      Store.persist();
      Speech.stop();
      const controller = Store.state.running.controller;
      if (controller) controller.abort();
    });
  }

  /* ==========================================================================
     19. RENDER SUBSCRIPTION
     ======================================================================= */
  function subscribeRender() {
    let scheduled = false;
    Store.subscribe(function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;

        renderChatList();
        renderConnection();
        updateReferenceHint();

        const record = Store.active();
        $('#convTitle').textContent = currentRoute() === 'dashboard' ? t('dash.title') : chatTitle(record);
        Dashboard.maybeRender();

        const running = Store.state.running.active;
        $('#stopBtn').hidden = !running;
        updateSendState();

        /* A streaming reply is patched in place; the transcript is rebuilt only
           when its shape changed (a new item, a state change). */
        const container = $('#messages');
        const last = record && record.items.length ? record.items[record.items.length - 1] : null;
        const patched = running && Store.state.running.kind === 'chat' && last &&
          (last.kind === 'streaming') && patchStreamingItem(record.id, last.id);

        if (!patched) {
          const key = [
            Store.state.activeId, Store.state.mode, Store.state.apiState, Model.configured(),
            record ? record.items.length : 0,
            last ? last.kind + ':' + last.status + ':' + (last.parts ? last.parts.length : 0) + ':' +
              (last.citations ? last.citations.map(function (c) { return c.state; }).join(',') : '') : ''
          ].join('|');
          if (container.getAttribute('data-key') !== key) {
            container.setAttribute('data-key', key);
            renderItems({ scroll: false });
          }
        }
        updateScrollFade();
      });
    });
  }

  /* ==========================================================================
     20. BOOT
     ======================================================================= */
  function followPermalink() {
    const hash = window.location.hash || '';
    if (hash.indexOf('#m-') !== 0) return;
    if (currentRoute() !== 'chat') applyRoute();
    const id = hash.slice(3);
    if (!id) return;
    window.requestAnimationFrame(function () {
      window.setTimeout(function () { highlightItem(id); }, 60);
    });
  }

  function init() {
    Store.load();
    I18N.setLanguage(I18N.language());
    I18N.setFormat({ numerals: Store.state.settings.numerals, calendar: Store.state.settings.calendar });
    I18N.apply(document);
    window.IsnadGeometry.mount(document);
    $('#langBtn').setAttribute('lang', I18N.language() === 'ar' ? 'en' : 'ar');
    applyTheme(Store.state.theme);

    subscribeRender();
    wireEvents();
    applyMode(Store.state.mode || 'chat');

    renderChatList();
    renderConnection();
    renderItems({ instant: true });
    syncComposer();
    updateScrollFade();
    setSidebar(isNarrow() ? 'collapsed' : 'expanded');

    const narrowQuery = window.matchMedia('(max-width: 900px)');
    if (narrowQuery.addEventListener) {
      narrowQuery.addEventListener('change', function (event) {
        setSidebar(event.matches ? 'collapsed' : 'expanded');
      });
    }

    if (window.matchMedia('(pointer: fine)').matches) {
      window.setTimeout(function () { $('#composerInput').focus(); }, 260);
    }

    applyRoute();
    followPermalink();
    window.addEventListener('hashchange', function () { applyRoute(); followPermalink(); });

    refreshApiState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
