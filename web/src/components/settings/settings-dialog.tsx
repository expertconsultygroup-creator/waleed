"use client";

import { useState } from "react";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { refreshApiState } from "@/lib/actions";
import { useT } from "@/lib/i18n/use-t";
import { normalizeApiBase, normalizeModelBase, persist, SERVER_MODEL_NAME, serverModelBase, useIsnad } from "@/lib/store";
import { useUi, type SettingsTab } from "@/lib/ui";

const PROVIDERS: Record<string, { base: string; model: string }> = {
  server: { base: "", model: SERVER_MODEL_NAME },
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "" },
  groq: { base: "https://api.groq.com/openai/v1", model: "" },
  ollama: { base: "http://127.0.0.1:11434/v1", model: "llama3.1" },
  litellm: { base: "http://127.0.0.1:4000/v1", model: "" },
  custom: { base: "", model: "" },
};

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: React.ReactNode }[]; onChange: (v: V) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
            value === o.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 py-3.5 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

/* Words for a URL the settings cannot use. */
function urlProblem(t: ReturnType<typeof useT>, code: string) {
  return (
    { "not-a-url": t("settings.errNotUrl"), "bad-scheme": t("settings.errScheme"), "credentials-in-url": t("settings.errCredentials"), "not-a-base": t("settings.errNotBase") }[code] ??
    t("settings.errUnusable")
  );
}

