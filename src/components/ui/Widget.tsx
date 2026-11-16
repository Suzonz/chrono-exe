import Link from "next/link";
import type { ReactNode } from "react";

interface WidgetProps {
  title: string;
  /** One plain sentence saying what this block shows. */
  hint?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  pulseBorder?: boolean;
  /** Makes the whole widget a link. */
  href?: string;
  /** Dense screens: the hint becomes a (?) tooltip and the body fills the height. */
  compact?: boolean;
}

export function Widget({ title, hint, meta, children, className = "", pulseBorder = false, href, compact = false }: WidgetProps) {
  const frame = `relative ${compact ? "flex min-h-0 flex-col" : "block"} border border-primary-container bg-surface-container-high p-md ${
    pulseBorder ? "animate-pulse-border" : ""
  } ${href ? "group transition-colors hover:border-primary hover:bg-surface-container-highest" : ""} ${className}`;

  const content = (
    <>
      <div className={compact ? "mb-sm shrink-0" : "mb-md"}>
        <div className="flex flex-wrap items-start justify-between gap-x-sm gap-y-xs">
          <h2 className="text-label uppercase tracking-widest text-secondary-fixed">
            {title}
            {compact && hint ? (
              <span title={hint} aria-label={hint} className="ml-sm cursor-help text-outline hover:text-on-background">
                (?)
              </span>
            ) : null}
          </h2>
          {meta ? <span className="ml-auto text-ui-small uppercase text-outline">{meta}</span> : null}
          {href ? (
            <span aria-hidden className="shrink-0 text-ui-small text-outline transition-colors group-hover:text-secondary-fixed">
              {"OPEN >"}
            </span>
          ) : null}
        </div>
        {hint && !compact ? <p className="mt-xs font-read text-read-sm text-outline">{hint}</p> : null}
      </div>
      {compact ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={frame} aria-label={`${title} - open details`}>
        {content}
      </Link>
    );
  }
  return <section className={frame}>{content}</section>;
}
