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
}

export function Widget({ title, hint, meta, children, className = "", pulseBorder = false, href }: WidgetProps) {
  const frame = `relative block border border-primary-container bg-surface-container-high p-md ${
    pulseBorder ? "animate-pulse-border" : ""
  } ${href ? "group transition-colors hover:border-primary hover:bg-surface-container-highest" : ""} ${className}`;

  const content = (
    <>
      <div className="mb-md">
        <div className="flex flex-wrap items-start justify-between gap-x-sm gap-y-xs">
          <h2 className="text-label uppercase tracking-widest text-secondary-fixed">{title}</h2>
          {meta ? <span className="ml-auto text-ui-small uppercase text-outline">{meta}</span> : null}
          {href ? (
            <span aria-hidden className="shrink-0 text-ui-small text-outline transition-colors group-hover:text-secondary-fixed">
              {"OPEN >"}
            </span>
          ) : null}
        </div>
        {hint ? <p className="mt-xs font-read text-read-sm text-outline">{hint}</p> : null}
      </div>
      {children}
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
