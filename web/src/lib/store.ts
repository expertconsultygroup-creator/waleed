"use client";

import { create } from "zustand";
import type {
  ApiState,
  Calendar,
  Capabilities,
  Chat,
  Item,
  Lang,
  Mode,
  Numerals,
  Ready,
  Settings,
  SystemPrompt,
  Theme,
} from "./types";

/* Storage keys and shapes are the classic interface's, so a reader keeps
   their conversations, settings and remembered key across both. Every value
   is JSON-encoded once. */
export const KEYS = {
  state: "isnad.gui.state.v2",
  settings: "isnad.gui.settings.v2",
  legacySettings: "isnad.gui.settings.v1",
  modelKey: "isnad.gui.modelkey.v1",
  theme: "isnad.gui.theme.v1",
  lang: "isnad.gui.lang.v1",
} as const;

const LIMITS = { chats: 40, items: 120 };
export const SERVER_MODEL_NAME = "zai-org/glm-5.3";

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function normalizeBase(value: string, fallbackPath = ""): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("not-a-url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad-scheme");
  if (parsed.username || parsed.password) throw new Error("credentials-in-url");
  if (parsed.search || parsed.hash) throw new Error("not-a-base");
  const path = parsed.pathname.replace(/\/+$/, "");
  return parsed.origin + (path || fallbackPath);
}

export const normalizeApiBase = (value: string) => normalizeBase(value);
export const normalizeModelBase = (value: string) => normalizeBase(value, "/v1");

/* The API the page talks to: the configured base, the build-time default
   (for `next dev` against a separate API), or this page's own origin. */
export function apiBase(settings: Settings): string {
  return settings.apiBase || process.env.NEXT_PUBLIC_ISNAD_API_BASE || "";
}

/* The server proxies a model with a key it holds (/v1/model): the default
   endpoint, so chat works without the reader configuring anything. */
export function serverModelBase(settings: Settings): string {
  const origin =
    apiBase(settings) ||
    (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) ? window.location.origin : "");
  if (!origin) return "";
  try {
    return normalizeModelBase(origin.replace(/\/+$/, "") + "/v1/model");
  } catch {
    return "";
  }
}

const DEFAULT_SETTINGS: Settings = {
  apiBase: "",
  modelBase: "",
  modelName: "",
  modelRememberKey: false,
  temperature: 0.3,
  numerals: "arab",
  calendar: "gregory",
  showTimestamps: true,
};

export interface Running {
  active: boolean;
  kind: "chat" | "verify" | null;
  controller: AbortController | null;
}

export interface IsnadState {
  hydrated: boolean;
  chats: Chat[];
  activeId: string | null;
  mode: Mode;
  query: string;
  settings: Settings;
  theme: Theme;
  lang: Lang;
  modelKey: string;
  running: Running;
  apiState: ApiState;
  capabilities: Capabilities | null;
  ready: Ready | null;
  systemPrompt: SystemPrompt | null;

  hydrate(): void;
  createChat(): Chat;
  selectChat(id: string): void;
  deleteChat(id: string): void;
  renameChat(id: string, title: string): void;
  clearHistory(): void;
  addItem(chatId: string, entry: Omit<Item, "id" | "createdAt"> & Partial<Pick<Item, "id" | "createdAt">>): Item | null;
  updateItem(chatId: string, itemId: string, patch: Partial<Item>): void;
  removeItem(chatId: string, itemId: string): void;
  truncateAfter(chatId: string, itemId: string, inclusive?: boolean): void;
  setMode(mode: Mode): void;
  setQuery(query: string): void;
  setSettings(patch: Partial<Settings>): void;
  setTheme(theme: Theme): void;
  setLang(lang: Lang): void;
  setModelKey(value: string, remember: boolean): void;
  setRunning(running: Partial<Running>): void;
  setApi(next: ApiState, data?: { capabilities?: Capabilities | null; ready?: Ready | null; systemPrompt?: SystemPrompt | null }): void;
}

function freshChat(): Chat {
  const now = Date.now();
  return { id: uid(), title: "", items: [], createdAt: now, updatedAt: now };
}

