"use client";

import { useCallback, useEffect, useState } from "react";
import type { Scope } from "@/lib/scope";

const KEY = "chrono.includeOutside";

/**
 * The INCLUDE OUTSIDE CHROME checkbox, remembered in this browser (on by
 * default: the whole computer). Shared by TODAY and HISTORY.
 */
export function useIncludeOutside(): { includeOutside: boolean; setIncludeOutside: (value: boolean) => void; scope: Scope } {
  const [includeOutside, setState] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved !== null) setState(saved === "1");
    } catch {
      // storage blocked: keep the default
    }
  }, []);

  const setIncludeOutside = useCallback((value: boolean) => {
    setState(value);
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      // storage blocked: the choice lasts until the page is closed
    }
  }, []);

  return { includeOutside, setIncludeOutside, scope: includeOutside ? "all" : "chrome" };
}
