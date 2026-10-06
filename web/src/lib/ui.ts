"use client";

import { create } from "zustand";

/* View state that is never saved: which dialog is open, the composer draft
   handed over by "edit and resend". */
export type SettingsTab = "model" | "api" | "appearance";

interface UiState {
  settingsOpen: boolean;
  /* Changes on every open, so the form starts again from what is saved. */
  settingsNonce: number;
  settingsTab: SettingsTab;
  promptOpen: boolean;
  draft: { text: string; nonce: number } | null;
  openSettings(tab?: SettingsTab): void;
  closeSettings(): void;
  setSettingsTab(tab: SettingsTab): void;
  setPromptOpen(open: boolean): void;
  setDraft(text: string): void;
}

export const useUi = create<UiState>()((set) => ({
  settingsOpen: false,
  settingsNonce: 0,
  settingsTab: "model",
  promptOpen: false,
  draft: null,
  openSettings: (tab = "model") => set((s) => ({ settingsOpen: true, settingsTab: tab, settingsNonce: s.settingsNonce + 1 })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setPromptOpen: (open) => set({ promptOpen: open }),
  setDraft: (text) => set({ draft: { text, nonce: Date.now() } }),
}));
