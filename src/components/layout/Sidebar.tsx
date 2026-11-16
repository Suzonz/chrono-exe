"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActivePath } from "@/components/layout/nav";
import { useDashboard } from "@/hooks/useDashboard";
import { CategoryBadge } from "@/components/ui/CategoryBadge";

export function Sidebar() {
  const pathname = usePathname();
  const { activeSession, ready, trackingState } = useDashboard();

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[220px] flex-col justify-between border-r border-primary-container bg-surface-container md:flex">
      <div>
        <Link href="/" className="block border-b border-primary-container p-md">
          <div className="flex items-center gap-sm">
            <div aria-hidden className="grid h-6 w-6 place-items-center bg-primary-container text-ui-small text-white">
              ◷
            </div>
            <div>
              <div className="text-label text-primary">CHRONO.EXE</div>
              <div className="mt-[2px] font-read text-read-sm text-outline">time tracker</div>
            </div>
          </div>
        </Link>

        <nav className="py-sm" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[44px] items-center gap-sm px-md text-label transition-colors ${
                  active
                    ? "bg-primary-container text-white"
                    : "text-outline hover:bg-surface-container-highest hover:text-on-background"
                }`}
              >
                <span aria-hidden className="w-5 text-center text-[16px] leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-primary-container p-md">
        <div className="mb-xs text-ui-small text-outline">NOW TRACKING</div>
        {!ready ? (
          <div className="text-ui-small text-outline">--</div>
        ) : trackingState === "RUNNING" && activeSession ? (
          <CategoryBadge
            category={{ name: activeSession.categoryName, color: activeSession.categoryColor }}
            size="ui-small"
            className={activeSession.isIdle ? "animate-blink" : ""}
          />
        ) : (
          <div className="text-ui-small text-outline">{trackingState === "PAUSED" ? "PAUSED" : trackingState === "RUNNING" ? "WAITING..." : "NOTHING (STOPPED)"}</div>
        )}
      </div>
    </aside>
  );
}
