"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError } from "@/types";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError
  ) {
    super(body.message);
  }
}

/** fetch + JSON with typed API errors. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers
    });
  } catch {
    throw new ApiRequestError(0, { code: "CONNECTION_LOST", message: "Server unreachable" });
  }
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const error = (body as ApiError | null) ?? { code: "HTTP_ERROR", message: `HTTP ${response.status}` };
    throw new ApiRequestError(response.status, error);
  }
  return body as T;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiRequestError) return error.body;
  return { code: "UNKNOWN", message: error instanceof Error ? error.message : "Unknown error" };
}

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * GET a JSON endpoint. Changing `url` or `refreshKey` refetches; the previous
 * data stays on screen while reloading to avoid flicker on live updates.
 */
export function useApi<T>(url: string | null, refreshKey: unknown = 0): ApiState<T> {
  const [entry, setEntry] = useState<{ url: string; value: T } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [nonce, setNonce] = useState(0);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (url === null) return;
    let cancelled = false;
    if (lastUrl.current !== url) {
      setLoading(true);
      setError(null);
      lastUrl.current = url;
    }
    apiFetch<T>(url)
      .then((result) => {
        if (cancelled) return;
        setEntry({ url, value: result });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const data = entry !== null && entry.url === url ? entry.value : null;
  return { data, error, loading: loading || (url !== null && data === null && error === null), reload };
}
