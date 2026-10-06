"use client";

import { useEffect, useRef } from "react";
import { activeChat, useIsnad } from "@/lib/store";
import { Composer } from "./composer";
import { Message } from "./message";
import { ChatWelcome, VerifyWelcome } from "./welcome";

export function ChatView() {
  const chat = useIsnad(activeChat);
  const mode = useIsnad((s) => s.mode);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const items = chat?.items ?? [];
  const visible = mode === "verify" ? items.filter((m) => m.role === "tool") : items;
  const last = items[items.length - 1];
  const signature = `${chat?.id}|${mode}|${items.length}|${last?.kind}|${last?.text?.length ?? 0}|${last?.citations?.map((c) => c.state).join(",") ?? ""}`;

  // Follow the conversation while the reader is at the bottom; leave them
  // alone once they scroll up to read.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current && visible.length) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    stick.current = true;
    const el = scroller.current;
    // A conversation opens at its latest message; a welcome screen at its top.
    if (el) el.scrollTo({ top: visible.length ? el.scrollHeight : 0 });
    // Arriving on a permalink (#m-<id>) shows that message.
    const hash = window.location.hash;
    if (hash.startsWith("#m-")) {
      window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" }), 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, mode]);

  return (
    <div className="absolute inset-0">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="scrollbar-quiet h-full overflow-y-auto px-4 pb-64 pt-6 sm:px-8 sm:pb-72"
        id="transcript"
      >
        {visible.length === 0 ? (
          mode === "verify" ? <VerifyWelcome /> : <ChatWelcome />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-7" aria-live="polite">
            {visible.map((entry) => (
              <Message key={entry.id} entry={entry} chatId={chat!.id} />
            ))}
          </div>
        )}
      </div>
      <Composer />
    </div>
  );
}
