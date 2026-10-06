import type { T } from "./i18n/use-t";
import type { Chat } from "./types";

/* An untitled chat stores no title; the name shown is the catalog's, in the
   reader's current language. "New chat" was once stored literally. */
export function chatTitle(t: T, chat: Chat | null | undefined): string {
  const title = chat?.title;
  return title && title !== "New chat" ? title : t("chat.untitled");
}
