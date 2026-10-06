"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import { useIsnad } from "@/lib/store";
import { useUi } from "@/lib/ui";

export function PromptDialog() {
  const t = useT();
  const open = useUi((s) => s.promptOpen);
  const setOpen = useUi((s) => s.setPromptOpen);
  const prompt = useIsnad((s) => s.systemPrompt);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="text-start">
          <DialogTitle className="font-heading text-xl">{t("prompt.title")}</DialogTitle>
          <DialogDescription>{t("prompt.intro", { version: prompt?.version ?? t("prompt.notLoaded") })}</DialogDescription>
        </DialogHeader>
        <pre dir="auto" className="scrollbar-quiet max-h-[60dvh] overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm leading-relaxed">
          {prompt?.prompt ?? t("prompt.notLoadedBody")}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
