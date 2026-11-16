import type { ApiError } from "@/types";

export function Loading({ label = "LOADING" }: { label?: string }) {
  return (
    <div role="status" className="py-lg text-label text-outline">
      {label}
      <span className="animate-blink text-secondary-fixed">...</span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-md text-ui-small uppercase leading-relaxed text-outline">{children}</div>;
}

/** Inline error for a failed API call, with retry. */
export function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const title =
    error.code === "DB_UNREACHABLE"
      ? "SYS.ERR // DATABASE UNREACHABLE"
      : error.code === "CONNECTION_LOST"
        ? "SYS.ERR // CONNECTION LOST"
        : `SYS.ERR // ${error.code}`;
  return (
    <div role="alert" className="border border-error-container bg-surface-container-lowest p-md">
      <div className="text-label text-error">{title}</div>
      <div className="mt-sm text-ui-small leading-relaxed text-on-surface-variant">
        {error.code === "DB_UNREACHABLE" ? "> THE DATABASE FILE IS MISSING OR LOCKED. RUN: npm run setup" : `> ${error.message}`}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-md border border-error px-md py-xs text-label text-error hover:bg-error-container hover:text-on-error-container"
        >
          [RETRY]
        </button>
      ) : null}
    </div>
  );
}
