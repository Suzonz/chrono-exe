export const NAV_ITEMS = [
  { href: "/", label: "TODAY", icon: "▦" },
  { href: "/history", label: "HISTORY", icon: "◫" },
  { href: "/settings", label: "SETTINGS", icon: "⚙" }
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function pageTitle(pathname: string): string {
  const item = NAV_ITEMS.find((entry) => isActivePath(pathname, entry.href));
  return item?.label ?? "ERROR_404";
}