export const useIsnad = create<IsnadState>()((set, get) => {
  const mutateChat = (chatId: string, fn: (chat: Chat) => Chat) =>
    set((s) => ({ chats: s.chats.map((c) => (c.id === chatId ? fn(c) : c)) }));

  return {
    hydrated: false,
    chats: [],
    activeId: null,
    mode: "chat",
    query: "",
    settings: DEFAULT_SETTINGS,
    theme: "light",
    lang: "ar",
    modelKey: "",
    running: { active: false, kind: null, controller: null },
    apiState: "checking",
    capabilities: null,
    ready: null,
    systemPrompt: null,

    hydrate() {
      if (get().hydrated) return;
      const saved = storage.get<{ chats?: Chat[]; activeId?: string; mode?: Mode } | null>(KEYS.state, null);
      let chats: Chat[] = [];
      let activeId: string | null = null;
      if (saved && Array.isArray(saved.chats) && saved.chats.length) {
        chats = saved.chats.map((c) => ({ ...c, items: Array.isArray(c.items) ? c.items : [] }));
        activeId = saved.activeId && chats.some((c) => c.id === saved.activeId) ? saved.activeId : chats[0].id;
      } else {
        const chat = freshChat();
        chats = [chat];
        activeId = chat.id;
      }

      const settings: Settings = { ...DEFAULT_SETTINGS };
      const savedSettings =
        storage.get<Partial<Settings> | null>(KEYS.settings, null) ?? storage.get<Partial<Settings> | null>(KEYS.legacySettings, null);
      if (savedSettings && typeof savedSettings === "object") {
        try { settings.apiBase = normalizeApiBase(savedSettings.apiBase ?? ""); } catch { settings.apiBase = ""; }
        try { settings.modelBase = normalizeModelBase(savedSettings.modelBase ?? ""); } catch { settings.modelBase = ""; }
        if (typeof savedSettings.modelName === "string") settings.modelName = savedSettings.modelName.slice(0, 120);
        if (typeof savedSettings.temperature === "number") settings.temperature = Math.min(2, Math.max(0, savedSettings.temperature));
        if (savedSettings.numerals === "arab" || savedSettings.numerals === "latn") settings.numerals = savedSettings.numerals as Numerals;
        if (savedSettings.calendar === "gregory" || savedSettings.calendar === "islamic-umalqura") settings.calendar = savedSettings.calendar as Calendar;
        if (typeof savedSettings.showTimestamps === "boolean") settings.showTimestamps = savedSettings.showTimestamps;
        settings.modelRememberKey = savedSettings.modelRememberKey === true;
      }
      if (!settings.modelBase) {
        settings.modelBase = serverModelBase(settings);
        if (settings.modelBase && !settings.modelName) settings.modelName = SERVER_MODEL_NAME;
      }
      const remembered = storage.get<string>(KEYS.modelKey, "");
      const modelKey = settings.modelRememberKey && typeof remembered === "string" ? remembered : "";

      const savedTheme = storage.get<string | null>(KEYS.theme, null);
      const theme: Theme =
        savedTheme === "dark" || savedTheme === "light"
          ? savedTheme
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      const lang: Lang = storage.get<string>(KEYS.lang, "ar") === "en" ? "en" : "ar";

      set({
        hydrated: true,
        chats,
        activeId,
        mode: saved?.mode === "verify" ? "verify" : "chat",
        settings,
        modelKey,
        theme,
        lang,
      });
    },

    createChat() {
      const chat = freshChat();
      set((s) => ({ chats: [chat, ...s.chats], activeId: chat.id }));
      return chat;
    },
    selectChat(id) {
      if (get().chats.some((c) => c.id === id)) set({ activeId: id });
    },
    deleteChat(id) {
      const chats = get().chats.filter((c) => c.id !== id);
      if (!chats.length) {
        const chat = freshChat();
        set({ chats: [chat], activeId: chat.id });
        return;
      }
      set((s) => ({ chats, activeId: s.activeId === id ? chats[0].id : s.activeId }));
    },
    renameChat(id, title) {
      const next = String(title || "").trim();
      if (!next) return;
      mutateChat(id, (c) => ({ ...c, title: next, updatedAt: Date.now() }));
    },
    clearHistory() {
      storage.remove(KEYS.state);
      const chat = freshChat();
      set({ chats: [chat], activeId: chat.id });
    },
    addItem(chatId, entry) {
      const chat = get().chats.find((c) => c.id === chatId);
      if (!chat) return null;
      const created = { id: uid(), createdAt: Date.now(), ...entry } as Item;
      mutateChat(chatId, (c) => ({ ...c, items: [...c.items, created], updatedAt: Date.now() }));
      return created;
    },
    updateItem(chatId, itemId, patch) {
      mutateChat(chatId, (c) => ({
        ...c,
        updatedAt: Date.now(),
        items: c.items.map((m) => (m.id === itemId ? { ...m, ...patch } : m)),
      }));
    },
    removeItem(chatId, itemId) {
      mutateChat(chatId, (c) => ({ ...c, items: c.items.filter((m) => m.id !== itemId) }));
    },
    truncateAfter(chatId, itemId, inclusive = false) {
      mutateChat(chatId, (c) => {
        const idx = c.items.findIndex((m) => m.id === itemId);
        if (idx < 0) return c;
        return { ...c, items: c.items.slice(0, inclusive ? idx : idx + 1) };
      });
    },
    setMode(mode) {
      set({ mode: mode === "verify" ? "verify" : "chat" });
    },
    setQuery(query) {
      set({ query });
    },
    setSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
    },
    setTheme(theme) {
      storage.set(KEYS.theme, theme);
      set({ theme });
    },
    setLang(lang) {
      storage.set(KEYS.lang, lang);
      set({ lang });
    },
    setModelKey(value, remember) {
      if (remember) storage.set(KEYS.modelKey, value);
      else storage.remove(KEYS.modelKey);
      set({ modelKey: value });
    },
    setRunning(running) {
      set((s) => ({ running: { ...s.running, ...running } }));
    },
    setApi(next, data) {
      set((s) => ({
        apiState: next,
        capabilities: data && "capabilities" in data ? data.capabilities ?? null : s.capabilities,
        ready: data && "ready" in data ? data.ready ?? null : s.ready,
        systemPrompt: data && "systemPrompt" in data ? data.systemPrompt ?? null : s.systemPrompt,
      }));
    },
  };
});

