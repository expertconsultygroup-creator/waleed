"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LayoutDashboard, MessagesSquare, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Khatam, Lattice } from "@/components/brand/ornaments";
import { useT } from "@/lib/i18n/use-t";
import { searchKey } from "@/lib/i18n/translate";
import { persist, useIsnad } from "@/lib/store";
import type { Chat } from "@/lib/types";
import { chatTitle } from "@/lib/chat-title";
import { useUi } from "@/lib/ui";

function groupOf(ts: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= today) return "group.today";
  if (ts >= today - 86400000) return "group.yesterday";
  if (ts >= today - 86400000 * 7) return "group.week";
  if (new Date(ts).getFullYear() === now.getFullYear()) return "group.year";
  return "group.older";
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const chats = useIsnad((s) => s.chats);
  const activeId = useIsnad((s) => s.activeId);
  const query = useIsnad((s) => s.query);
  const setQuery = useIsnad((s) => s.setQuery);
  const openSettings = useUi((s) => s.openSettings);
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  const onDashboard = pathname?.startsWith("/dashboard");

  const groups = useMemo(() => {
    const key = searchKey(query.trim());
    const has = (text?: string | null) => searchKey(text).includes(key);
    const matches = chats
      .filter((c) => {
        if (!key) return true;
        if (has(chatTitle(t, c))) return true;
        return c.items.some(
          (m) =>
            has(m.text) ||
            has(m.request?.quote) ||
            has(m.report?.submittedQuote) ||
            (m.citations ?? []).some((ci) => ci.report?.evidence?.some((e) => has(e.source_text))),
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const out: { label: string; items: Chat[] }[] = [];
    for (const chat of matches) {
      const label = groupOf(chat.updatedAt);
      if (out[out.length - 1]?.label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(chat);
    }
    return { out, count: matches.length };
  }, [chats, query, t]);

  const newChat = () => {
    useIsnad.getState().createChat();
    persist();
    if (onDashboard) router.push("/");
    onNavigate?.();
    window.setTimeout(() => document.getElementById("composer-input")?.focus(), 60);
  };

  const open = (id: string) => {
    useIsnad.getState().selectChat(id);
    if (onDashboard) router.push("/");
    onNavigate?.();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    useIsnad.getState().deleteChat(pendingDelete.id);
    persist();
    toast.success(t("list.deleted"));
    setPendingDelete(null);
  };

  const nav = [
    { href: "/", label: t("nav.chat"), icon: MessagesSquare, active: !onDashboard },
    { href: "/dashboard/", label: t("nav.dashboard"), icon: LayoutDashboard, active: !!onDashboard },
  ];

  return (
    <aside className="relative flex h-full w-full flex-col overflow-hidden bg-mihrab text-mihrab-foreground dark:border-e dark:border-white/5" aria-label={t("nav.label")}>
      {/* The lattice: gold, faint, fading out under the brand. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 text-gold opacity-[0.13] [mask-image:linear-gradient(to_bottom,#000_10%,transparent)]">
        <Lattice className="size-full" />
      </div>

      <div className="relative flex items-center gap-3 px-5 pt-6 pb-5">
        <Khatam className="size-11 text-gold" />
        <div className="min-w-0 leading-tight">
          <p className="font-heading text-[1.6rem] font-bold leading-none tracking-normal">{t("app.name")}</p>
          <p className="mt-1.5 truncate text-[0.78rem] text-mihrab-muted">{t("app.tagline")}</p>
        </div>
      </div>

      <nav className="relative grid gap-1 px-3" aria-label={t("nav.label")}>
        {nav.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition-colors",
              active ? "bg-mihrab-2 text-white" : "text-mihrab-muted hover:bg-white/5 hover:text-white",
            )}
          >
            {active ? <span className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-gold" aria-hidden="true" /> : null}
            <Icon className={cn("size-[18px]", active ? "text-gold" : "")} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="relative px-3 pt-4">
        <button
          type="button"
          onClick={newChat}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold text-[0.95rem] font-semibold text-mihrab shadow-[0_8px_20px_-10px_rgb(201_162_74/0.7)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} />
          {t("nav.newChat")}
        </button>
      </div>

      <div className="relative px-3 pt-3">
        <label className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/10 transition focus-within:bg-white/10 focus-within:ring-gold/60">
          <Search className="size-4 shrink-0 text-mihrab-muted" />
          <span className="sr-only">{t("nav.searchLabel")}</span>
          <input
            type="search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("nav.search")}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-mihrab-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="rounded-md p-0.5 text-mihrab-muted hover:text-white" aria-label={t("nav.clearSearch")}>
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        {query.trim() ? (
          <p className="px-1 pt-2 text-xs text-mihrab-muted" role="status">
            {t("list.matches", { n: groups.count, total: chats.length })}
          </p>
        ) : null}
      </div>

      <div className="scrollbar-quiet relative mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.out.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-mihrab-muted">{query ? t("list.noMatch") : t("list.empty")}</p>
        ) : (
          groups.out.map((group) => (
            <section key={group.label} className="mb-3">
              <h2 className="px-2 pb-1.5 pt-2 font-sans text-xs font-medium text-mihrab-muted">{t(group.label)}</h2>
              <ul className="grid gap-0.5">
                {group.items.map((chat) => {
                  const active = !onDashboard && chat.id === activeId;
                  const title = chatTitle(t, chat);
                  return (
                    <li key={chat.id} className="group/row relative">
                      <button
                        type="button"
                        onClick={() => open(chat.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex h-10 w-full items-center rounded-lg pe-9 ps-3 text-start text-[0.9rem] transition-colors",
                          active ? "bg-white/10 text-white" : "text-mihrab-foreground/80 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <span className="truncate" dir="auto">
                          {title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(chat)}
                        aria-label={t("list.delete", { title })}
                        className="absolute inset-y-0 end-1 my-auto grid size-8 place-items-center rounded-md text-mihrab-muted opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover/row:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="relative border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => openSettings()}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start transition hover:bg-white/5"
        >
          <span className="grid size-9 place-items-center rounded-full bg-white/[0.07] ring-1 ring-white/10">
            <Settings2 className="size-[18px] text-gold" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-medium text-white">{t("nav.settings")}</span>
            <span className="block truncate text-xs text-mihrab-muted">{t("nav.settingsSub")}</span>
          </span>
        </button>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("list.deleteShort")}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete ? t("list.confirmDelete", { title: chatTitle(t, pendingDelete) }) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("list.deleteShort")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
