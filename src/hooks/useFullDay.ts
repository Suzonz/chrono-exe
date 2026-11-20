"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "chrono.fullDay";

/**
 * The TODAY checkbox of the SESSION page, remembered in this browser. Off by
 * default: the page shows the current session only (since play).
 */
export function useFullDay(): { fullDay: boolean; setFullDay: (value: boolean) => void } {
  const [fullDay, setState] = useState(false);

  useEffect(() => {
    try {
      setState(window.localStorage.getItem(KEY) === "1");
    } catch {
      // storage blocked: keep the default
    }
  }, []);

  const setFullDay = useCallback((value: boolean) => {
    setState(value);
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      // storage blocked: the choice lasts until the page is closed
    }
  }, []);

  return { fullDay, setFullDay };
}
