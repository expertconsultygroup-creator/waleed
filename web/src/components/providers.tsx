"use client";

import { useEffect, type ReactNode } from "react";
import { Direction } from "radix-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { refreshApiState } from "@/lib/actions";
import { persist, useIsnad } from "@/lib/store";
import { useUi } from "@/lib/ui";

/* Loads the saved state once, keeps <html> in step with the reader's
   language and theme, and saves changes shortly after they happen. */
export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useIsnad((s) => s.hydrated);
  const lang = useIsnad((s) => s.lang);
  const theme = useIsnad((s) => s.theme);

  useEffect(() => {
    useUi.getState().loadAdmin();
    useIsnad.getState().hydrate();
    void refreshApiState();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [lang, theme]);

  useEffect(() => {
    let timer = 0;
    const unsubscribe = useIsnad.subscribe((state, previous) => {
      if (!state.hydrated) return;
      if (state.chats === previous.chats && state.settings === previous.settings && state.activeId === previous.activeId && state.mode === previous.mode) return;
      // A streaming reply changes the store on every token; save it when it
      // settles rather than on each one.
      if (state.running.active && state.running.kind === "chat") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(persist, 300);
    });
    const onUnload = () => persist();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  return (
    <Direction.DirectionProvider dir={lang === "ar" ? "rtl" : "ltr"}>
      <TooltipProvider delayDuration={300}>
        {hydrated ? children : <BootScreen />}
        <Toaster />
      </TooltipProvider>
    </Direction.DirectionProvider>
  );
}

/* Shown for the instant before saved state is read: the shell's shape, with
   no words in either language, so nothing flips once it loads. */
function BootScreen() {
  return (
    <div className="flex h-dvh">
      <div className="hidden w-72 shrink-0 bg-mihrab lg:block" />
      <div className="flex-1 bg-background" />
    </div>
  );
}