function detectProvider(): string {
  const s = useIsnad.getState();
  const server = serverModelBase(s.settings);
  if (s.settings.modelBase && s.settings.modelBase === server) return "server";
  return (
    Object.keys(PROVIDERS).find((k) => PROVIDERS[k].base && PROVIDERS[k].base === s.settings.modelBase) ??
    (s.settings.modelBase ? "custom" : "server")
  );
}

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const nonce = useUi((s) => s.settingsNonce);
  const close = useUi((s) => s.closeSettings);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-xl" id="settings-dialog">
        {/* Keyed by each opening: the form starts again from what is saved. */}
        <SettingsForm key={nonce} />
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm() {
  const t = useT();
  const tab = useUi((s) => s.settingsTab);
  const setTab = useUi((s) => s.setSettingsTab);
  const close = useUi((s) => s.closeSettings);
  const admin = useUi((s) => s.admin);
  const settings = useIsnad((s) => s.settings);
  const theme = useIsnad((s) => s.theme);
  const lang = useIsnad((s) => s.lang);
  const systemPrompt = useIsnad((s) => s.systemPrompt);

  const saved = useIsnad.getState();
  const [provider, setProvider] = useState(detectProvider);
  const [modelBase, setModelBase] = useState(saved.settings.modelBase);
  const [modelName, setModelName] = useState(saved.settings.modelName);
  const [key, setKey] = useState(saved.modelKey);
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(saved.settings.modelRememberKey);
  const [temperature, setTemperature] = useState(String(saved.settings.temperature));
  const [apiBase, setApiBase] = useState(saved.settings.apiBase);
  const [error, setError] = useState("");

  const chooseProvider = (value: string) => {
    setProvider(value);
    const p = PROVIDERS[value];
    if (value === "server") {
      setModelBase(serverModelBase(useIsnad.getState().settings));
      setModelName(p.model);
      setKey("");
      return;
    }
    if (p.base) setModelBase(p.base);
    if (p.model && !modelName.trim()) setModelName(p.model);
  };

  const save = () => {
    let nextModel: string;
    let nextApi: string;
    try {
      nextModel = normalizeModelBase(modelBase);
    } catch (e) {
      setError(t("settings.errModel") + urlProblem(t, (e as Error).message));
      return;
    }
    try {
      nextApi = normalizeApiBase(apiBase);
    } catch (e) {
      setError(t("settings.errApi") + urlProblem(t, (e as Error).message));
      return;
    }
    if (nextModel && !modelName.trim()) {
      setError(t("settings.needModelName"));
      return;
    }
    const s = useIsnad.getState();
    s.setModelKey(key.trim(), remember);
    s.setSettings({
      modelBase: nextModel,
      modelName: modelName.trim().slice(0, 120),
      modelRememberKey: remember,
      temperature: Math.min(2, Math.max(0, Number(temperature) || 0)),
      apiBase: nextApi,
    });
    persist();
    close();
    toast.success(nextModel ? t("settings.modelSet", { model: modelName.trim() }) : t("settings.modelDisconnected"));
    void refreshApiState();
  };

  const setLang = (next: "ar" | "en") => {
    useIsnad.getState().setLang(next);
    void refreshApiState({ forcePrompt: true });
  };

  return (
    <>
        <DialogHeader className="px-6 pb-2 pt-6 text-start">
          <DialogTitle className="font-heading text-xl">{t("settings.title")}</DialogTitle>
          <DialogDescription>{admin ? t("settings.introAdmin") : t("settings.intro")}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as SettingsTab); setError(""); }} className="min-h-0 gap-0">
          {/* Readers see what is theirs to change; the model and the
              connection are an administrator's. */}
          <TabsList className={cn("mx-6 mt-2 grid h-10 w-auto rounded-xl", admin ? "grid-cols-4" : "grid-cols-2")}>
            <TabsTrigger value="appearance" className="rounded-lg">{t("settings.tabAppearance")}</TabsTrigger>
            <TabsTrigger value="data" className="rounded-lg">{t("settings.tabData")}</TabsTrigger>
            {admin ? (
              <>
                <TabsTrigger value="model" className="rounded-lg">{t("settings.tabModel")}</TabsTrigger>
                <TabsTrigger value="api" className="rounded-lg">{t("settings.tabApi")}</TabsTrigger>
              </>
            ) : null}
          </TabsList>

          <div className="scrollbar-quiet max-h-[60dvh] overflow-y-auto px-6 py-5">
            <TabsContent value="model" className="grid gap-4" id="panel-model">
              <Field label={t("settings.provider")} htmlFor="provider">
                <Select value={provider} onValueChange={chooseProvider}>
                  <SelectTrigger id="provider" className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server">{t("settings.providerServer")}</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="ollama">{t("settings.providerOllama")}</SelectItem>
                    <SelectItem value="litellm">{t("settings.providerLitellm")}</SelectItem>
                    <SelectItem value="custom">{t("settings.providerCustom")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("settings.modelBase")} htmlFor="model-base">
                <Input id="model-base" dir="ltr" inputMode="url" value={modelBase} onChange={(e) => setModelBase(e.target.value)} placeholder="https://api.openai.com/v1" className="h-10 rounded-xl" />
              </Field>
              <Field label={t("settings.modelName")} htmlFor="model-name">
                <Input id="model-name" dir="ltr" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="gpt-4o-mini" className="h-10 rounded-xl" />
              </Field>
              <Field label={t("settings.apiKey")} htmlFor="model-key" hint={t("settings.keyWarning")}>
                <div className="flex gap-2">
                  <Input id="model-key" dir="ltr" type={showKey ? "text" : "password"} autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" className="h-10 rounded-xl" />
                  <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? t("settings.hide") : t("settings.show")}>
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </Field>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
                <span>{t("settings.rememberKey")}</span>
                <Switch id="remember-key" checked={remember} onCheckedChange={setRemember} />
              </label>
              <Field label={t("settings.temperature")} htmlFor="temperature">
                <Input id="temperature" dir="ltr" type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(e.target.value)} className="h-10 w-28 rounded-xl" />
              </Field>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {systemPrompt ? t("settings.promptLoaded", { version: systemPrompt.version }) : t("settings.promptDisabled")}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="justify-self-start text-mismatch hover:bg-mismatch-soft hover:text-mismatch"
                onClick={() => {
                  useIsnad.getState().setModelKey("", false);
                  useIsnad.getState().setSettings({ modelRememberKey: false });
                  setKey("");
                  setRemember(false);
                  persist();
                  toast.success(t("settings.keyForgotten"));
                }}
              >
                {t("settings.forgetKey")}
              </Button>
            </TabsContent>

            <TabsContent value="api" className="grid gap-4" id="panel-api">
              <Field label={t("settings.apiBase")} htmlFor="api-base" hint={t("settings.readinessHelp")}>
                <Input id="api-base" dir="ltr" inputMode="url" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder={t("settings.apiBasePlaceholder")} className="h-10 rounded-xl" />
              </Field>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("settings.apiHelp", { paths: "/v1/capabilities, /v1/system-prompt, /health/ready, /v1/verify", env: "ISNAD_CORS_ORIGINS" })}
              </p>
            </TabsContent>

            <TabsContent value="data" className="grid gap-4" id="panel-data">
              <p className="text-sm leading-relaxed text-muted-foreground">{t("settings.dataHelp")}</p>
              <Button
                type="button"
                variant="outline"
                className="justify-self-start rounded-xl border-mismatch/30 text-mismatch hover:bg-mismatch-soft hover:text-mismatch"
                onClick={() => {
                  if (!window.confirm(t("settings.confirmClear"))) return;
                  useIsnad.getState().clearHistory();
                  persist();
                  close();
                  toast.success(t("settings.cleared"));
                }}
              >
                {t("settings.clearHistory")}
              </Button>
            </TabsContent>

            <TabsContent value="appearance" id="panel-appearance">
              <Row label={t("settings.language")}>
                <Segmented
                  label={t("settings.language")}
                  value={lang}
                  onChange={setLang}
                  options={[
                    { value: "ar", label: <span lang="ar">العربية</span> },
                    { value: "en", label: <span lang="en">English</span> },
                  ]}
                />
              </Row>
              <Row label={t("settings.theme")}>
                <Segmented
                  label={t("settings.theme")}
                  value={theme}
                  onChange={(v) => useIsnad.getState().setTheme(v)}
                  options={[
                    { value: "light", label: <><Sun className="size-4" />{t("settings.light")}</> },
                    { value: "dark", label: <><Moon className="size-4" />{t("settings.dark")}</> },
                  ]}
                />
              </Row>
              <Row label={t("settings.numerals")}>
                <Segmented
                  label={t("settings.numerals")}
                  value={settings.numerals}
                  onChange={(v) => { useIsnad.getState().setSettings({ numerals: v }); persist(); }}
                  options={[
                    { value: "arab", label: t("settings.numeralsArab") },
                    { value: "latn", label: t("settings.numeralsLatn") },
                  ]}
                />
              </Row>
              <Row label={t("settings.calendar")}>
                <Segmented
                  label={t("settings.calendar")}
                  value={settings.calendar}
                  onChange={(v) => { useIsnad.getState().setSettings({ calendar: v }); persist(); }}
                  options={[
                    { value: "gregory", label: t("settings.calendarGregory") },
                    { value: "islamic-umalqura", label: t("settings.calendarHijri") },
                  ]}
                />
              </Row>
              <Row label={t("settings.timestamps")}>
                <Switch
                  checked={settings.showTimestamps}
                  onCheckedChange={(v) => { useIsnad.getState().setSettings({ showTimestamps: v }); persist(); }}
                  aria-label={t("settings.timestamps")}
                />
              </Row>
            </TabsContent>
          </div>
        </Tabs>

        {error ? (
          <p role="alert" className="mx-6 mb-2 rounded-xl bg-mismatch-soft px-3 py-2 text-sm text-mismatch">
            {error}
          </p>
        ) : null}
        {tab === "model" || tab === "api" ? (
          <div className="flex justify-end gap-2 border-t border-border/70 bg-muted/30 px-6 py-4">
            <Button variant="outline" className="h-10 rounded-xl px-4" onClick={close}>
              {t("settings.cancel")}
            </Button>
            <Button className="h-10 rounded-xl px-5" onClick={save} id="save-settings">
              {t("settings.save")}
            </Button>
          </div>
        ) : null}
    </>
  );
}
