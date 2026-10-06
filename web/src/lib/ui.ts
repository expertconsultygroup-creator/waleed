"use client";

import { create } from "zustand";

/* View state that is never saved: which dialog is open, the composer draft
   handed over by "edit and resend". */
export type SettingsTab = "model" | "api" | "appearance" | "data";

/* Administrators see the technical side: model and connection settings,
   endpoints, versions and raw codes. Readers never do. It is on for a build
   made with NEXT_PUBLIC_ISNAD_ADMIN=1, or in a browser that opened the page
   with ?admin=1 (and off again with ?admin=0). */
const ADMIN_KEY = "isnad.gui.admin.v1";

function readAdmin(): boolean {
  if (process.env.NEXT_PUBLIC_ISNAD_ADMIN === "1") return true;
  try {
    const flag = new URLSearchParams(window.location.search).get("admin");
    if (flag === "1") window.localStorage.setItem(ADMIN_KEY, "1");
    else if (flag === "0") window.localStorage.removeItem(ADMIN_KEY);
    return window.localStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

interface UiState {
  admin: boolean;
  settingsOpen: boolean;
  /* Changes on every open, so the form starts again from what is saved. */
  settingsNonce: number;
  settingsTab: SettingsTab;
  promptOpen: boolean;
  draft: { text: string; nonce: number } | null;
  loadAdmin(): void;
  openSettings(tab?: SettingsTab): void;
  closeSettings(): void;
  setSettingsTab(tab: SettingsTab): void;
  setPromptOpen(open: boolean): void;
  setDraft(text: string): void;
}

export const useUi = create<UiState>()((set) => ({
  admin: false,
  settingsOpen: false,
  settingsNonce: 0,
  settingsTab: "appearance",
  promptOpen: false,
  draft: null,
  loadAdmin: () => set({ admin: readAdmin() }),
  // Technical tabs fall back to the general one for readers.
  openSettings: (tab = "appearance") =>
    set((s) => ({
      settingsOpen: true,
      settingsTab: !s.admin && (tab === "model" || tab === "api") ? "appearance" : tab,
      settingsNonce: s.settingsNonce + 1,
    })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setPromptOpen: (open) => set({ promptOpen: open }),
  setDraft: (text) => set({ draft: { text, nonce: Date.now() } }),
}));
