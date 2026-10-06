"use client";

import { Download, Languages, Menu, Moon, RefreshCw, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { refreshApiState } from "@/lib/actions";
import { chatTitle } from "@/lib/chat-title";
import { conversationMarkdown, download } from "@/lib/export";
import { useT } from "@/lib/i18n/use-t";
import { activeChat, modelConfigured, useIsnad } from "@/lib/store";
import { useUi } from "@/lib/ui";

function IconAction({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} className={cn("size-9 rounded-xl text-muted-foreground hover:text-foreground", className)}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Topbar({ view, onMenu }: { view: "chat" | "dashboard"; onMenu: () => void }) {
  const t = useT();
  const chat = useIsnad(activeChat);
  const apiState = useIsnad((s) => s.apiState);
  const configured = useIsnad(modelConfigured);
  const modelName = useIsnad((s) => s.settings.modelName);
  const theme = useIsnad((s) => s.theme);
  const lang = useIsnad((s) => s.lang);
  const openSettings = useUi((s) => s.openSettings);

  const title = view === "dashboard" ? t("dash.title") : chatTitle(t, chat);

  const exportChat = () => {
    if (!chat || !chat.items.length) {
      toast.error(t("export.nothing"));
      return;
    }
    const name = (chatTitle(t, chat) || "conversation").replace(/[^\w؀-ۿ-]+/g, "-").slice(0, 40);
    download(`${name}.md`, conversationMarkdown(t, chat), "text/markdown;charset=utf-8");
    toast.success(t("export.done"));
  };

  const switchLanguage = () => {
    const next = lang === "ar" ? "en" : "ar";
    useIsnad.getState().setLang(next);
    void refreshApiState({ forcePrompt: true });
  };

  const apiLabel = apiState === "ready" ? t("api.ready") : apiState === "checking" ? t("api.checking") : t("api.unavailable");

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur-md sm:px-5">
      <Button variant="ghost" size="icon" className="size-9 rounded-xl lg:hidden" onClick={onMenu} aria-label={t("nav.show")}>
        <Menu className="size-5" />
      </Button>

      <h1 className="min-w-0 flex-1 truncate font-heading text-lg font-semibold" dir="auto">
        {title}
      </h1>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void refreshApiState()}
              className={cn(
                "hidden h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition sm:inline-flex",
                apiState === "unavailable" ? "border-mismatch/30 bg-mismatch-soft text-mismatch" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              aria-live="polite"
              data-state={apiState}
              id="api-status"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  apiState === "ready" && "bg-match shadow-[0_0_0_3px_var(--match-soft)]",
                  apiState === "checking" && "animate-pulse bg-gold",
                  apiState === "unavailable" && "bg-mismatch",
                )}
              />
              {apiLabel}
              {apiState !== "checking" ? <RefreshCw className="size-3 opacity-60" /> : null}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("header.refreshTitle")}</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={() => openSettings("model")}
          className="hidden h-8 max-w-48 items-center gap-2 truncate rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground md:inline-flex"
          title={t("header.modelTitle")}
          id="model-status"
        >
          <span className={cn("size-2 shrink-0 rounded-full", configured ? "bg-primary" : "bg-muted-foreground/50")} />
          <span className="ref truncate">{configured ? modelName : t("model.none")}</span>
        </button>

        {view === "chat" ? (
          <IconAction label={t("header.export")} onClick={exportChat}>
            <Download className="size-[18px]" />
          </IconAction>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={switchLanguage}
              className="h-9 gap-1.5 rounded-xl px-2.5 text-muted-foreground hover:text-foreground"
              aria-label={t("header.languageLabel")}
              id="lang-toggle"
            >
              <Languages className="size-[18px]" />
              <span lang={lang === "ar" ? "en" : "ar"} className="text-sm font-medium">
                {t("header.language")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("header.languageLabel")}</TooltipContent>
        </Tooltip>

        <IconAction
          label={theme === "dark" ? t("header.themeToLight") : t("header.themeToDark")}
          onClick={() => useIsnad.getState().setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </IconAction>
      </div>
    </header>
  );
}
