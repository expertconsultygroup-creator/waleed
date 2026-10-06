"use client";

import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { PromptDialog } from "@/components/settings/prompt-dialog";
import { useT } from "@/lib/i18n/use-t";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/* Two columns: the emerald sidebar (a drawer below lg) and the page. */
export function AppShell({ view, children }: { view: "chat" | "dashboard"; children: ReactNode }) {
  const t = useT();
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex h-dvh overflow-clip">
      <div className="hidden w-72 shrink-0 lg:block xl:w-[19rem]">
        <Sidebar />
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side={t.dir === "rtl" ? "right" : "left"} className="w-[86vw] max-w-80 border-0 p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">{t("nav.label")}</SheetTitle>
          <Sidebar onNavigate={() => setDrawer(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-clip">
        <Topbar view={view} onMenu={() => setDrawer(true)} />
        <main className="relative min-h-0 flex-1 overflow-clip">{children}</main>
      </div>

      <SettingsDialog />
      <PromptDialog />
    </div>
  );
}
