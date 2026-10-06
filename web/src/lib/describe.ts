import type { T } from "./i18n/use-t";
import type { Failure } from "./types";

export interface Described {
  title: string;
  message: string;
  detail?: string;
  cancelled: boolean;
}

/* Words for a failure, in the reader's language, at render time. Nothing here
   ever says "not found": a check that failed decided nothing. Status codes,
   field paths and a provider's own error text are shown to administrators
   only; readers are told what happened and what to do. */
export function describeFailure(t: T, f: Failure, opts: { fromDisk?: boolean; admin?: boolean } = {}): Described {
  const admin = opts.admin === true;
  if (f.title) {
    // Saved by the classic interface, already worded.
    return { title: f.title, message: f.message ?? "", detail: f.detail, cancelled: f.tone === "cancelled" };
  }
  const base = f.base ?? "";
  if (f.scope === "model") {
    switch (f.code) {
      case "cancelled":
        return { title: t("modelError.stopped"), message: t("modelError.stoppedMsg"), cancelled: true };
      case "network":
        return { title: t("modelError.unreachable"), message: t("modelError.unreachableMsg", { base: base || t("modelError.theEndpoint") }), cancelled: false };
      case "http_401":
      case "http_403":
        return { title: t("modelError.badKey"), message: t("modelError.badKeyMsg", { status: String(f.httpStatus) }), cancelled: false };
      case "http_429":
        return { title: t("modelError.rateLimited"), message: t("modelError.rateLimitedMsg"), cancelled: false };
      case "no_stream":
        return { title: t("modelError.noStream"), message: t("modelError.noStreamMsg"), cancelled: false };
      case "provider_error":
        return { title: t("modelError.provider"), message: (admin && f.message) || t("modelError.providerMsg"), cancelled: false };
      default:
        return {
          title: t("modelError.failed"),
          message: admin && f.httpStatus ? t("modelError.refusedRaw", { status: String(f.httpStatus) }) : t("modelError.failedMsg"),
          detail: admin ? f.detail : undefined,
          cancelled: false,
        };
    }
  }
  if (f.scope === "citation") {
    if (f.code === "incomplete") {
      return { title: t("citation.incomplete"), message: t("citation.incompleteMsg", { n: f.withheld ?? 0 }), cancelled: false };
    }
    const reasons: Record<string, string> = {
      malformed_header: t("citation.malformed"),
      oversized_header: t("citation.oversized"),
      unterminated_header: t("citation.unterminated"),
    };
    return {
      title: t("citation.rejected"),
      message: (reasons[f.reason ?? ""] ?? t("citation.rejectedGeneric")) + t("citation.withheld"),
      detail: admin && f.reason ? t("citation.reason", { reason: f.reason }) : undefined,
      cancelled: false,
    };
  }
  switch (f.code) {
    case "cancelled":
      return { title: t("error.cancelled"), message: t("error.cancelledMsg"), cancelled: true };
    case "timeout":
      return { title: t("error.timeout"), message: t("error.timeoutMsg", { base }), cancelled: false };
    case "network":
      if (opts.fromDisk) return { title: t("error.noApi"), message: t("error.noApiMsg"), cancelled: false };
      return { title: t("error.unreachable"), message: t("error.unreachableMsg", { base }), cancelled: false };
    case "source_unavailable":
      return {
        title: t("error.sourceUnavailable"),
        message:
          t("error.sourceUnavailableMsg") +
          (f.retryAfter ? t("error.retryAfter", { n: Number(f.retryAfter) || f.retryAfter }) : ""),
        detail: t("error.sourceUnavailableDetail"),
        cancelled: false,
      };
    case "validation_error":
    case "invalid_reference":
    case "unsupported_source":
    case "unsupported_language":
      return {
        title: t("error.rejected"),
        message: admin && f.message ? f.message : f.code === "invalid_reference" ? t("error.invalidReferenceMsg") : t("error.rejectedMsg"),
        detail: admin && f.details?.length
          ? t("error.fields", {
              fields: f.details.map((d) => (d.location ?? []).join(".") + (d.code ? ` (${d.code})` : "")).join(", "),
            })
          : undefined,
        cancelled: false,
      };
    case "rate_limited":
      return {
        title: t("error.rateLimited"),
        message: t("error.rateLimitedMsg") + (f.retryAfter ? t("error.retryAfterShort", { n: Number(f.retryAfter) || f.retryAfter }) : ""),
        cancelled: false,
      };
    case "invalid_response":
      return { title: t("error.invalidResponse"), message: t("error.invalidResponseMsg"), cancelled: false };
    default:
      return {
        title: t("error.verifyFailed"),
        message: (admin && f.message) || t("error.verifyFailedMsg"),
        detail: admin
          ? [f.httpStatus ? `HTTP ${f.httpStatus}` : "", f.code ? t("error.code", { code: f.code }) : ""].filter(Boolean).join(" · ")
          : undefined,
        cancelled: false,
      };
  }
}
