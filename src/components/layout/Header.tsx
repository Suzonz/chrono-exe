"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActivePath, pageTitle } from "@/components/layout/nav";
import { useNow } from "@/hooks/useNow";
import { formatClock, formatLongDay } from "@/lib/time";

export const HEADER_TOOLS_ID = "header-tools";

export function Header() {
  const pathname = usePathname();
  const now = useNow(1000);
  const date = new Date(now);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-primary-container bg-surface-container md:left-[220px]">
      <div className="flex h-[48px] items-center justify-between gap-md px-md">
        <div className="flex min-w-0 items-center gap-lg">
          {/* The home page replaces its title with the SESSION / TODAY switch. */}
          <h1 className={pathname === "/" ? "sr-only" : "text-h2 uppercase text-on-background"}>{pageTitle(pathname)}</h1>
          <div id={HEADER_TOOLS_ID} className="flex items-center" />
        </div>
        <div className="flex items-center gap-md text-label uppercase tracking-widest text-primary">
          <span className="hidden lg:inline" suppressHydrationWarning>
            {formatLongDay(date)}
          </span>
          <span className="text-secondary-fixed" suppressHydrationWarning>
            {formatClock(date, true)}
          </span>
        </div>
      </div>
      <nav className="flex overflow-x-auto border-t border-outline-variant md:hidden" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 whitespace-nowrap px-sm py-sm text-center text-ui-small ${
                active ? "bg-primary-container text-white" : "text-outline"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
