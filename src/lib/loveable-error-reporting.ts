type LoveableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LoveableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LoveableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __loveableEvents?: LoveableEvents;
    __lovableEvents?: LoveableEvents;
  }
}

export function reportLoveableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const events = window.__loveableEvents || window.__lovableEvents;
  events?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}

export const reportLovableError = reportLoveableError;
