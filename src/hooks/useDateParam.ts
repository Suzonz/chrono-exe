"use client";

import { useCallback, useEffect, useState } from "react";
import { DATE_KEY_REGEX, todayKey } from "@/lib/time";

/**
 * Selected day, mirrored in the `?date=` query string so views are linkable
 * (e.g. clicking a day in HISTORY opens that day). Future dates are clamped.
 */
export function useDateParam(): [string, (key: string) => void] {
  const [date, setDateState] = useState<string>(todayKey);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("date");
    if (param && DATE_KEY_REGEX.test(param)) {
      setDateState(param > todayKey() ? todayKey() : param);
    }
  }, []);

  const setDate = useCallback((key: string) => {
    const clamped = key > todayKey() ? todayKey() : key;
    setDateState(clamped);
    const url = new URL(window.location.href);
    if (clamped === todayKey()) url.searchParams.delete("date");
    else url.searchParams.set("date", clamped);
    window.history.replaceState(null, "", url.toString());
  }, []);

  return [date, setDate];
}