/* Written field by field, as the classic interface does: a new field has to
   be added here deliberately to survive a reload. The key is never written
   into a conversation. */
function serializableItem(m: Item): Item {
  return {
    id: m.id,
    kind: m.kind,
    role: m.role,
    createdAt: m.createdAt,
    status: m.status ?? undefined,
    text: m.text ?? null,
    request: m.request ?? null,
    report: m.report ?? null,
    citations: m.citations ?? null,
    parts: m.parts ?? null,
    error: m.error ?? null,
    model: m.model ?? null,
    durationMs: typeof m.durationMs === "number" ? m.durationMs : null,
    statsData: m.statsData ?? null,
    stats: m.stats ?? null,
    feedback: m.feedback ?? null,
  };
}

export function persist() {
  const s = useIsnad.getState();
  if (!s.hydrated) return false;
  storage.set(KEYS.settings, s.settings);
  let chats = s.chats.slice(0, LIMITS.chats);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const ok = storage.set(KEYS.state, {
      activeId: s.activeId,
      mode: s.mode,
      chats: chats.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        // Items still being written are saved once they settle.
        items: c.items.slice(-LIMITS.items).filter((m) => m.kind !== "pending").map(serializableItem),
      })),
    });
    if (ok) return true;
    if (chats.length <= 1) {
      storage.remove(KEYS.state);
      return false;
    }
    chats = chats.slice(0, Math.max(1, Math.ceil(chats.length / 2)));
  }
  return false;
}

export const activeChat = (s: IsnadState) => s.chats.find((c) => c.id === s.activeId) ?? null;
export const modelConfigured = (s: Pick<IsnadState, "settings">) => Boolean(s.settings.modelBase && s.settings.modelName);
